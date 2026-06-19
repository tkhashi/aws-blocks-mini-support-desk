# aws-blocks-mini-support-desk

[アプリエンジニアのための AWS Blocks ハンズオン](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk) のサンプルアプリです。

## 概要

Mini Support Desk は、AWS Blocks を使って段階的に構築するサポートデスクアプリです。  
本リポジトリには各章で完成するコードが含まれています。

## スタック

- **フロントエンド**: React + Vite + TypeScript
- **バックエンド**: AWS Blocks（ApiNamespace, Database, FileBucket, AsyncJob 等）
- **インフラ**: CDK layer（SQS, Step Functions, CloudWatch, SNS）

## ディレクトリ構成

```
├── src/                    # フロントエンド（React + Vite）
│   ├── App.tsx
│   ├── main.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── TicketListPage.tsx
│       ├── TicketCreatePage.tsx
│       └── TicketDetailPage.tsx
├── aws-blocks/
│   ├── index.ts            # Blocks バックエンド定義
│   └── index.cdk.ts        # CDK layer 定義
├── shared/
│   └── types.ts            # 共通型定義
└── docs/
    └── knowledge-base/     # Bedrock RAG 用参照ドキュメント
```

## 各章との対応

| 章 | 追加される主な実装 |
|---|---|
| Ch.02 | プロジェクト初期構成 |
| Ch.03 | AuthCognito |
| Ch.04 | Database（tickets テーブル）|
| Ch.05 | FileBucket |
| Ch.06 | Logger / Metrics / Dashboard |
| Ch.07 | AsyncJob（notification_logs テーブル）|
| Ch.08 | CronJob |
| Ch.09 | EmailClient |
| Ch.10 | SQS + Step Functions（workflow_logs テーブル）|
| Ch.15-17 | KnowledgeBase / Agent（docs/knowledge-base/）|

## ローカル起動

```bash
npm install
npm run dev
```

## 関連リンク

- [Zenn Book](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk)
- [AWS Blocks ドキュメント](https://blocks.aws.dev/)
