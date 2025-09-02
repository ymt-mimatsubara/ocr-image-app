// amplify/backend.ts（完成版）
import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { processImageOcr } from "./functions/ocr/resource";  // Lambda関数をインポート
import * as iam from "aws-cdk-lib/aws-iam";  // AWS IAM（権限管理）ライブラリ

// ============================================================================
// 【1. バックエンドリソースの統合】
// 各機能を組み合わせて完全なバックエンドシステムを構築
// Day1で学習したbackend.tsの発展版
// ============================================================================

const backend = defineBackend({
  auth,           // 認証機能（Day1で実装）
  data,           // データベース機能（今回実装）
  storage,        // ストレージ機能（Day1で実装、今回トリガー追加）
  processImageOcr, // Lambda関数（今回実装）
});

// ============================================================================
// 【2. Lambda関数への権限付与】
// 最小権限の原則に基づいて、必要な権限のみを付与
// ============================================================================

// Lambda関数のインスタンスを取得
const processImageOcrLambda = backend.processImageOcr.resources.lambda;

// ============================================================================
// 【3. S3読み取り権限の追加】
// Lambda関数がS3からファイルをダウンロードできるようにする
// ============================================================================
const s3Statement = new iam.PolicyStatement({
  // 許可する操作：S3からファイルを読み取り
  actions: ["s3:GetObject"],
  // 対象リソース：作成されたS3バケット内のすべてのファイル
  resources: [backend.storage.resources.bucket.bucketArn + "/*"],
});
processImageOcrLambda.addToRolePolicy(s3Statement);

// ============================================================================
// 【4. Bedrock実行権限の追加】
// Lambda関数がBedrockのAIモデルを実行できるようにする
// Day2で学習したBedrock機能をLambda関数から使用
// ============================================================================
const bedrockStatement = new iam.PolicyStatement({
  // 許可する操作：Bedrockモデルの実行
  actions: ["bedrock:InvokeModel"],
  // 対象リソース：すべてのBedrockモデル
  resources: ["*"],
});
processImageOcrLambda.addToRolePolicy(bedrockStatement);

// ============================================================================
// 【5. Cognito設定のカスタマイズ】
// Day1で設定したCognito認証の調整
// ============================================================================
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.usernameAttributes = []; // ユーザー名属性の設定
