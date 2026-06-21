// CI/CD パイプライン定義（Blocks Pipeline = CDK Pipelines ベース）
//
// 本編では `cdk synth` までで定義の妥当性を確認できる（AWS 不要）。
// 実際に AWS 上で動かすにはオプション扱い:
//   1. CodeConnections で GitHub 接続を作成し ARN を CODECONNECTIONS_ARN に設定
//   2. CODECONNECTIONS_ARN=... npx cdk deploy --app "npx tsx aws-blocks/pipeline.cdk.ts"
//   3. main に push → synth → staging → (手動承認) → production
import * as cdk from 'aws-cdk-lib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pipeline, BlocksStack, Hosting } from '@aws-blocks/blocks/cdk';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new cdk.App();
const pipelineStack = new cdk.Stack(app, 'mini-support-desk-pipeline');

await Pipeline.create(pipelineStack, 'Pipeline', {
  // ① ソース: GitHub リポジトリ + CodeConnections の ARN
  source: {
    repo: 'tkhashi/aws-blocks-mini-support-desk',
    connectionArn: process.env.CODECONNECTIONS_ARN ?? 'arn:aws:codeconnections:REGION:ACCOUNT:connection/REPLACE_ME',
  },
  // ② ブランチごとのパイプライン。main は staging → production（本番前に手動承認）
  branches: [
    {
      branch: 'main',
      stages: [
        { name: 'staging' },
        { name: 'production', requireApproval: true },
      ],
    },
  ],
  // ③ 各ステージにデプロイするスタック
  stageFactory: async (stage, stageConfig) => {
    const stack = await BlocksStack.create(stage, 'App', {
      backendHandlerPath: join(__dirname, 'index.handler.ts'),
      backendCDKPath: join(__dirname, 'index.ts'),
      stackName: `mini-support-desk-${stageConfig.name}`,
    });
    new Hosting(stack, 'Hosting', {
      root: join(__dirname, '..'),
      buildCommand: 'npm run build',
      buildOutputDir: 'dist',
      api: stack,
    });
  },
});
