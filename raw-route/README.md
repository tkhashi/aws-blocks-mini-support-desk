# aws-blocks-mini-support-desk — RawRoute 版

[アプリエンジニアのための AWS Blocks ハンズオン](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk) のサンプルアプリ（**RawRoute 版**）です。

> [!NOTE]
> **これは API を `ApiNamespace`（JSON-RPC）ではなく `RawRoute`（生 HTTP ルート）で実装した版です。** リポジトリには独立した 2 版があり、このディレクトリ（`raw-route/`）はそのうちの片方です。Book のおまけ章「JSON-RPC ではなく RawRoute で実装する」に対応します。
>
> - [`api-namespace/`](../api-namespace/): `export const api = new ApiNamespace(...)` ＋ `<Authenticator>` ＋ `import { api } from 'aws-blocks'`（型安全な RPC・本編）
> - `raw-route/`（このディレクトリ）: `new RawRoute(scope, id, { method, path, handler })` ＋ 自前フォーム ＋ 素の `fetch`（生 HTTP・セッション Cookie 認証）
>
> 2 版は型情報もデータも共有しない独立プロジェクトです。それぞれのディレクトリ内で `npm install` / `npm run dev` してください。同一ポート（:3000 / :3001）を使うため、**同時には起動しないでください**。

## 概要

Mini Support Desk は、AWS Blocks を使って構築するサポートデスクアプリです。
ユーザーが問い合わせチケットを作成し、添付ファイルを付け、必要に応じて AI による回答案を生成できます。

**この版ではバックエンドを `RawRoute`（生 HTTP ルート）で実装**しています。認証も `auth.createApi()` / `<Authenticator>` を使わず、`AuthCognito` のメソッド（`signIn` 等）を RawRoute から直接呼び、セッション Cookie（HttpOnly）で保護します。フロントエンドは型安全なクライアントの代わりに素の `fetch`（`credentials: 'include'`）で各エンドポイントを呼びます。Block の構成自体は `api-namespace/` 版と同じです。

### RawRoute エンドポイント一覧

| メソッド・パス | 役割 |
|---|---|
| `POST /auth/sign-up` `/auth/confirm` `/auth/sign-in` `/auth/sign-out` | 認証フロー（Cookie 発行・破棄） |
| `GET /auth/me` | 現在のユーザー（未ログインは `user: null`） |
| `POST /tickets` `GET /tickets` `GET /tickets/{id}` `POST /tickets/{id}/close` | チケット CRUD |
| `POST /tickets/{id}/draft-answer` | AI 回答案（ローカルは canned） |
| `POST /attachments/upload-url` `GET /attachments/download-url?key=` | 添付の presigned URL |
| `GET /search?q=` | KnowledgeBase 検索 |
| `GET /export/tickets.csv` | CSV エクスポート（`text/csv` の非 JSON ダウンロード） |

## スタック

- **フロントエンド**: React + Vite + TypeScript
- **バックエンド**: AWS Blocks（`RawRoute` / `AuthCognito` / `Database` / `FileBucket` / `Logger` / `Metrics` / `AsyncJob` / `CronJob` / `EmailClient` / `KnowledgeBase` / `Agent`）
- **インフラ拡張**: CDK layer（SQS / Step Functions / EventBridge Pipes / SNS / CloudWatch Alarm）、Pipeline（CodePipeline）

## ディレクトリ構成

```
├── src/                       # フロントエンド（React + Vite）
│   ├── App.tsx                # 認証ゲート + 画面遷移（GET /auth/me で判定）
│   ├── api.ts                 # RawRoute を叩く fetch クライアント
│   ├── main.tsx
│   └── pages/                 # Login（自前フォーム）/ TicketList / TicketCreate / TicketDetail
├── aws-blocks/
│   ├── index.ts               # Blocks バックエンド定義（RawRoute で API を公開）
│   ├── index.cdk.ts           # CDK スタック + CDK layer（SQS/SF/SNS/Alarm）
│   ├── pipeline.cdk.ts        # CI/CD パイプライン定義
│   ├── index.handler.ts       # Lambda ハンドラ（自動生成）
│   └── migrations/            # PostgreSQL マイグレーション（001〜003）
├── shared/
│   └── types.ts               # 共通型定義（Ticket 等）
└── docs/
    └── knowledge-base/        # Bedrock RAG 用参照ドキュメント
```

## 検証環境

このサンプルと Book は次の環境を前提にしています。AWS Blocks は Preview のため、最新バージョンでは API や生成テンプレートが変わる可能性があります。再現性のため、`@aws-blocks/blocks` は `package-lock.json` に固定したバージョンを基準にしてください。

- **Node.js**: 22.x（`>=22.0.0`）
- **npm**: 10.x 以上（`>=10.0.0`）
- **AWS Blocks**: `package-lock.json` に固定（検証時点で `@aws-blocks/blocks@0.1.2`）
- **AWS CLI**: v2（sandbox / Pipeline を実 AWS で動かす場合）
- **AWS CDK**: `package.json` / lockfile のバージョン（`aws-cdk-lib@2.260.0`）

## ローカル起動（AWS アカウント不要）

```bash
node --version   # v22 以上
npm --version    # 10 以上
npm install
npm run dev      # フロント http://localhost:3000 / API http://localhost:3001
```

すべての Block がローカルモックで動きます。サインアップ時の確認コードは `npm run dev` のターミナルに出力されます（`[auth] ... の確認コード: 123456`）。データは `.bb-data/` に保存され、削除でリセットできます。

## 検証状況

| 範囲 | 状態 |
|---|---|
| RawRoute API（Cookie 認証フロー・チケット CRUD・添付・検索・draft-answer[canned]・CSV エクスポート・401 ガード） | ✅ ローカルモックで動作確認済み（curl で全エンドポイント疎通） |
| フロントエンド（4ページ・自前認証フォーム・CSV ダウンロード） | ✅ `tsc` で型確認（vite proxy 経由で API へ） |
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

## 参照

- [AWS Blocks Developer Guide](https://docs.aws.amazon.com/blocks/latest/devguide/what-is-blocks.html)
- [Getting started with AWS Blocks](https://docs.aws.amazon.com/blocks/latest/devguide/getting-started.html)
- [Deploy your application to AWS](https://docs.aws.amazon.com/blocks/latest/devguide/deploy-to-aws.html)
- [AWS Blocks concepts](https://docs.aws.amazon.com/blocks/latest/devguide/concepts.html)
- [AWS Blocks GitHub Repository](https://github.com/aws-devtools-labs/aws-blocks)
- [create-blocks-app README](https://github.com/aws-devtools-labs/aws-blocks/blob/main/packages/create-blocks-app/README.md)

## 関連リンク

- [Zenn Book](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk)
