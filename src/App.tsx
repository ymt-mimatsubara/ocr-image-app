// src/App.tsx
import { signOut } from "aws-amplify/auth";
import { FileUploader } from "@aws-amplify/ui-react-storage";
import "@aws-amplify/ui-react/styles.css";
import OcrDataList from "./components/OcrDataList";  // 追加

// ============================================================================
// 【1. 画像リサイズ設定】
// Day4で学習したファイル処理設定
// ============================================================================
const MAX_SIZE = 3 * 1024 * 1024; // 3MB
const TARGET_SIZE = 800; // 800px
const QUALITY = 0.7; // 70%品質

// ============================================================================
// 【2. 画像リサイズ関数】
// Day4で実装した関数群（詳細は省略）
// ============================================================================

// 新しいサイズを計算する関数
function calculateNewSize(width: number, height: number, targetSize: number) {
  if (width <= targetSize && height <= targetSize) {
    return { width, height };
  }
  
  const aspectRatio = width / height;
  if (width > height) {
    return {
      width: targetSize,
      height: Math.round(targetSize / aspectRatio)
    };
  } else {
    return {
      width: Math.round(targetSize * aspectRatio),
      height: targetSize
    };
  }
}

// 画像をリサイズする関数
function resizeImage(file: File, targetSize: number, quality: number): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      const { width, height } = calculateNewSize(img.width, img.height, targetSize);
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        const resizedFile = new File([blob!], file.name, {
          type: file.type,
          lastModified: Date.now(),
        });
        resolve(resizedFile);
      }, file.type, quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// ファイル処理の統合関数
async function processFile({ file }: { file: File }) {
  // サイズチェック：3MB以下ならそのまま返す
  if (file.size <= MAX_SIZE) {
    return { file, key: `${file.name}` };
  }

  // 3MB以上の場合はリサイズして返す
  console.log(`📏 ファイルサイズが${(file.size / 1024 / 1024).toFixed(2)}MBなので、リサイズします`);
  const resizedFile = await resizeImage(file, TARGET_SIZE, QUALITY);
  console.log(`✅ リサイズ完了: ${(resizedFile.size / 1024 / 1024).toFixed(2)}MB`);
  
  return { file: resizedFile, key: `${file.name}` };
}

// ============================================================================
// 【3. メインアプリコンポーネント】
// Day4で学習したコンポーネント設計の実践応用
// ============================================================================

export default function App() {
  return (
    <div>
      {/* アプリのタイトル */}
      <h1>画像読み取りアプリ</h1>
      
      {/* ============================================================================ */}
      {/* 【3-1. 画像アップロード機能】                                                    */}
      {/* Day4で実装した機能に、今回OCR処理のトリガー機能が自動で追加される                      */}
      {/* ============================================================================ */}
      <div>
        <h2>画像アップロード</h2>
          
        {/* Day4で学習したFileUploaderコンポーネント */}
        <FileUploader
          acceptedFileTypes={['image/*']}  // 画像ファイルのみ受け入れ
          path="media/"                    // S3上の保存パス
          maxFileCount={1}                 // 1度に1ファイルまで
          isResumable                      // 大きなファイルの分割アップロード対応
          processFile={processFile}        // ファイル前処理（リサイズ）
        />
      </div>
        
      {/* ============================================================================ */}
      {/* 【3-2. OCR結果表示機能】                                                        */}
      {/* 今回新しく追加された機能                                                       */}
      {/* ============================================================================ */}
      <div>
        <h2>OCR処理結果</h2>
        {/* OcrDataListコンポーネントを使用 */}
        {/* Day3で学習したリアルタイムデータ表示の実践応用 */}
        <OcrDataList />
      </div>
      
      {/* ============================================================================ */}
      {/* 【3-3. ログアウト機能】                                                        */}
      {/* Day1で実装した認証機能                                                       */}
      {/* ============================================================================ */}
      <div>
        <button onClick={() => signOut()}>
          ログアウト
        </button>
      </div>      
    </div>
  );
}