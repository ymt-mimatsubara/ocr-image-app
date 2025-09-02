import { useState } from "react";
import { signOut } from "aws-amplify/auth";
import { FileUploader } from "@aws-amplify/ui-react-storage";
import "@aws-amplify/ui-react/styles.css";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  CssBaseline,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  TextSnippet as TextSnippetIcon,
  Logout as LogoutIcon,
  PieChart as PieChartIcon, // 追加
} from "@mui/icons-material";
import OcrDataList from "./components/OcrDataList2";
import OrderCategoryChart from './components/OrderCategoryChart';

// const MAX_SIZE = 3 * 1024 * 1024; // 3MB
// const TARGET_SIZE = 800; // 800px
// const QUALITY = 0.7; // 70%

const MAX_SIZE = 3 * 1024 * 1024; // 3MB（上限維持）
const MIN_TARGET_SIZE = 1000; // OCR用最小サイズ
const MAX_TARGET_SIZE = 2000; // OCR用最大サイズ
const HIGH_QUALITY = 0.98; // 高品質用
const COMPRESSED_QUALITY = 0.90; // 圧縮用（3MB制限対応）

// コントラスト強化関数
const enhanceContrast = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const contrast = 1.2;
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }

  ctx.putImageData(imageData, 0, 0);
};

// 3MB制限を考慮したOCR最適化関数
const optimizeImageForOCR = (file: File): Promise<File> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      let targetWidth = img.width;
      let targetHeight = img.height;

      // 縦長画像の場合の特別処理
      const aspectRatio = img.height / img.width;
      const isVertical = aspectRatio > 1.5;

      if (isVertical) {
        // 縦長画像の場合、幅を基準にリサイズ
        const targetWidthForVertical = Math.max(1000, Math.min(1600, img.width));
        const scale = targetWidthForVertical / img.width;
        targetWidth = targetWidthForVertical;
        targetHeight = img.height * scale;
      } else {
        // 通常の処理
        const maxDimension = Math.max(img.width, img.height);
        if (maxDimension < MIN_TARGET_SIZE) {
          const scale = MIN_TARGET_SIZE / maxDimension;
          targetWidth = img.width * scale;
          targetHeight = img.height * scale;
        } else if (maxDimension > MAX_TARGET_SIZE) {
          const scale = MAX_TARGET_SIZE / maxDimension;
          targetWidth = img.width * scale;
          targetHeight = img.height * scale;
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // 高品質描画設定
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 背景を白に設定（透明部分対策）
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // 画像処理の順序を最適化
      denoiseImage(ctx, targetWidth, targetHeight);      // 1. ノイズ除去
      enhanceContrast(ctx, targetWidth, targetHeight);   // 2. コントラスト強化
      sharpenImage(ctx, targetWidth, targetHeight);      // 3. シャープネス強化

      // 以下、既存の出力処理...
      const tryOutput = (quality: number, format: string) => {
        return new Promise<File>((resolveOutput) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolveOutput(new File([blob], file.name, { type: format }));
            }
          }, format, quality);
        });
      };

      // 段階的品質調整で3MB以下に収める（既存のコード）
      const outputOptimizedFile = async () => {
        // PNG優先でOCR精度を重視
        let outputFile = await tryOutput(1.0, 'image/png');
        if (outputFile.size <= MAX_SIZE) {
          console.log(`PNG出力成功: ${outputFile.size} bytes`);
          resolve(outputFile);
          return;
        }

        // 高品質JPEGを試す
        outputFile = await tryOutput(HIGH_QUALITY, 'image/jpeg');
        if (outputFile.size <= MAX_SIZE) {
          console.log(`高品質JPEG出力成功: ${outputFile.size} bytes`);
          resolve(outputFile);
          return;
        }

        // 以下、既存の段階的品質調整...
        outputFile = await tryOutput(COMPRESSED_QUALITY, 'image/jpeg');
        if (outputFile.size <= MAX_SIZE) {
          console.log(`圧縮JPEG出力成功: ${outputFile.size} bytes`);
          resolve(outputFile);
          return;
        }

        let quality = 0.75;
        while (quality > 0.5 && outputFile.size > MAX_SIZE) {
          outputFile = await tryOutput(quality, 'image/jpeg');
          if (outputFile.size <= MAX_SIZE) {
            console.log(`品質${quality}で出力成功: ${outputFile.size} bytes`);
            resolve(outputFile);
            return;
          }
          quality -= 0.05;
        }

        // 最終手段：サイズを縮小
        const finalScale = Math.sqrt(MAX_SIZE / outputFile.size) * 0.9;
        const finalWidth = targetWidth * finalScale;
        const finalHeight = targetHeight * finalScale;

        canvas.width = finalWidth;
        canvas.height = finalHeight;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, finalWidth, finalHeight);
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

        // 再度画像処理を適用
        denoiseImage(ctx, finalWidth, finalHeight);
        enhanceContrast(ctx, finalWidth, finalHeight);
        sharpenImage(ctx, finalWidth, finalHeight);

        outputFile = await tryOutput(COMPRESSED_QUALITY, 'image/jpeg');
        console.log(`最終出力: ${outputFile.size} bytes (サイズ縮小適用)`);
        resolve(outputFile);
      };

      outputOptimizedFile();
    };
    img.src = URL.createObjectURL(file);
  });

const processFile = async ({ file, key }: { file: File; key: string }) => {
  if (file.type.startsWith('image/')) {
    const optimizedFile = await optimizeImageForOCR(file);
    console.log(`画像最適化完了: ${file.name}`);
    console.log(`サイズ変更: ${file.size} → ${optimizedFile.size} bytes (上限: ${MAX_SIZE} bytes)`);
    return { file: optimizedFile, key };
  }
  return { file, key };
};

// シャープネス強化関数を追加
const sharpenImage = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  // シャープネスカーネル
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        output[(y * width + x) * 4 + c] = sum;
      }
    }
  }

  const newImageData = new ImageData(output, width, height);
  ctx.putImageData(newImageData, 0, 0);
};

// ノイズ除去関数を追加
const denoiseImage = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);

  // ガウシアンブラーカーネル（軽微）
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ];
  const kernelSum = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        output[(y * width + x) * 4 + c] = sum / kernelSum;
      }
    }
  }

  const newImageData = new ImageData(output, width, height);
  ctx.putImageData(newImageData, 0, 0);
};

export default function App() {
  const [files, setFiles] = useState<Record<string, { status: string } | undefined>>({});

  const removeFile = (key?: string) => {
    if (!key) return;
    setFiles(prev => ({ ...prev, [key]: undefined }));
  };

  return (
    <>
      <CssBaseline />
      <Box sx={{
        flexGrow: 1,
        minHeight: '100vh', // 画面全体の高さを使用
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ヘッダー */}
        <AppBar position="static" sx={{ mb: 3 }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              推し活費管理アプリ
            </Typography>
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={() => signOut()}
            >
              ログアウト
            </Button>
          </Toolbar>
        </AppBar>

        {/* メインコンテンツ - maxWidthを削除してフル幅に */}
        <Container
          maxWidth={false}
          sx={{
            px: { xs: 2, sm: 3, md: 4 } // レスポンシブな左右パディング
          }}
        >
          <Grid container spacing={3}>
            {/* 画像アップロードセクション */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card sx={{
                height: 'fit-content',
                minHeight: 400
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CloudUploadIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5" component="h2">
                      画像アップロード
                    </Typography>
                  </Box>

                  <Box>
                    <FileUploader
                      acceptedFileTypes={['image/*']}
                      path="media/"
                      maxFileCount={1}
                      isResumable
                      processFile={processFile}
                      onFileRemove={({ key }) => removeFile(key)}
                      displayText={{
                        dropFilesText: 'ファイルをここにドロップ',
                        browseFilesText: 'ファイルを選択',
                        getUploadingText: (percentage) => `アップロード中... ${percentage}%`,
                        getUploadButtonText: () => 'アップロード',
                        getMaxFilesErrorText: (count) => `ファイル数が上限（${count}）を超えています`,
                        getFileSizeErrorText: (sizeText) => `ファイルサイズが大きすぎます（${sizeText}）`,
                        getPausedText: (percentage) => `一時停止中... ${percentage}%`,
                        getFilesUploadedText: (count) => `${count} 個のファイルがアップロードされました`
                      }}
                    />
                  </Box>

                  {/* ファイルステータス表示 */}
                  {Object.entries(files).map(([key, fileStatus]) =>
                    fileStatus && (
                      <Box key={key} sx={{ mt: 2 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="body2">
                            <strong>ファイル:</strong> {key}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>ステータス:</strong> {fileStatus.status}
                          </Typography>
                        </Paper>
                      </Box>
                    )
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* OCR処理結果セクション */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card sx={{
                height: 'fit-content',
                minHeight: 400
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TextSnippetIcon sx={{ mr: 1, color: 'secondary.main' }} />
                    <Typography variant="h5" component="h2">
                      OCR処理結果
                    </Typography>
                  </Box>
                  <OcrDataList />
                </CardContent>
              </Card>
            </Grid>

            {/* カテゴリ別売上分析セクション */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <PieChartIcon sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="h5" component="h2">
                      グッズ注文データ
                    </Typography>
                  </Box>
                  <OrderCategoryChart />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}