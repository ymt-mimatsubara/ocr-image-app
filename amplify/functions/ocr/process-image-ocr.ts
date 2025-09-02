// amplify/functions/ocr/process-image-ocr.ts（完成版）

// ============================================================================
// 【1. 必要なライブラリのインポート】
// ============================================================================

import { S3Event } from 'aws-lambda';  // S3イベントの型定義
import { Amplify } from 'aws-amplify';  // Amplifyクライアント
import { generateClient } from 'aws-amplify/data';  // データベースクライアント
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';  // 設定取得
import { env } from '$amplify/env/processImageOcr';  // 環境変数
import type { Schema } from '../../data/resource';  // データベーススキーマ
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';  // S3操作用
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';  // Bedrock操作用
import { Category } from '@mui/icons-material';

// ============================================================================
// 【2. 型定義】
// TypeScriptで安全なコードを書くための型定義
// ============================================================================

// S3にアップロードされたファイルの情報
interface UploadedFile {
  bucket: string;  // どのS3バケットか
  key: string;     // ファイルのパス
  size: number;    // ファイルサイズ
}

interface OrderData {
  orderHeader: {
    orderId: string;
    orderDate: string;
    subtotal: number;
    shippingFee: number;
    totalAmount: number;
    category: string;
  };
  orderDetails: Array<{
    itemId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
}

// ============================================================================
// 【3. AI設定】
// Day2で学習したBedrock設定の実践応用
// ============================================================================

// AIモデルの設定
const AI_SETTINGS = {
  // 使用するClaudeモデル（最新のSonnet-4モデル）
  modelName: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
  // Bedrockが利用可能なリージョン
  region: 'ap-northeast-1',
  // 最大出力トークン数
  maxTokens: 6000,
  // 温度設定（創造性の制御）
  temperature: 0,
  // トップP設定（語彙選択の制御）
  topP: 0.1,
  // トップK設定
  topK: 250,
  // Anthropic APIのバージョン（変更しない）
  version: 'bedrock-2023-05-31'
};

// ============================================================================
// 【4. AIプロンプト設定】
// 課題では以下にプロンプトを追加してください。
// ============================================================================

// AIに送る指示（Day2で学習したプロンプト設計）
const AI_INSTRUCTION = `
あなたは日本語の注文書画像から情報を正確に抽出するAIアシスタントです。

以下の画像から注文情報を読み取り、DynamoDB用のJSON形式で出力してください。

**重要：JSONのみを出力し、\`\`\`json\`\`\`などのマークダウン記法は使用しないでください。**

**出力形式：**

{
  "orderHeader": {
    "orderId": "注文番号",
    "orderDate": "注文日（YYYY-MM-DD形式）",
    "subtotal": "小計金額（数値のみ、引用符なし）",
    "shippingFee": "送料（数値のみ、引用符なし）",
    "totalAmount": "合計金額（数値のみ、引用符なし）",
    "category": "カテゴリ（カテゴリルールは下記に記載する）",
  },
  "orderDetails": [
    {
      "itemId": "商品ID（自動生成）",
      "productName": "商品名",
      "unitPrice": "単価（数値のみ、引用符なし）",
      "quantity": "数量（数値のみ、引用符なし）",
      "subtotal": "小計（数値のみ、引用符なし）"
    }
  ]
}

**重要：数値フィールドは引用符で囲まず、純粋な数値として出力してください**
例：正しい → "subtotal": 3150
例：間違い → "subtotal": "3150"

**抽出ルール：**
1.注文日時の読み取り：「ご注文日」の項目を慎重に確認し、年月日と時刻を正確に読み取る
2.商品名の読み取り（重要）：
  ・各商品画像の右側に表示されている商品名テキストを段落ごとに読み取る
  ・商品名は複数行にわたって記載されている場合があるため、改行も含めて全文を読み取る
  ・【】や[]などの括弧内の文字も一字一句漏らさず転写する
  ・英数字、日本語、記号すべてを正確に読み取る
  ・商品名の最初から最後まで完全に読み取ってから次の商品に進む
3.金額は¥マークやカンマを除いた数値のみを抽出
4.日付は西暦4桁-月2桁-日2桁の形式で統一（例：2024年8月31日 → 2024-08-31）
5.商品が複数ある場合はorderDetails配列に全て含める
6.itemIdは各商品に対して「注文番号+001」「注文番号+ITEM_002」のような形式で自動生成
（注文番号が「sxfn-243266」の場合の例：「sxfn-243266_001」「sxfn-243266_002」）
7.読み取れない項目は空文字またはnullを設定
8.日本語の商品名はそのまま保持

**商品名読み取りの手順：**
1.商品画像を特定する
2.その商品画像の右側にある商品名テキスト領域を特定する
3.商品名の開始位置から終了位置まで、文字を一つずつ確認する
4.複数行にわたる場合は、各行を順番に読み取る
5.読み取った内容を再度確認してから次の商品に進む

**注意事項：**
・画像の解像度が低い場合でも、文字の形状から推測して正確に読み取ってください
・商品名の途中で切れている場合は、見える範囲で正確に転写してください
・似ている文字（例：ロとロ、ニと二）を間違えないよう注意してください
・商品名に含まれるスペースや改行も正確に反映してください

**カテゴリルール：**
・注文番号で判断すること
  1.「#」で始まる場合、カテゴリは「ホロライブ」にすること
  2.「SN」で始まる場合、カテゴリは「にじさんじ」にすること
  3.「sxfn」で始まる場合、カテゴリは「SIXFONIA」にすること
  4.上記のどれも当てはまらない場合、カテゴリは「その他」にすること

画像を解析して、上記の形式で正確にJSON出力してください。JSONのみを出力し、他の説明は不要です。
`.trim();

// ============================================================================
// 【5. ユーティリティ関数】
// 大きな処理を小さな関数に分けて理解しやすくする
// ============================================================================

/**
 * S3から画像をダウンロードする関数
 * 
 * @param s3Client - S3操作用のクライアント
 * @param bucket - S3バケット名
 * @param filePath - ファイルのパス
 * @returns ダウンロードした画像データ（Buffer形式）
 */
async function downloadImageFromS3(s3Client: S3Client, bucket: string, filePath: string): Promise<Buffer> {
  console.log(`📥 S3から画像をダウンロード中: ${filePath}`);

  // S3からファイルを取得するコマンドを作成
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: filePath
  });

  // S3にリクエストを送信してファイルを取得
  const response = await s3Client.send(command);

  // レスポンスのBodyをBuffer（バイナリデータ）に変換
  const imageBuffer = Buffer.from(await response.Body!.transformToByteArray());

  console.log(`✅ ダウンロード完了: ${imageBuffer.length} バイト`);
  return imageBuffer;
}

/**
 * AIを使って画像からテキストを抽出する関数
 * Day2で学習したBedrock呼び出しの実践応用
 * 
 * @param aiClient - Bedrock操作用のクライアント
 * @param imageData - 画像データ（Buffer形式）
 * @returns 抽出されたテキスト
 */
// async function extractTextFromImage(aiClient: BedrockRuntimeClient, imageData: Buffer): Promise<{ text: string }> {
async function extractOrderFromImage(aiClient: BedrockRuntimeClient, imageData: Buffer): Promise<OrderData> {
  console.log(`🤖 AI注文情報抽出処理を開始...`);

  // ============================================================================
  // 【5-1. Base64エンコード】
  // バイナリデータを文字列に変換（API送信のため）
  // ============================================================================
  const base64Image = imageData.toString('base64');

  // ============================================================================
  // 【5-2. Bedrock APIリクエストの構築】
  // Day2で学習したBedrock API呼び出し形式
  // ============================================================================
  const requestData = {
    anthropic_version: AI_SETTINGS.version,
    max_tokens: AI_SETTINGS.maxTokens,
    temperature: AI_SETTINGS.temperature,
    top_p: AI_SETTINGS.topP,
    top_k: AI_SETTINGS.topK,
    // システムプロンプト：AIの役割を定義
    system: 'あなたは注文書画像から構造化データを抽出する専門家です。正確なJSON形式で出力してください。',
    messages: [{
      role: 'user',
      content: [
        // テキスト指示
        { type: 'text', text: AI_INSTRUCTION },
        // 画像データ
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    }]
  };

  // ============================================================================
  // 【5-3. Bedrock API呼び出し】
  // ============================================================================
  const command = new InvokeModelCommand({
    modelId: AI_SETTINGS.modelName,
    body: JSON.stringify(requestData)
  });

  const response = await aiClient.send(command);
  const responseText = new TextDecoder().decode(response.body!);
  const responseData = JSON.parse(responseText);

  // ============================================================================
  // 【5-4. レスポンスからテキストを抽出】
  // ============================================================================
  const textContent = responseData.content.find(
    (item: any) => item.type === 'text'
  );

  console.log(`✅ 注文情報抽出完了`);
  console.log(`抽出されたテキスト: ${textContent.text}`);
  // return { text: textContent.text };

  // JSONを解析
  try {
    let jsonText = textContent.text.trim();

    // デバッグ用ログ
    console.log('解析前のテキスト:', jsonText);
    console.log('テキストの長さ:', jsonText.length);
    console.log('テキストの型:', typeof jsonText);

    // JSONブロック記法を除去
    if (jsonText.includes('```json')) {
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
    } else if (jsonText.includes('```')) {
      const jsonMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
    }

    // 空文字チェック
    if (!jsonText) {
      throw new Error('JSONテキストが空です。');
    }

    console.log('クリーニング後のJSON:', jsonText);

    const orderData = JSON.parse(jsonText);

    // ★★★ ここで文字列を数値に変換 ★★★
    const validatedOrderData = {
      orderHeader: {
        orderId: orderData.orderHeader?.orderId || `ORDER_${Date.now()}`,
        orderDate: orderData.orderHeader?.orderDate || new Date().toISOString().split('T')[0],
        subtotal: parseFloat(orderData.orderHeader?.subtotal) || 0,      // 文字列→数値変換
        shippingFee: parseFloat(orderData.orderHeader?.shippingFee) || 0, // 文字列→数値変換
        totalAmount: parseFloat(orderData.orderHeader?.totalAmount) || 0,  // 文字列→数値変換
        category: orderData.orderHeader?.category || `カテゴリ不明`
      },
      orderDetails: Array.isArray(orderData.orderDetails)
        ? orderData.orderDetails.map((detail: any, index: number) => ({
          itemId: detail.itemId || `ITEM_${String(index + 1).padStart(3, '0')}`,
          productName: detail.productName || '商品名不明',
          unitPrice: parseFloat(detail.unitPrice) || 0,    // 文字列→数値変換
          quantity: parseInt(detail.quantity) || 1,        // 文字列→整数変換
          subtotal: parseFloat(detail.subtotal) || 0       // 文字列→数値変換
        }))
        : []
    };

    console.log('型変換後のorderData:', JSON.stringify(validatedOrderData, null, 2));

    // 基本的な構造チェック
    if (!orderData.orderHeader || !orderData.orderDetails) {
      throw new Error('必要なプロパティが不足しています');
    }

    // return orderData;
    return validatedOrderData;
  } catch (error) {
    console.error('JSON解析エラー:', error);
    console.error('解析しようとしたテキスト:', textContent.text);

    // フォールバック: 空のデータ構造を返す
    return {
      orderHeader: {
        orderId: 'ERROR_' + Date.now(),
        orderDate: new Date().toISOString().split('T')[0],
        subtotal: 0,
        shippingFee: 0,
        totalAmount: 0,
        category: 'category'
      },
      orderDetails: []
    };
  }
}

/**
 * OCR結果をデータベースに保存する関数
 * Day3で学習したDynamoDB操作の実践応用
 * 
 * @param databaseClient - データベース操作用のクライアント
 * @param orderData
 * @param fileName - ファイル名
 * @param filePath - ファイルパス
 * @param content - 保存するコンテンツ
 * @returns 保存結果
 */
// async function saveToDatabase(databaseClient: any, orderData: OrderData, fileName: string, filePath: string, content: any) {
async function saveOrderToDatabase(databaseClient: any, orderData: OrderData, fileName: string, filePath: string, content: any) {
  console.log(`💾 注文情報をデータベースに保存中...`);

  try {
    // 注文ヘッダーを保存
    const orderHeaderResult = await databaseClient.models.OrderHeader.create({
      orderId: orderData.orderHeader.orderId,
      orderDate: orderData.orderHeader.orderDate,
      subtotal: orderData.orderHeader.subtotal,
      shippingFee: orderData.orderHeader.shippingFee,
      totalAmount: orderData.orderHeader.totalAmount,
      category: orderData.orderHeader.category,
      documentName: fileName,
      documentUri: filePath,
      // オブジェクトをJSON文字列に変換して保存
      content: JSON.stringify(content)
    });

    console.log('=== OrderHeader保存結果の詳細分析 ===');
    console.log('orderHeaderResult全体:', JSON.stringify(orderHeaderResult, null, 2));
    console.log('orderHeaderResult.data:', orderHeaderResult.data);
    console.log('orderHeaderResult.data?.id:', orderHeaderResult.data?.orderId);
    console.log('orderHeaderResult.data?.id の型:', typeof orderHeaderResult.data?.orderId);
    console.log('orderHeaderResult.errors:', orderHeaderResult.errors);

    // IDが取得できない場合はエラーを投げる
    if (!orderHeaderResult.data?.orderId) {
      console.error('❌ OrderHeaderのID取得に失敗');
      throw new Error('OrderHeaderの保存に失敗しました。IDが取得できません。');
    } else {
      console.log('注文ヘッダー保存結果:', JSON.stringify(orderHeaderResult, null, 2));
      console.log(`✅ 注文ヘッダー保存完了: ID ${orderHeaderResult.data?.orderId}`);
    }

    const headerIdForDetail = orderHeaderResult.data.orderId;
    console.log('OrderDetail用のID:', headerIdForDetail);

    // 注文明細を保存
    const orderDetailResults = [];

    // IDが確実に取得できてから明細保存を開始
    if (!orderHeaderResult.data?.orderId) {
      throw new Error('OrderHeaderのIDが取得できないため、明細保存を中止します');
    }

    const validHeaderId = orderHeaderResult.data.orderId;

    for (const detail of orderData.orderDetails) {
      const orderDetailResult = await databaseClient.models.OrderDetail.create({
        itemId: detail.itemId,
        productName: detail.productName,
        unitPrice: detail.unitPrice,
        quantity: detail.quantity,
        subtotal: detail.subtotal,
        orderHeaderId: validHeaderId
      });

      console.log('注文明細保存結果:', JSON.stringify(orderDetailResult, null, 2));
      orderDetailResults.push(orderDetailResult);
      console.log(`✅ 注文明細保存完了: ${detail.productName}`);
    }

    return {
      orderHeader: orderHeaderResult,
      orderDetails: orderDetailResults
    };

  } catch (error) {
    console.error('データベース保存エラー:', error);
    console.error('エラーの詳細:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// ============================================================================
// 【6. メインのLambda関数】
// S3イベントを受け取って処理を実行する関数
// ============================================================================

export const handler = async (event: S3Event) => {
  console.log(`\n📋 ${event.Records.length}個の注文書画像の処理を開始しますす`);

  // ============================================================================
  // 【6-1. Amplifyデータベースの設定取得】
  // Day3で学習したAmplify設定の実践応用
  // ============================================================================
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  Amplify.configure(resourceConfig, libraryOptions);

  // ============================================================================
  // 【6-2. AWSサービスのクライアント作成】
  // ============================================================================
  const databaseClient = generateClient<Schema>();  // DynamoDB操作用
  const s3Client = new S3Client({ region: process.env.AWS_REGION });  // S3操作用
  const aiClient = new BedrockRuntimeClient({ region: AI_SETTINGS.region });  // Bedrock操作用

  // ============================================================================
  // 【6-3. すべてのファイルを並行処理】
  // 複数ファイルが同時にアップロードされた場合に効率的に処理
  // ============================================================================
  const processingTasks = event.Records.map(async (record) => {
    // S3イベントからファイル情報を抽出
    const fileInfo = {
      bucket: record.s3.bucket.name,
      // URLエンコードされたファイル名をデコード
      key: decodeURIComponent(record.s3.object.key.replace(/\+/g, ' ')),
      size: record.s3.object.size
    };

    // ファイル名のみを抽出（パスから最後の部分）
    const fileName = fileInfo.key.split('/').pop() || fileInfo.key;
    console.log(`\n🚀 注文書処理開始: ${fileName}`);

    try {
      // ============================================================================
      // 【6-4. 処理の実行】
      // 上で定義した各関数を順番に呼び出し
      // ============================================================================

      // Step1: S3から画像をダウンロード
      const imageData = await downloadImageFromS3(s3Client, fileInfo.bucket, fileInfo.key);

      // Step2: AIでOCR処理
      // const ocrResult = await extractTextFromImage(aiClient, imageData);
      const orderData = await extractOrderFromImage(aiClient, imageData);

      // Step3: 結果をデータベースに保存
      // await saveToDatabase(databaseClient, fileName, fileInfo.key, {
      //   bucket: fileInfo.bucket,
      //   key: fileInfo.key,
      //   ocrText: ocrResult.text
      // });

      await saveOrderToDatabase(databaseClient, orderData, fileName, fileInfo.key, orderData);

      console.log(`🎉 ${fileName} の処理が完了しました！`);
    } catch (error) {
      console.error(`❌ ${fileName} の処理中にエラーが発生:`, error);
      // エラーを再スローして失敗を明確にする
      throw error;
    }
  });

  // すべてのファイル処理が完了するまで待機
  await Promise.all(processingTasks);

  console.log(`\n🎊 すべての注文書処理が正常に完了しました！`);

  // ============================================================================
  // 【6-5. レスポンス返却】
  // ============================================================================
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `${event.Records.length}個の注文書の処理が完了しました`,
      processedFiles: event.Records.length
    })
  };
};
