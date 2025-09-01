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

// ============================================================================
// 【3. AI設定】
// Day2で学習したBedrock設定の実践応用
// ============================================================================

// AIモデルの設定
const AI_SETTINGS = {
  // 使用するClaudeモデル（最新のSonnet-4モデル）
  modelName: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  // Bedrockが利用可能なリージョン
  region: 'us-west-2',
  // 最大出力トークン数
  maxTokens: 4096,
  // Anthropic APIのバージョン（変更しない）
  version: 'bedrock-2023-05-31'
};

// ============================================================================
// 【4. AIプロンプト設定】
// 課題では以下にプロンプトを追加してください。
// ============================================================================

// AIに送る指示（Day2で学習したプロンプト設計）
const AI_INSTRUCTION = `このレシートの内容を分析し、次の項目をJSON形式で出力してください。
最後にJSONのみを出力してください。ただし項目の[]で囲われている文字列をJSONの項目とする。
店名についてセブンイレブン、ファミリーマート、ローソン、その他の選択肢から判断すること。
・購入日時[buy_dt]
・品名[product_nam]
・単価[price]
・店名[store]
以下の例にそって作成してください。
{
"items": [
{"pur_dt": "2025-08-21 07:14",
"product_nam": "アイスモカフレ",
"price": 190,
"store": "ファミリーマート"
}
]
}
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
async function extractTextFromImage(aiClient: BedrockRuntimeClient, imageData: Buffer): Promise<{ text: string }> {
  console.log(`🤖 AI OCR処理を開始...`);
  
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
    // システムプロンプト：AIの役割を定義
    system: 'あなたは画像からテキストを文字起こしする専門家です。',
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
  
  console.log(`✅ テキスト抽出完了: ${textContent.text.length} 文字`);
  return { text: textContent.text };
}

/**
 * OCR結果をデータベースに保存する関数
 * Day3で学習したDynamoDB操作の実践応用
 * 
 * @param databaseClient - データベース操作用のクライアント
 * @param fileName - ファイル名
 * @param filePath - ファイルパス
 * @param content - 保存するコンテンツ
 * @returns 保存結果
 */
async function saveToDatabase(databaseClient: any, fileName: string, filePath: string, content: any) {
  console.log(`💾 データベースに保存中: ${fileName}`);
  
  // Day3で学習したAmplify DataClientを使用してDynamoDBに保存
  const result = await databaseClient.models.OcrData.create({
    documentname: fileName,
    documenturi: filePath,
    // オブジェクトをJSON文字列に変換して保存
    content: JSON.stringify(content)
  });
  
  console.log(`✅ 保存完了: ID ${result.data?.id}`);
  return result;
}

// ============================================================================
// 【6. メインのLambda関数】
// S3イベントを受け取って処理を実行する関数
// ============================================================================

export const handler = async (event: S3Event) => {
  console.log(`\n📋 ${event.Records.length}個のファイルのOCR処理を開始します`);
  
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
    console.log(`\n🚀 OCR処理開始: ${fileName}`);
    
    try {
      // ============================================================================
      // 【6-4. 処理の実行】
      // 上で定義した各関数を順番に呼び出し
      // ============================================================================
      
      // Step1: S3から画像をダウンロード
      const imageData = await downloadImageFromS3(s3Client, fileInfo.bucket, fileInfo.key);
      
      // Step2: AIでOCR処理
      const ocrResult = await extractTextFromImage(aiClient, imageData);
      
      // Step3: 結果をデータベースに保存
      await saveToDatabase(databaseClient, fileName, fileInfo.key, {
        bucket: fileInfo.bucket,
        key: fileInfo.key,
        ocrText: ocrResult.text
      });
      
      console.log(`🎉 ${fileName} の処理が完了しました！`);
    } catch (error) {
      console.error(`❌ ${fileName} の処理中にエラーが発生:`, error);
      // エラーを再スローして失敗を明確にする
      throw error;
    }
  });
  
  // すべてのファイル処理が完了するまで待機
  await Promise.all(processingTasks);
  
  console.log(`\n🎊 すべてのOCR処理が正常に完了しました！`);
  
  // ============================================================================
  // 【6-5. レスポンス返却】
  // ============================================================================
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: `${event.Records.length}個のファイルのOCR処理が完了しました`,
      processedFiles: event.Records.length
    })
  };
};
