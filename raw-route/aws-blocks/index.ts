// AWS Blocks バックエンド定義 — Mini Support Desk（RawRoute 版）
//
// これは「API を ApiNamespace（JSON-RPC）ではなく RawRoute（生 HTTP ルート）で
// 実装し直した別バージョン」です。Block の構成（AuthCognito / Database /
// FileBucket / Logger / Metrics / AsyncJob / CronJob / EmailClient /
// KnowledgeBase / Agent）は main ブランチと同じで、API の公開方法だけが異なります。
//
//  - main:               export const api = new ApiNamespace(...)  ← JSON-RPC
//  - このブランチ:        new RawRoute(scope, id, { method, path, handler })  ← 生 HTTP
//
// すべて `npm run dev` のローカルモックで動作します（AWS アカウント不要）。
import {
  RawRoute, Scope, AuthCognito, Database, sql, FileBucket, Logger, Metrics,
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
// ※ main の `auth.createApi()` / `<Authenticator>` は使わない。
//    代わりに下の RawRoute（/auth/*）が AuthCognito のメソッドを直接呼ぶ。

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

// ════════════════════════════════════════════════════════════════════════════
//  API（RawRoute 版）
//
//  ApiNamespace と違い、RawRoute は HTTP メソッド・パス・ボディ・ステータス・
//  ヘッダを自前で扱う。`new RawRoute(...)` は構築するだけでルートを登録するので
//  export は不要。クライアントは素の `fetch` で叩く（型安全な自動配線はない）。
//
//  認証は ApiNamespace と同じく opt-in。各ハンドラ先頭で `auth.requireAuth(context)`
//  を呼ぶ。requireAuth が投げる 401 は RawRoute ディスパッチャが自動で HTTP 401 に
//  変換する。
// ════════════════════════════════════════════════════════════════════════════

// ─── 認証エンドポイント ───────────────────────────────────────────────────────
// AuthCognito のメソッドはセッション Cookie（HttpOnly）を自動で発行・破棄する。
// クライアントは fetch(..., { credentials: 'include' }) で Cookie を往復させる。

// サインアップ
new RawRoute(scope, 'auth-sign-up', {
  method: 'POST',
  path: '/auth/sign-up',
  handler: async (context) => {
    const { username, password } = await context.request.json();
    const result = await auth.signUp(username, password, { attributes: { email: username } }, context);
    context.response.send(result);
  },
});

// 確認コードの検証
new RawRoute(scope, 'auth-confirm', {
  method: 'POST',
  path: '/auth/confirm',
  handler: async (context) => {
    const { username, code } = await context.request.json();
    const result = await auth.confirmSignUp(username, code, context);
    context.response.send(result);
  },
});

// サインイン（成功すると Cookie を発行）
new RawRoute(scope, 'auth-sign-in', {
  method: 'POST',
  path: '/auth/sign-in',
  handler: async (context) => {
    const { username, password } = await context.request.json();
    const result = await auth.signIn(username, password, context);
    context.response.send(result);
  },
});

// サインアウト（Cookie を破棄）
new RawRoute(scope, 'auth-sign-out', {
  method: 'POST',
  path: '/auth/sign-out',
  handler: async (context) => {
    await auth.signOut(context);
    context.response.send({ ok: true });
  },
});

// 現在のユーザー（未ログインなら user: null）
new RawRoute(scope, 'auth-me', {
  method: 'GET',
  path: '/auth/me',
  handler: async (context) => {
    const user = await auth.getCurrentUser(context);
    context.response.send({ user });
  },
});

// ─── チケット ─────────────────────────────────────────────────────────────────

// 作成
new RawRoute(scope, 'tickets-create', {
  method: 'POST',
  path: '/tickets',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    const { title, body, priority = 'normal', attachmentKey } =
      (await context.request.json()) as { title: string; body: string; priority?: TicketPriority; attachmentKey?: string };
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

    const ticket = await db.queryOne<Ticket>(sql`SELECT * FROM tickets WHERE id = ${id}`);
    context.response.status = 201;
    context.response.send(ticket);
  },
});

// 一覧（自分のチケットのみ）
new RawRoute(scope, 'tickets-list', {
  method: 'GET',
  path: '/tickets',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    const tickets = await db.query<Ticket>(
      sql`SELECT * FROM tickets WHERE owner_sub = ${user.userSub} ORDER BY created_at DESC`
    );
    context.response.send(tickets);
  },
});

// 詳細（自分のチケットのみ）
new RawRoute(scope, 'tickets-get', {
  method: 'GET',
  path: '/tickets/{id}',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    const ticket = await db.queryOne<Ticket>(
      sql`SELECT * FROM tickets WHERE id = ${context.request.params.id} AND owner_sub = ${user.userSub}`
    );
    if (!ticket) {
      context.response.status = 404;
      context.response.send({ error: 'ticket not found' });
      return;
    }
    context.response.send(ticket);
  },
});

// クローズ
new RawRoute(scope, 'tickets-close', {
  method: 'POST',
  path: '/tickets/{id}/close',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    await db.execute(
      sql`UPDATE tickets SET status = 'closed', updated_at = now()
          WHERE id = ${context.request.params.id} AND owner_sub = ${user.userSub}`
    );
    context.response.send({ ok: true });
  },
});

// AI 回答案の生成
new RawRoute(scope, 'tickets-draft-answer', {
  method: 'POST',
  path: '/tickets/{id}/draft-answer',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    const ticket = await db.queryOne<Ticket>(
      sql`SELECT * FROM tickets WHERE id = ${context.request.params.id} AND owner_sub = ${user.userSub}`
    );
    if (!ticket) {
      context.response.status = 404;
      context.response.send({ error: 'ticket not found' });
      return;
    }
    const result = await agent.stream(
      `件名: ${ticket.title}\n本文: ${ticket.body}\nこの問い合わせへの回答案を作成してください。`
    );
    const done = await result.complete();
    context.response.send({ answer: done.text ?? '' });
  },
});

// ─── 添付ファイル ─────────────────────────────────────────────────────────────

// アップロード用 presigned URL
new RawRoute(scope, 'attachments-upload-url', {
  method: 'POST',
  path: '/attachments/upload-url',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    const { filename } = await context.request.json();
    const key = `${user.userSub}/${Date.now()}-${encodeURIComponent(filename)}`;
    const url = await attachments.putUrl(key, { expiresIn: 600 });
    context.response.send({ key, url });
  },
});

// ダウンロード用 presigned URL（key はクエリ文字列で受け取る）
new RawRoute(scope, 'attachments-download-url', {
  method: 'GET',
  path: '/attachments/download-url',
  handler: async (context) => {
    await auth.requireAuth(context);
    const key = context.request.url.searchParams.get('key') ?? '';
    context.response.send({ url: await attachments.getUrl(key, { expiresIn: 600 }) });
  },
});

// ─── ドキュメント検索（KnowledgeBase） ────────────────────────────────────────
// クエリは ?q=... で受け取る（RawRoute は GET + クエリ文字列が自然に書ける）。
new RawRoute(scope, 'search', {
  method: 'GET',
  path: '/search',
  handler: async (context) => {
    await auth.requireAuth(context);
    const query = context.request.url.searchParams.get('q') ?? '';
    const results = await kb.retrieve(query, { maxResults: 3 });
    context.response.send(results);
  },
});

// ─── CSV エクスポート ─────────────────────────────────────────────────────────
// RawRoute ならではの例: JSON-RPC では返しにくい「非 JSON のファイルダウンロード」。
// Content-Type と Content-Disposition を自分で設定して text/csv を返す。
new RawRoute(scope, 'export-tickets-csv', {
  method: 'GET',
  path: '/export/tickets.csv',
  handler: async (context) => {
    const user = await auth.requireAuth(context);
    const tickets = await db.query<Ticket>(
      sql`SELECT * FROM tickets WHERE owner_sub = ${user.userSub} ORDER BY created_at DESC`
    );
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['id', 'title', 'status', 'priority', 'created_at'];
    const rows = tickets.map((t) => [t.id, t.title, t.status, t.priority, t.created_at].map(escape).join(','));
    const csv = [header.join(','), ...rows].join('\n');

    context.response.headers.set('Content-Type', 'text/csv; charset=utf-8');
    context.response.headers.set('Content-Disposition', 'attachment; filename="tickets.csv"');
    context.response.send(csv);
  },
});
