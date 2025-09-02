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
  PieChart as PieChartIcon,
} from "@mui/icons-material";
import OcrDataList from "./components/OcrDataList2";
import OrderCategoryChart from './components/OrderCategoryChart';

const processFile = async ({ file, key }: { file: File; key: string }) => {
  console.log(`🔧 ファイル処理開始: ${file.name}`);
  console.log(`📋 元ファイル情報: ${file.size} bytes, ${file.type}`);

  if (file.type.startsWith('image/')) {
    // ファイルサイズチェックのみ
    if (file.size > 3 * 1024 * 1024) {
      console.warn(`⚠️ ファイルサイズが大きいです: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    }

    console.log(`✅ 画像処理スキップ（元ファイル使用）: ${file.name}`);
    return { file, key };
  }
  return { file, key };
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
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8f9fa' // 背景色を追加してコントラストを向上
      }}>
        {/* ヘッダー */}
        <AppBar
          position="static"
          sx={{
            mb: 3,
            backgroundColor: '#31BCD4',
            border: '2px solid #2BA8C4', // ヘッダーに枠線追加
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
                border: '1px solid rgba(255, 255, 255, 0.3)', // ボタンに枠線
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
                border: '2px solid #31BCD4', // メインカラーで枠線
                borderRadius: 2,
                '&:hover': {
                  boxShadow: 6,
                  borderColor: '#2BA8C4', // ホバー時に枠線色を変更
                  transform: 'translateY(-2px)', // 軽い浮き上がり効果
                  transition: 'all 0.3s ease'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 3,
                    pb: 2,
                    borderBottom: '2px solid #31BCD4' // セクションタイトル下に区切り線
                  }}>
                    <CloudUploadIcon sx={{ mr: 1, color: '#31BCD4', fontSize: 28 }} />
                    <Typography variant="h5" component="h2" sx={{ color: '#31BCD4', fontWeight: 600 }}>
                      画像アップロード
                    </Typography>
                  </Box>

                  <Box sx={{
                    border: '1px dashed #31BCD4', // アップロードエリアに点線枠
                    borderRadius: 1,
                    p: 2,
                    backgroundColor: 'rgba(49, 188, 212, 0.05)' // 薄い背景色
                  }}>
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
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            border: '2px solid #31BCD4',
                            borderRadius: 1,
                            backgroundColor: 'rgba(49, 188, 212, 0.05)'
                          }}
                        >
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
                minHeight: 400,
                boxShadow: 3,
                border: '2px solid #31BCD4', // メインカラーで枠線
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
                    border: '1px solid #e0e0e0', // コンテンツエリアに薄い枠線
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
                border: '2px solid #31BCD4', // メインカラーで枠線
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
                    border: '1px solid #e0e0e0', // コンテンツエリアに薄い枠線
                    borderRadius: 1,
                    p: 2,
                    backgroundColor: 'rgba(49, 188, 212, 0.02)' // 非常に薄い背景色
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