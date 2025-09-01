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
} from "@mui/icons-material";
import OcrDataList from "./components/OcrDataList2";

const MAX_SIZE = 3 * 1024 * 1024; // 3MB
const TARGET_SIZE = 800; // 800px
const QUALITY = 0.7; // 70%

const resizeImage = (file: File): Promise<File> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const scale = Math.min(TARGET_SIZE / img.width, TARGET_SIZE / img.height);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', QUALITY);
    };
    img.src = URL.createObjectURL(file);
  });

const processFile = async ({ file, key }: { file: File; key: string }) => {
  const shouldResize = file.type.startsWith('image/') && file.size >= MAX_SIZE;
  return { file: shouldResize ? await resizeImage(file) : file, key };
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
      <Box sx={{ flexGrow: 1 }}>
        {/* ヘッダー */}
        <AppBar position="static" sx={{ mb: 4 }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              画像OCRアプリ
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

        <Container maxWidth="xl">
          <Grid container spacing={4}>
            {/* 画像アップロードセクション */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
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
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ height: '100%' }}>
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
          </Grid>
        </Container>
      </Box>
    </>
  );
}