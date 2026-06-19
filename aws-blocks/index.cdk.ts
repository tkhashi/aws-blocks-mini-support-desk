// CDK layer 定義
// 各章で段階的に実装が追加されます
// 考え方: リソースを作る → 権限を渡す → 環境変数で ARN/URL を渡す

import { Stack } from 'aws-cdk-lib';

// Ch.10: SQS Queue を追加予定
// Ch.10: Step Functions StateMachine を追加予定
// Ch.12: SNS Topic を追加予定
// Ch.12: CloudWatch Alarm を追加予定
// Ch.12: CloudWatch Logs MetricFilter を追加予定
// Ch.13: Pipeline を追加予定

export function extendStack(_stack: Stack): void {
  // CDK layer の実装はここに追加
}
