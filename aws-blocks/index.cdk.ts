import * as cdk from 'aws-cdk-lib';
import { RemovalPolicies, Mixins } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';

import { Hosting, BlocksStack, SandboxDisableDeletionProtection } from '@aws-blocks/blocks/cdk';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSandboxId } from './scripts/sandbox-id.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new cdk.App();

const sandboxMode = app.node.tryGetContext('sandboxMode') === 'true';
const projectRoot = app.node.tryGetContext('projectRoot') || process.cwd();

const stackName = sandboxMode
  ? `mini-support-desk-stack-${getSandboxId(projectRoot)}`
  : 'mini-support-desk-stack-prod';
export const blocksStack = await BlocksStack.create(app, stackName, {
  backendHandlerPath: join(__dirname, 'index.handler.ts'),
  backendCDKPath: join(__dirname, 'index.ts')
});

// ─── CDK layer: 重要チケット処理（SQS + Step Functions） ───────────────────────
// 考え方: ① リソースを作る → ② Blocks の Lambda(blocksStack.handler) に権限を渡す
//        → ③ 環境変数で ARN/URL を渡す
// （実 AWS での動作確認は sandbox。ローカルモックには対応物がない）

// ① SQS Queue
const triageQueue = new sqs.Queue(blocksStack, 'TriageQueue', {
  visibilityTimeout: cdk.Duration.seconds(60),
});

// ① Step Functions（3 ステップの簡単なワークフロー）
const validate = new sfn.Pass(blocksStack, 'Validate');
const markTriage = new sfn.Pass(blocksStack, 'MarkTriageRequired', {
  result: sfn.Result.fromObject({ status: 'triage_required' }),
});
const notify = new sfn.Pass(blocksStack, 'SendNotification');
const triageWorkflow = new sfn.StateMachine(blocksStack, 'TriageWorkflow', {
  definitionBody: sfn.DefinitionBody.fromChainable(validate.next(markTriage).next(notify)),
});

// SQS → Step Functions を EventBridge Pipes でつなぐ
const pipeRole = new iam.Role(blocksStack, 'TriagePipeRole', {
  assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
});
triageQueue.grantConsumeMessages(pipeRole);
triageWorkflow.grantStartExecution(pipeRole);
new pipes.CfnPipe(blocksStack, 'TriagePipe', {
  roleArn: pipeRole.roleArn,
  source: triageQueue.queueArn,
  target: triageWorkflow.stateMachineArn,
  targetParameters: {
    stepFunctionStateMachineParameters: { invocationType: 'FIRE_AND_FORGET' },
  },
});

// ② Blocks の Lambda に SQS 送信権限を渡す / ③ 環境変数で Queue URL を渡す
triageQueue.grantSendMessages(blocksStack.handler);
blocksStack.handler.addEnvironment('TRIAGE_QUEUE_URL', triageQueue.queueUrl);

// ─── CDK layer: 運用アラート（CloudWatch Alarm + SNS） ────────────────────────
const alertTopic = new sns.Topic(blocksStack, 'OpsAlerts');
alertTopic.addSubscription(new subs.EmailSubscription('ops@example.com'));

const failedAlarm = new cw.Alarm(blocksStack, 'TriageWorkflowFailed', {
  metric: triageWorkflow.metricFailed({ period: cdk.Duration.minutes(5) }),
  threshold: 1,
  evaluationPeriods: 1,
  comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
});
failedAlarm.addAlarmAction(new cwActions.SnsAction(alertTopic));

if (sandboxMode) {
  // sandbox:destroy で全リソースを削除できるよう、削除保護を外す（追加分も含む）
  RemovalPolicies.of(blocksStack).destroy();
  Mixins.of(blocksStack).apply(new SandboxDisableDeletionProtection());

  // フロントは localhost、API は API Gateway（別ドメイン）のため cross-domain cookie 化
  blocksStack.handler.addEnvironment('BLOCKS_SANDBOX', 'true');
}

// 本番デプロイ時のみ静的サイトホスティングを追加
if (!sandboxMode) {
  new Hosting(blocksStack, 'Hosting', {
    root: join(__dirname, '..'),
    buildCommand: 'npm run build',
    buildOutputDir: 'dist',
    api: blocksStack
  });
}
