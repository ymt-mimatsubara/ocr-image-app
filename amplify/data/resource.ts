// amplify/data/resource.ts（完成版）
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { processImageOcr } from "../functions/ocr/resource";  // Lambda関数をインポート

// ============================================================================
// 【1. データベーススキーマ定義】
// DynamoDBのテーブル構造をTypeScriptで定義します
// ============================================================================

const schema = a
  .schema({
    OrderHeader: a
      .model({
        // 注文番号
        orderId: a.string().required(),

        // 注文日（yyyy-MM-dd形式）
        orderDate: a.date(),

        // 小計金額（数値）
        subtotal: a.integer(),

        // 送料（数値）
        shippingFee: a.integer(),

        // 合計金額（数値）
        totalAmount: a.integer(),

        // カテゴリ
        category: a.string(),

        // ドキュメント名（ファイル名）
        // 例：'receipt-2024-01-15.jpg'
        documentName: a.string().required(),

        // S3上のファイルパス
        // 例：'media/receipt.jpg'
        documentUri: a.string().required(),

        // OCRで抽出したテキスト（JSON形式で柔軟に保存）
        // 例：'{"ocrText": "抽出されたテキスト", "bucket": "my-bucket"}'
        content: a.json(),

        // リレーション
        orderDetails: a.hasMany('OrderDetail', 'orderHeaderId'),
      })
      // 主キーを指定
      .identifier(["orderId"])
      // ログインユーザーのみアクセス可能
      .authorization((allow) => [allow.authenticated()]),

    OrderDetail: a
      .model({
        // 商品ID(自動生成)
        itemId: a.string().required(),

        // 商品名
        productName: a.string().required(),

        // 単価
        unitPrice: a.integer(),

        // 数量
        quantity: a.integer(),

        // 小計
        subtotal: a.integer(),

        // リレーション（型をidに変更）
        orderHeaderId: a.string().required(),
        orderHeader: a.belongsTo('OrderHeader', 'orderHeaderId'),

      })
      .identifier(["itemId"])
      .authorization((allow) => [allow.authenticated(), allow.publicApiKey()]),
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
    apiKeyAuthorizationMode: {  // 追加
      expiresInDays: 30,
    },
  },
});
