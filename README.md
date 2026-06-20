# aws-blocks-mini-support-desk

[アプリエンジニアのための AWS Blocks ハンズオン](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk) のサンプルアプリです。

## 概要

Mini Support Desk は、AWS Blocks を使って構築するサポートデスクアプリです。
ユーザーが問い合わせチケットを作成し、添付ファイルを付け、必要に応じて AI による回答案を生成できます。

**バックエンドは AWS Blocks 標準の `ApiNamespace` で実装**しています。フロントエンドは型安全なクライアント（`import { api } from 'aws-blocks'`）から API を呼びます。

## スタック

- **フロントエンド**: React + Vite + TypeScript
- **バックエンド**: AWS Blocks（`ApiNamespace` / `AuthCognito` / `Database` / `FileBucket` / `Logger` / `Metrics` / `AsyncJob` / `CronJob` / `EmailClient` / `KnowledgeBase` / `Agent`）
- **インフラ拡張**: CDK layer（SQS / Step Functions / EventBridge Pipes / SNS / CloudWatch Alarm）、Pipeline（CodePipeline）

## ディレクトリ構成

```
├── src/                       # フロントエンド（React + Vite）
│   ├── App.tsx                # 認証ゲート + 画面遷移
│   ├── main.tsx
│   └── pages/                 # Login / TicketList / TicketCreate / TicketDetail
├── aws-blocks/
│   ├── index.ts               # Blocks バックエンド定義（API 本体）
│   ├── index.cdk.ts           # CDK スタック + CDK layer（SQS/SF/SNS/Alarm）
│   ├── pipeline.cdk.ts        # CI/CD パイプライン定義
│   ├── index.handler.ts       # Lambda ハンドラ（自動生成）
│   └── migrations/            # PostgreSQL マイグレーション（001〜003）
├── shared/
│   └── types.ts               # 共通型定義（Ticket 等）
└── docs/
    └── knowledge-base/        # Bedrock RAG 用参照ドキュメント
```

## ローカル起動（AWS アカウント不要）

```bash
npm install
npm run dev      # フロント http://localhost:3000 / API http://localhost:3001
```

すべての Block がローカルモックで動きます。サインアップ時の確認コードは `npm run dev` のターミナルに出力されます（`[auth] ... の確認コード: 123456`）。データは `.bb-data/` に保存され、削除でリセットできます。

## 検証状況

| 範囲 | 状態 |
|---|---|
| バックエンド（認証・DB・ファイル・観測・AsyncJob・CronJob・Email・KB・Agent[canned]） | ✅ ローカルモックで動作確認済み |
| フロントエンド（4ページ） | ✅ `vite build` で型・ビルド確認 |
| CDK layer（SQS / Step Functions / SNS / Alarm） | ⚠ コードのみ。実 AWS（`npm run sandbox`）での動作は未検証 |
| Pipeline（`aws-blocks/pipeline.cdk.ts`） | ⚠ コードのみ。`cdk synth` / 実デプロイは未検証 |
| Bedrock 実行（KnowledgeBase 埋め込み / Agent 実モデル） | ⚠ sandbox（実 Bedrock）での動作は未検証 |
| Ollama（`Agent` の `model.local`） | ⚠ 未検証。Ollama 未起動時は canned へ自動フォールバック |

> ⚠ 印は AWS アカウント・課金が必要、もしくは外部依存があり、ローカルモックだけでは確認できない部分です。

## AWS で動かす（任意・課金あり）

```bash
npm run sandbox          # 実 AWS にデプロイして検証
npm run sandbox:destroy  # 後片付け（必ず実行）
```

CDK layer / Pipeline / Bedrock は、この sandbox 環境で確認します。Aurora など起動中に課金されるリソースがあるため、確認後は必ず `sandbox:destroy` で削除してください。

## 関連リンク

- [Zenn Book](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk)
