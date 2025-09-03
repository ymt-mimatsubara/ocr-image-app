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
  LinearProgress,
  Chip,
  Alert,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  TextSnippet as TextSnippetIcon,
  Logout as LogoutIcon,
  PieChart as PieChartIcon,
  ImageSearch as ImageSearchIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AutoFixHigh as AutoFixHighIcon,
} from "@mui/icons-material";
import OcrDataList from "./components/OcrDataList2";
import OrderCategoryChart from './components/OrderCategoryChart';

// ファイル処理状態の型定義
interface FileProcessingStatus {
  status: string;
  originalSize?: number;
  processedSize?: number;
  processingSteps?: string[];
  imageInfo?: {
    width: number;
    height: number;
    channels: number;
    format: string;
  };
  optimizations?: string[];
  error?: string;
}

// 処理状況の型定義
interface ProcessingStatus {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  fileName?: string;
}

// 画像処理結果の型定義
interface ProcessingResult {
  processedFile: File;
  optimizations: string[];
  originalInfo: {
    width?: number;
    height?: number;
    channels?: number;
    format?: string;
  };
  processedInfo: {
    width?: number;
    height?: number;
    channels?: number;
    format?: string;
  };
}

// OCR用画像前処理関数（PNG専用・高精度版）
const preprocessImageForOCR = async (
  file: File,
  fileName: string
): Promise<ProcessingResult> => {
  console.log(`🔄 高精度OCR前処理開始: ${fileName}`);

  const optimizations: string[] = [];

  try {
    const imageBitmap = await createImageBitmap(file);

    const originalInfo = {
      width: imageBitmap.width,
      height: imageBitmap.height,
      channels: 4,
      format: 'png'
    };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // OCR最適サイズ（大きめに設定）
    const optimalDimension = 1600; // OCR精度重視
    const minDimension = 800;      // 最小サイズを大きく

    let targetWidth = originalInfo.width;
    let targetHeight = originalInfo.height;

    // サイズ最適化（OCR精度重視）
    if (originalInfo.width < minDimension || originalInfo.height < minDimension) {
      // 小さい画像は拡大（OCR精度向上）
      const scale = Math.max(minDimension / originalInfo.width, minDimension / originalInfo.height);
      targetWidth = Math.floor(originalInfo.width * scale);
      targetHeight = Math.floor(originalInfo.height * scale);
      optimizations.push(`OCR用拡大 (${targetWidth}x${targetHeight})`);
    } else if (originalInfo.width > optimalDimension && originalInfo.height > optimalDimension) {
      // 大きすぎる場合は適度にリサイズ
      const scale = Math.min(optimalDimension / originalInfo.width, optimalDimension / originalInfo.height);
      targetWidth = Math.floor(originalInfo.width * scale);
      targetHeight = Math.floor(originalInfo.height * scale);
      optimizations.push(`OCR最適化 (${targetWidth}x${targetHeight})`);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // 高品質リサイズ設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 背景を白に設定（透明部分対策）
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // 画像描画
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

    // OCR精度向上処理
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;

    // 文字認識精度向上のための画像処理
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // グレースケール変換
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      // コントラスト強化（文字を鮮明に）
      const enhanced = gray < 128
        ? Math.max(0, gray - 20)      // 暗い部分をより暗く
        : Math.min(255, gray + 30);   // 明るい部分をより明るく

      data[i] = enhanced;     // R
      data[i + 1] = enhanced; // G  
      data[i + 2] = enhanced; // B
      // Alpha値はそのまま
    }

    optimizations.push('グレースケール変換', 'コントラスト強化');

    // 処理済み画像データを適用
    ctx.putImageData(imageData, 0, 0);

    // PNG形式で出力（可逆圧縮）
    const processedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas変換失敗'));
      }, 'image/png', 1.0); // PNG最高品質
    });

    const processedFile = new File([processedBlob], fileName, {
      type: 'image/png',
      lastModified: file.lastModified
    });

    optimizations.push('PNG高品質出力');

    console.log(`✅ 高精度OCR前処理完了: ${fileName}`);
    console.log(`📊 ${(file.size / 1024).toFixed(1)}KB → ${(processedFile.size / 1024).toFixed(1)}KB`);

    imageBitmap.close();

    return {
      processedFile,
      optimizations,
      originalInfo,
      processedInfo: {
        width: targetWidth,
        height: targetHeight,
        channels: 4,
        format: 'png'
      }
    };

  } catch (error) {
    console.error('PNG処理エラー:', error);
    return {
      processedFile: file,
      optimizations: ['エラーのため元画像使用'],
      originalInfo: { width: 0, height: 0, channels: 0, format: 'png' },
      processedInfo: { width: 0, height: 0, channels: 0, format: 'png' }
    };
  }
};

export default function App() {
  // 状態管理
  const [files, setFiles] = useState<Record<string, FileProcessingStatus | undefined>>({});
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentStep: '',
    progress: 0
  });

  // ファイル削除関数
  const removeFile = (key?: string) => {
    if (!key) return;
    setFiles(prev => ({ ...prev, [key]: undefined }));
  };

  // 処理成功時のコールバック
  const handleUploadSuccess = (result: any) => {
    const { key } = result;
    if (key) {
      setFiles(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'アップロード完了'
        } as FileProcessingStatus
      }));
    }
  };

  // 処理開始時のコールバックを修正
  const handleUploadStart = (result: any) => {
    const { key, file } = result;
    if (key) {
      // 新しいアップロード開始時に前のファイル情報をクリア
      setFiles({});

      setProcessingStatus({
        isProcessing: true,
        currentStep: '画像解析中...',
        progress: 10,
        fileName: file?.name
      });

      setFiles(prev => ({
        ...prev,
        [key]: {
          status: '前処理中...',
          originalSize: file?.size,
          processingSteps: ['ファイル解析開始']
        }
      }));
    }
  };

  // 状態定義に追加
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // enhancedProcessFile関数（完全修正版）
  const enhancedProcessFile = async ({ file, key }: { file: File; key: string }) => {
    // 重複実行チェック
    if (isProcessing === key) {
      console.log(`⚠️ ${key} は既に処理中です`);
      return { file, key };
    }

    try {
      setIsProcessing(key);

      // 処理開始
      setProcessingStatus({
        isProcessing: true,
        currentStep: '画像情報を取得中...',
        progress: 20,
        fileName: file.name
      });

      setFiles(prev => ({
        ...prev,
        [key]: {
          status: '画像解析中...',
          originalSize: file.size,
          processingSteps: ['ファイル解析完了']
        }
      }));

      if (file.type.startsWith('image/')) {
        // メタデータ取得段階
        setProcessingStatus(prev => ({
          ...prev,
          currentStep: '画像メタデータ取得中...',
          progress: 30
        }));

        // 基本的な画像情報を取得
        const img = new Image();
        const imageInfo = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            URL.revokeObjectURL(img.src);
            reject(new Error('画像読み込みタイムアウト'));
          }, 10000); // 10秒タイムアウト

          img.onload = () => {
            clearTimeout(timeoutId);
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(img.src);
          };
          img.onerror = () => {
            clearTimeout(timeoutId);
            URL.revokeObjectURL(img.src);
            reject(new Error('画像の読み込みに失敗しました'));
          };
          img.src = URL.createObjectURL(file);
        });

        setFiles(prev => ({
          ...prev,
          [key]: {
            ...prev[key]!,
            imageInfo: {
              width: imageInfo.width,
              height: imageInfo.height,
              channels: 4,
              format: file.type.split('/')[1] || 'unknown'
            },
            processingSteps: [...(prev[key]?.processingSteps || []), '画像情報取得完了']
          }
        }));

        // 前処理実行段階
        setProcessingStatus(prev => ({
          ...prev,
          currentStep: 'OCR用最適化処理中...',
          progress: 60
        }));

        const {
          processedFile,
          optimizations,
          originalInfo,
          processedInfo
        } = await preprocessImageForOCR(file, file.name);

        // 完了段階
        setProcessingStatus(prev => ({
          ...prev,
          currentStep: '前処理完了！',
          progress: 100
        }));

        setFiles(prev => ({
          ...prev,
          [key]: {
            status: '前処理完了',
            originalSize: file.size,
            processedSize: processedFile.size,
            imageInfo: {
              width: originalInfo.width || 0,
              height: originalInfo.height || 0,
              channels: originalInfo.channels || 0,
              format: originalInfo.format || 'unknown'
            },
            optimizations,
            processingSteps: [
              ...(prev[key]?.processingSteps || []),
              '画像最適化完了',
              `${optimizations.length}個の最適化適用`,
              'OCR前処理完了'
            ]
          }
        }));

        return { file: processedFile, key };

      } else {
        // 画像以外のファイル
        setFiles(prev => ({
          ...prev,
          [key]: {
            status: '画像以外のファイル',
            originalSize: file.size,
            processingSteps: ['画像以外のファイルのためスキップ']
          }
        }));

        return { file, key };
      }

    } catch (error: any) {
      console.error(`❌ ファイル処理エラー: ${error.message}`);

      setFiles(prev => ({
        ...prev,
        [key]: {
          status: '処理エラー',
          originalSize: file.size,
          error: error.message,
          processingSteps: [...(prev[key]?.processingSteps || []), `エラー: ${error.message}`]
        }
      }));

      // エラー時は元ファイルを返す
      return { file, key };

    } finally {
      // 必ず実行される処理
      setIsProcessing(null);

      // 2秒後に処理状態をリセット
      setTimeout(() => {
        setProcessingStatus({
          isProcessing: false,
          currentStep: '',
          progress: 0
        });
      }, 2000);
    }
  };

  return (
    <>
      <CssBaseline />
      <Box sx={{
        flexGrow: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa'
      }}>
        {/* ヘッダー */}
        <AppBar
          position="static"
          sx={{
            mb: 3,
            backgroundColor: '#31BCD4',
            border: '2px solid #2BA8C4',
            borderRadius: 0,
            '&:hover': {
              backgroundColor: '#2BA8C4'
            }
          }}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
              オシカケ~推し活費管理アプリ~
            </Typography>
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={() => signOut()}
              sx={{
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderColor: 'rgba(255, 255, 255, 0.5)'
                }
              }}
            >
              ログアウト
            </Button>
          </Toolbar>
        </AppBar>

        {/* メインコンテンツ */}
        <Container
          maxWidth={false}
          sx={{
            px: { xs: 2, sm: 3, md: 4 }
          }}
        >
          <Grid container spacing={3}>
            {/* 画像アップロードセクション */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card sx={{
                height: 'fit-content',
                minHeight: 400,
                boxShadow: 3,
                border: '2px solid #31BCD4',
                borderRadius: 2,
                '&:hover': {
                  boxShadow: 6,
                  borderColor: '#2BA8C4',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 3,
                    pb: 2,
                    borderBottom: '2px solid #31BCD4'
                  }}>
                    <CloudUploadIcon sx={{ mr: 1, color: '#31BCD4', fontSize: 28 }} />
                    <Typography variant="h5" component="h2" sx={{ color: '#31BCD4', fontWeight: 600 }}>
                      画像アップロード
                    </Typography>
                  </Box>

                  {/* 処理機能の説明 */}
                  <Alert severity="info" sx={{ mb: 2 }} icon={<AutoFixHighIcon />}>
                    <Typography variant="body2">
                      <strong>高精度OCR前処理が有効</strong><br />
                      文字認識精度向上のため画像を最適化します
                    </Typography>
                  </Alert>

                  <Box sx={{
                    border: '1px dashed #31BCD4',
                    borderRadius: 1,
                    p: 2,
                    backgroundColor: 'rgba(49, 188, 212, 0.05)',
                    // アップロード後のファイル表示のみを非表示（ドロップゾーンは残す）
                    '& .amplify-fileuploader [data-testid="file-uploader-file"]': {
                      display: 'none !important'
                    },
                    '& .amplify-fileuploader .amplify-fileuploader__file': {
                      display: 'none !important'
                    },
                    // アップロード完了後のリスト表示を非表示
                    '& .amplify-fileuploader__file-list > div': {
                      display: 'none !important'
                    }
                  }}>
                    <FileUploader
                      acceptedFileTypes={['image/png']}
                      path="media/"
                      maxFileCount={1}
                      isResumable
                      processFile={enhancedProcessFile}
                      maxFileSize={5 * 1024 * 1024}
                      onFileRemove={({ key }) => removeFile(key)}
                      onUploadSuccess={handleUploadSuccess}
                      onUploadStart={handleUploadStart}
                      displayText={{
                        dropFilesText: 'PNGファイルをここにドロップ',
                        browseFilesText: 'PNGファイルを選択',
                        getUploadingText: (percentage) => `アップロード中... ${percentage}%`,
                        getUploadButtonText: () => 'アップロード',
                        getMaxFilesErrorText: (count) => `ファイル数が上限（${count}）を超えています`,
                        getFileSizeErrorText: (sizeText) => `ファイルサイズが大きすぎます（${sizeText}）`,
                        getPausedText: (percentage) => `一時停止中... ${percentage}%`,
                        getFilesUploadedText: (count) => ``
                      }}
                    />

                    {/* リアルタイム処理状況表示 */}
                    {processingStatus.isProcessing && (
                      <Box sx={{ mt: 3, p: 2, backgroundColor: 'rgba(49, 188, 212, 0.1)', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <ImageSearchIcon sx={{ mr: 1, color: '#31BCD4' }} />
                          <Typography variant="body2" color="primary" fontWeight={600}>
                            {processingStatus.currentStep}
                          </Typography>
                        </Box>

                        {processingStatus.fileName && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            ファイル: {processingStatus.fileName}
                          </Typography>
                        )}

                        <LinearProgress
                          variant="determinate"
                          value={processingStatus.progress}
                          sx={{
                            mb: 1,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: 'rgba(49, 188, 212, 0.2)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#31BCD4'
                            }
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {processingStatus.progress}% 完了
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* 詳細なファイルステータス表示 */}
                  {Object.entries(files).map(([key, fileStatus]) =>
                    fileStatus && (
                      <Box key={key} sx={{ mt: 2 }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            border: `2px solid ${fileStatus.error ? '#f44336' : '#31BCD4'}`,
                            borderRadius: 1,
                            backgroundColor: fileStatus.error
                              ? 'rgba(244, 67, 54, 0.05)'
                              : 'rgba(49, 188, 212, 0.05)'
                          }}
                        >
                          {/* ファイル基本情報 */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {fileStatus.error ? (
                              <ErrorIcon sx={{ mr: 1, color: '#f44336' }} />
                            ) : (
                              <CheckCircleIcon sx={{ mr: 1, color: '#4caf50' }} />
                            )}
                            <Typography variant="body2" fontWeight={600}>
                              {key.split('/').pop()}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                              <strong>ステータス:</strong>
                            </Typography>
                            <Chip
                              label={fileStatus.status}
                              size="small"
                              sx={{
                                backgroundColor: fileStatus.error ? '#ffebee' : '#e3f2fd',
                                color: fileStatus.error ? '#c62828' : '#1565c0'
                              }}
                            />
                          </Box>

                          {/* 画像情報 */}
                          {fileStatus.imageInfo && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>画像情報:</strong> {fileStatus.imageInfo.width}×{fileStatus.imageInfo.height}px,
                                {fileStatus.imageInfo.channels}ch, {fileStatus.imageInfo.format.toUpperCase()}
                              </Typography>
                            </Box>
                          )}

                          {/* ファイルサイズ情報 */}
                          {fileStatus.originalSize && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>元サイズ:</strong> {(fileStatus.originalSize / 1024).toFixed(1)}KB
                              </Typography>

                              {fileStatus.processedSize && (
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                  <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                    <strong>処理後:</strong> {(fileStatus.processedSize / 1024).toFixed(1)}KB
                                  </Typography>
                                  <Chip
                                    label={
                                      fileStatus.processedSize < fileStatus.originalSize
                                        ? `${((1 - fileStatus.processedSize / fileStatus.originalSize) * 100).toFixed(1)}% 圧縮`
                                        : `${((fileStatus.processedSize / fileStatus.originalSize - 1) * 100).toFixed(1)}% 拡大`
                                    }
                                    size="small"
                                    sx={{
                                      backgroundColor: fileStatus.processedSize < fileStatus.originalSize ? '#e8f5e8' : '#fff3e0',
                                      color: fileStatus.processedSize < fileStatus.originalSize ? '#2e7d32' : '#ef6c00'
                                    }}
                                  />
                                </Box>
                              )}
                            </Box>
                          )}

                          {/* 適用された最適化 */}
                          {fileStatus.optimizations && fileStatus.optimizations.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                <strong>適用された最適化:</strong>
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {fileStatus.optimizations.map((optimization, index) => (
                                  <Chip
                                    key={index}
                                    label={optimization}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      fontSize: '0.7rem',
                                      height: 20,
                                      borderColor: '#31BCD4',
                                      color: '#31BCD4'
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* 処理ステップ */}
                          {fileStatus.processingSteps && fileStatus.processingSteps.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" gutterBottom>
                                <strong>処理ログ:</strong>
                              </Typography>
                              <Box sx={{ maxHeight: 100, overflowY: 'auto' }}>
                                {fileStatus.processingSteps.map((step, index) => (
                                  <Typography
                                    key={index}
                                    variant="caption"
                                    display="block"
                                    sx={{
                                      ml: 1,
                                      color: step.includes('エラー') ? '#f44336' : 'text.secondary',
                                      fontFamily: 'monospace'
                                    }}
                                  >
                                    {step.includes('エラー') ? '❌' : '✓'} {step}
                                  </Typography>
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* エラー詳細 */}
                          {fileStatus.error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              <Typography variant="body2">
                                {fileStatus.error}
                              </Typography>
                            </Alert>
                          )}
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
                minHeight: 400,
                boxShadow: 3,
                border: '2px solid #31BCD4',
                borderRadius: 2,
                '&:hover': {
                  boxShadow: 6,
                  borderColor: '#2BA8C4',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 3,
                    pb: 2,
                    borderBottom: '2px solid #31BCD4'
                  }}>
                    <TextSnippetIcon sx={{ mr: 1, color: '#31BCD4', fontSize: 28 }} />
                    <Typography variant="h5" component="h2" sx={{ color: '#31BCD4', fontWeight: 600 }}>
                      注文情報
                    </Typography>
                  </Box>
                  <Box sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}>
                    <OcrDataList />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* カテゴリ別売上分析セクション */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{
                boxShadow: 3,
                border: '2px solid #31BCD4',
                borderRadius: 2,
                '&:hover': {
                  boxShadow: 6,
                  borderColor: '#2BA8C4',
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 4,
                    pb: 2,
                    borderBottom: '2px solid #31BCD4'
                  }}>
                    <PieChartIcon sx={{ mr: 1, color: '#31BCD4', fontSize: 28 }} />
                    <Typography variant="h5" component="h2" sx={{ color: '#31BCD4', fontWeight: 600 }}>
                      グッズ注文データ
                    </Typography>
                  </Box>
                  <Box sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    p: 2,
                    backgroundColor: 'rgba(49, 188, 212, 0.02)'
                  }}>
                    <OrderCategoryChart />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}