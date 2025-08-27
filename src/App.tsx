// src/App.tsx
import { signOut } from "aws-amplify/auth";
import { FileUploader } from "@aws-amplify/ui-react-storage";
import "@aws-amplify/ui-react/styles.css";

// リサイズ設定（定数）
const MAX_SIZE = 3 * 1024 * 1024; // 3MB (Bedrock APIの5MB制限対策)
const TARGET_SIZE = 800; // 800px
const QUALITY = 0.7; // 70%品質

const calculateNewSize = (originalWidth: number, originalHeight: number) => {
  // どちらの辺が大きいかを判定して、適切な縮小率を計算
  const scale = Math.min(TARGET_SIZE / originalWidth, TARGET_SIZE / originalHeight);
  // 新しいサイズを計算（小数点を四捨五入）
  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale)
  };
};

// src/App.tsx に追加
const resizeImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    // 1. 画像を読み込む準備
    const img = new Image();
    
    // 2. 画像が読み込まれたら実行される処理
    img.onload = () => {
      // 3. 新しいサイズを計算
      //ここで読み込んだ画像のサイズをcalculateNewSizeに渡す
      const newSize = calculateNewSize(img.width, img.height);
      
      // 4. 作業用のキャンバス（デジタル作業台）を作成
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // 5. キャンバスのサイズを新しいサイズに設定
      canvas.width = newSize.width;
      canvas.height = newSize.height;
      
      // 6. 画像を小さく描画
      ctx.drawImage(img, 0, 0, newSize.width, newSize.height);
      
      // 7. キャンバスをファイルに変換
      canvas.toBlob((blob) => {
        const resizedFile = new File([blob!], file.name, { type: 'image/jpeg' });
        resolve(resizedFile);
      }, 'image/jpeg', QUALITY);
    };
    
    // 8. ファイルを読み込み開始
    img.src = URL.createObjectURL(file);
  });
};

// src/App.tsx に追加
const processFile = async ({ file, key }: { file: File; key: string }) => {
  // 画像ファイルで、かつ3MB以上の場合にリサイズ
  const shouldResize = file.type.startsWith('image/') && file.size >= MAX_SIZE;
  
  // 必要に応じてリサイズして返す
  return { 
    file: shouldResize ? await resizeImage(file) : file, 
    key 
  };
};



export default function App() {
  return (
    <div>
      <h1>画像アップロードアプリ</h1>
      
      <div>
        <h2>画像アップロード</h2>
        <FileUploader
          acceptedFileTypes={['image/*']}
          path="media/"
          maxFileCount={1}
          processFile={processFile} 
        />
      </div>
      
      <div>
        <h2>OCR処理結果</h2>
        <p>※5日目で実装予定</p>
        <p>アップロードした画像から抽出されたテキストがここに表示されます</p>
      </div>
      
      <div>
        <button onClick={() => signOut()}>ログアウト</button>
      </div>
    </div>
  );
}
