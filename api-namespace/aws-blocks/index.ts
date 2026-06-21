// AWS Blocks バックエンド定義 — Mini Support Desk
//
// AuthCognito / Database / FileBucket / Logger / Metrics / AsyncJob / CronJob /
// EmailClient / KnowledgeBase / Agent を組み合わせて構築する。
// すべて `npm run dev` のローカルモックで動作する（AWS アカウント不要）。
import {
  ApiNamespace, Scope, AuthCognito, Database, sql, FileBucket, Logger, Metrics,
  AsyncJob, CronJob, EmailClient, KnowledgeBase, Agent, BedrockModels, OllamaModels,
} from '@aws-blocks/blocks';
import { z } from 'zod';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { Ticket, TicketPriority } from '../shared/types.js';

const scope = new Scope('mini-support-desk');

// ─── 認証（Cognito） ───────────────────────────────────────────────────────────
const auth = new AuthCognito(scope, 'auth', {
  passwordPolicy: { minLength: 8 },
  signInWith: 'email',
  // ローカルモック専用: 確認コードをターミナルへ出力する
  codeDelivery: async (username: string, code: string) => {
    console.log(`[auth] ${username} の確認コード: ${code}`);
  },
});
export const authApi = auth.createApi();

// ─── データ / ストレージ / 観測 ────────────────────────────────────────────────
const db = new Database(scope, 'main', { migrationsPath: './aws-blocks/migrations' });
const attachments = new FileBucket(scope, 'attachments');
const log = new Logger(scope, 'log');
const metrics = new Metrics(scope, 'metrics');
const email = new EmailClient(scope, 'mail', { fromAddress: 'support@example.com' });

// ─── Bedrock RAG（KnowledgeBase + Agent） ─────────────────────────────────────
const kb = new KnowledgeBase(scope, 'docs', { source: './docs/knowledge-base' });

const agent = new Agent(scope, 'support', {
  model: {
    deployed: BedrockModels.DEFAULT, // sandbox / 本番では Bedrock
    local: OllamaModels.SMALL,       // ローカルで Ollama 起動時に使用。未起動なら canned へ自動フォールバック
  },
  inferenceOnly: true,
  systemPrompt: 'あなたは丁寧なサポート担当です。参考ドキュメントを基に回答案を作成してください。',
  tools: (tool) => ({
    searchDocs: tool({
      description: 'サポートドキュメントを検索する',
      parameters: z.object({ query: z.string() }),
      handler: async ({ input }) => {
        const results = await kb.retrieve(input.query, { maxResults: 3 });
        // ツールの戻り値は JSON 値である必要があるため素のオブジェクトに整形する
        return results.map((r) => ({ text: r.text, score: r.score, source: r.source }));
      },
    }),
  }),
});

// ─── CDK layer 連携（high 優先度チケットを SQS へ） ────────────────────────────
// QUEUE URL は aws-blocks/index.cdk.ts の CDK layer が環境変数で注入する。
// ローカルでは未設定のため、この分岐は自然にスキップされる。
const sqsClient = new SQSClient({});

const newId = (p = 't') => `${p}_${Date.now().toString(36)}${Math.floor(performance.now()).toString(36)}`;

// ─── AsyncJob: チケット作成通知を非同期で処理する ─────────────────────────────
const ticketCreatedJob = new AsyncJob(scope, 'ticket-created', {
  handler: async (payload: { ticketId: string; title: string }, ctx) => {
    await db.execute(sql`
      INSERT INTO notification_logs (id, ticket_id, type, status)
      VALUES (${newId('n')}, ${payload.ticketId}, 'ticket_created', 'sent')
    `);
    await email.send({
      to: 'support@example.com',
      subject: `新しい問い合わせ: ${payload.title}`,
      body: `チケット ${payload.ticketId} が作成されました。`,
    });
    log.info('notification sent', { ticketId: payload.ticketId, jobId: ctx.jobId });
  },
});

// ─── CronJob: open チケット数を定期集計する ───────────────────────────────────
new CronJob(scope, 'open-ticket-report', {
  schedule: 'rate(1 day)',
  timezone: 'Asia/Tokyo',
  handler: async (event) => {
    const row = await db.queryOne<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM tickets WHERE status = 'open'`
    );
    log.info('open ticket report', { open: row?.count, at: event.scheduledTime });
  },
});

// ─── API ───────────────────────────────────────────────────────────────────────
export const api = new ApiNamespace(scope, 'api', (context) => ({
  async createTicket(title: string, body: string, priority: TicketPriority = 'normal', attachmentKey?: string) {
    const user = await auth.requireAuth(context);
    const id = newId();
    await db.execute(sql`
      INSERT INTO tickets (id, owner_sub, title, body, priority, attachment_key)
      VALUES (${id}, ${user.userSub}, ${title}, ${body}, ${priority}, ${attachmentKey ?? null})
    `);
    metrics.emit('RequestCreated', 1, { unit: 'Count' });
    const { jobId } = await ticketCreatedJob.submit({ ticketId: id, title });
    log.info('ticket created', { id, priority, jobId });

    // high 優先度は CDK layer の SQS ワークフローへ（ローカルでは env 未設定でスキップ）
    if (priority === 'high' && process.env.TRIAGE_QUEUE_URL) {
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: process.env.TRIAGE_QUEUE_URL,
        MessageBody: JSON.stringify({ ticketId: id, title }),
      }));
      await db.execute(sql`
        INSERT INTO workflow_logs (id, ticket_id, status)
        VALUES (${newId('w')}, ${id}, 'queued')
      `);
    }

    return await db.queryOne<Ticket>(sql`SELECT * FROM tickets WHERE id = ${id}`);
  },

  async listTickets() {
    const user = await auth.requireAuth(context);
    return await db.query<Ticket>(
      sql`SELECT * FROM tickets WHERE owner_sub = ${user.userSub} ORDER BY created_at DESC`
    );
  },

  async getTicket(id: string) {
    const user = await auth.requireAuth(context);
    return await db.queryOne<Ticket>(
      sql`SELECT * FROM tickets WHERE id = ${id} AND owner_sub = ${user.userSub}`
    );
  },

  async closeTicket(id: string) {
    const user = await auth.requireAuth(context);
    await db.execute(
      sql`UPDATE tickets SET status = 'closed', updated_at = now()
          WHERE id = ${id} AND owner_sub = ${user.userSub}`
    );
    return { ok: true };
  },

  async getAttachmentUploadUrl(filename: string) {
    const user = await auth.requireAuth(context);
    const key = `${user.userSub}/${Date.now()}-${encodeURIComponent(filename)}`;
    const url = await attachments.putUrl(key, { expiresIn: 600 });
    return { key, url };
  },

  async getAttachmentDownloadUrl(key: string) {
    await auth.requireAuth(context);
    return { url: await attachments.getUrl(key, { expiresIn: 600 }) };
  },

  async searchDocs(query: string) {
    await auth.requireAuth(context);
    return await kb.retrieve(query, { maxResults: 3 });
  },

  async draftAnswer(ticketId: string) {
    const user = await auth.requireAuth(context);
    const ticket = await db.queryOne<Ticket>(
      sql`SELECT * FROM tickets WHERE id = ${ticketId} AND owner_sub = ${user.userSub}`
    );
    if (!ticket) throw new Error('ticket not found');
    const result = await agent.stream(
      `件名: ${ticket.title}\n本文: ${ticket.body}\nこの問い合わせへの回答案を作成してください。`
    );
    const done = await result.complete();
    return { answer: done.text ?? '' };
  },
}));
