// amplify/data/resource.ts（完成版）
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { processImageOcr } from "../functions/ocr/resource";  // Lambda関数をインポート

// ============================================================================
// 【1. データベーススキーマ定義】
// DynamoDBのテーブル構造をTypeScriptで定義します
// ============================================================================

const schema = a
  .schema({
    OcrData: a
      .model({
        // ドキュメントの一意識別子（自動生成）
        documentid: a.id(),
        
        // ドキュメント名（ファイル名）
        // 例：'receipt-2024-01-15.jpg'
        documentname: a.string().required(),
        
        // S3上のファイルパス
        // 例：'media/receipt.jpg'
        documenturi: a.string().required(),
        
        // OCRで抽出したテキスト（JSON形式で柔軟に保存）
        // 例：'{"ocrText": "抽出されたテキスト", "bucket": "my-bucket"}'
        content: a.json(),
      })
      // ログインユーザーのみアクセス可能
      .authorization((allow) => [allow.authenticated()]),

// ============================================================================
// 課題用のモデルは以下に追加してください。
// ============================================================================
    // UploadHistory: a
    //   .model({
    //     // ID（自動生成）
    //     historyid: a.id(),
        
    //     // ファイル名
    //     upfilenam: a.string().required(),
        
    //     // ファイルサイズ
    //     upfilesize: a.float(),
    //   })
    //   // ログインユーザーのみアクセス可能
    //   .authorization((allow) => [allow.authenticated()]),


// ============================================================================
  })
  // Lambda関数からのアクセスを許可
  // processImageOcr関数がデータベースに結果を保存できるようにする（スキーマ全体で許可をする）
  .authorization((allow) => [
    allow.resource(processImageOcr).to(["query", "mutate"]),
  ]);

// ============================================================================
// 【2. 型定義のエクスポート】
// フロントエンドで使用するTypeScript型を自動生成
// ============================================================================
export type Schema = ClientSchema<typeof schema>;

// ============================================================================
// 【3. データベース設定】
// 認証方式とスキーマを統合
// ============================================================================
export const data = defineData({
  schema,
  authorizationModes: {
    // Cognito認証を使用（Day1で学習）
    defaultAuthorizationMode: "userPool",
  },
});
