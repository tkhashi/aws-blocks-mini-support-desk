# aws-blocks-mini-support-desk

[アプリエンジニアのための AWS Blocks ハンズオン](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk) のサンプルアプリです。

このリポジトリには、**同じ Mini Support Desk を 2 通りの API 実装で作った、独立した 2 つのプロジェクト**が含まれています。

| ディレクトリ | API の実装 | 対応する章 |
|---|---|---|
| [`api-namespace/`](./api-namespace/) | `ApiNamespace`（JSON-RPC・`import { api } from 'aws-blocks'` で型安全に呼ぶ） | 本編（01〜08章） |
| [`raw-route/`](./raw-route/) | `RawRoute`（生 HTTP ルート・素の `fetch` で呼ぶ・セッション Cookie 認証） | おまけ（09章） |

両者は **型情報もデータも一切共有しない、それぞれ単体で完結する独立プロジェクト**です（`shared/types.ts` などもディレクトリごとに別のコピーを持ちます）。ルートには npm workspaces などの共有設定はありません。

## 使い方

どちらかのディレクトリに入って、その中で操作します。

```bash
# ApiNamespace 版（本編）
cd api-namespace
npm install
npm run dev      # フロント http://localhost:3000 / API http://localhost:3001

# RawRoute 版（おまけ）
cd raw-route
npm install
npm run dev      # フロント http://localhost:3000 / API http://localhost:3001
```

> [!IMPORTANT]
> 2 版は同じポート（:3000 / :3001）を使うため、**同時には起動しないでください**。片方を止めてからもう片方を起動します。

各バージョンの詳細（エンドポイント・検証状況・AWS デプロイ手順など）は、それぞれの README を参照してください。

- [`api-namespace/README.md`](./api-namespace/README.md)
- [`raw-route/README.md`](./raw-route/README.md)

## どちらを読むべきか

- まずは **`api-namespace/`（本編）** から。AWS Blocks 標準の型安全な API（`ApiNamespace`）でアプリを組み立てます。
- 余裕があれば **`raw-route/`（おまけ）** で、同じ API を生 HTTP（`RawRoute`）で実装し直すとどう変わるか（型安全 vs HTTP 制御の使い分け）を確認できます。

## 関連リンク

- [Zenn Book](https://zenn.dev/tkhashi/books/aws-blocks-mini-support-desk)
