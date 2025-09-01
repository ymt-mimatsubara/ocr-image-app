import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Box,
  IconButton,
  TablePagination,
  Modal,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';

// 型定義
type OcrDataType = Schema['OcrData']['type'];

type ModalState = {
  open: boolean;
  selectedItem: OcrDataType | null;
};

type DeleteState = {
  dialogOpen: boolean;
  loading: boolean;
  itemToDelete: OcrDataType | null;
};

const client = generateClient<Schema>();

// ユーティリティ関数
const sortByCreatedAt = (items: OcrDataType[]) => {
  return [...items].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

const truncateText = (text: string, maxLength: number) => {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

const parseContentAsText = (content: any): string => {
  if (!content) return 'データなし';

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);

      // ocrTextフィールドがある場合は、改行文字を実際の改行に変換して表示
      if (parsed.ocrText && typeof parsed.ocrText === 'string') {
        const formattedOcrText = parsed.ocrText.replace(/\\n/g, '\n');
        const otherFields = { ...parsed };
        delete otherFields.ocrText;

        // 他のフィールドがある場合は上部に表示
        let result = '';
        if (Object.keys(otherFields).length > 0) {
          result += JSON.stringify(otherFields, null, 2) + '\n\n';
        }
        result += 'OCRテキスト:\n' + formattedOcrText;

        return result;
      }

      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  return JSON.stringify(content, null, 2);
};

export default function OcrDataList() {
  // データ管理の状態
  const [ocrData, setOcrData] = useState<OcrDataType[]>([]);
  const [loading, setLoading] = useState(true);

  // ページネーション状態
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // モーダル状態
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    selectedItem: null
  });

  // 削除状態
  const [deleteState, setDeleteState] = useState<DeleteState>({
    dialogOpen: false,
    loading: false,
    itemToDelete: null
  });

  // カスタムフック：OCRデータ取得
  const fetchOcrData = useCallback(async () => {
    setLoading(true);
    const { data: items } = await client.models.OcrData.list();
    setOcrData(sortByCreatedAt(items));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOcrData();
  }, []);

  // リアルタイム更新のためのサブスクリプション
  useEffect(() => {
    const subscription = client.models.OcrData.observeQuery().subscribe({
      next: ({ items }) => {
        setOcrData(sortByCreatedAt(items));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // イベントハンドラー
  const handleChangePage = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleRowClick = useCallback((item: OcrDataType) => {
    setModalState({
      open: true,
      selectedItem: item
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({
      open: false,
      selectedItem: null
    });
  }, []);

  const handleDeleteClick = useCallback((event: React.MouseEvent, item: OcrDataType) => {
    event.stopPropagation();
    setDeleteState({
      dialogOpen: true,
      loading: false,
      itemToDelete: item
    });
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteState({
      dialogOpen: false,
      loading: false,
      itemToDelete: null
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteState.itemToDelete) return;

    setDeleteState(prev => ({ ...prev, loading: true }));

    await client.models.OcrData.delete({
      id: deleteState.itemToDelete.id
    });

    // 削除したレコードをリストから除外
    setOcrData(prevData =>
      prevData.filter(item => item.id !== deleteState.itemToDelete!.id)
    );

    // 削除ダイアログを閉じる
    setDeleteState({
      dialogOpen: false,
      loading: false,
      itemToDelete: null
    });

    // モーダルが開いていて、削除したアイテムが表示されている場合は閉じる
    if (modalState.open && modalState.selectedItem &&
      modalState.selectedItem.id === deleteState.itemToDelete.id) {
      setModalState({
        open: false,
        selectedItem: null
      });
    }
  }, [deleteState.itemToDelete, modalState]);

  // メモ化された値
  const displayedData = useMemo(() =>
    ocrData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [ocrData, page, rowsPerPage]
  );

  // シンプルなテキスト表示コンポーネント
  const OcrTextDisplay = ({ content }: { content: any }) => {
    const textContent = parseContentAsText(content);

    return (
      <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, maxHeight: '400px', overflow: 'auto' }}>
        <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {textContent}
        </Typography>
      </Box>
    );
  };

  const DetailModal = () => {
    if (!modalState.selectedItem) return null;

    const { selectedItem } = modalState;

    return (
      <Modal open={modalState.open} onClose={handleCloseModal}>
        <Paper sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 1000, p: 3, overflow: 'auto' }}>
          <Box sx={{ mb: 2, pb: 1, borderBottom: '1px solid #ccc' }}>
            <Typography variant="h6">
              {selectedItem.documentname}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* 画像表示 */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  画像
                </Typography>
                <Box sx={{ textAlign: 'center', border: '1px solid #ccc', borderRadius: 1, p: 2 }}>
                  {selectedItem.documenturi ? (
                    <StorageImage
                      alt={selectedItem.documentname || 'OCR処理画像'}
                      path={selectedItem.documenturi}
                      fallbackSrc="/placeholder-image.png"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '400px',
                        objectFit: 'contain',
                        borderRadius: '4px'
                      }}
                    />
                  ) : (
                    <Typography>
                      画像が利用できません
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* OCRテキスト表示 */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  OCRテキスト
                </Typography>
                <OcrTextDisplay content={selectedItem.content} />
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid #ccc' }}>
            <Typography>
              処理日時: {new Date(selectedItem.createdAt).toLocaleString('ja-JP')}
            </Typography>
            <Button onClick={handleCloseModal} variant="contained">
              閉じる
            </Button>
          </Box>
        </Paper>
      </Modal>
    );
  };

  const MainContent = () => {
    if (loading) {
      return (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (ocrData.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography>
            OCRデータがありません。画像をアップロードしてください。
          </Typography>
        </Box>
      );
    }

    return (
      <>
        <DataTable
          data={displayedData}
          onRowClick={handleRowClick}
          onDeleteClick={handleDeleteClick}
        />
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={ocrData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="表示件数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          size="small"
        />
      </>
    );
  };

  // データテーブルコンポーネント
  const DataTable = ({
    data,
    onRowClick,
    onDeleteClick
  }: {
    data: OcrDataType[];
    onRowClick: (item: OcrDataType) => void;
    onDeleteClick: (event: React.MouseEvent, item: OcrDataType) => void;
  }) => (
    <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>ドキュメント名</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>処理日時</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>内容</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((item, index) => {
            return (
              <TableRow
                key={item.documentid || `ocr-item-${index}`}
                hover
                onClick={() => onRowClick(item)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  {truncateText(item.documentname || '', 30)}
                </TableCell>
                <TableCell>
                  {new Date(item.createdAt).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </TableCell>
                <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.content
                    ? (typeof item.content === 'string'
                      ? truncateText(item.content, 50)
                      : truncateText(JSON.stringify(item.content), 50))
                    : '内容なし'}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => onDeleteClick(e, item)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <>
      <Box>
        <MainContent />
      </Box>
      <DetailModal />

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteState.dialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>
          レコードを削除しますか？
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteState.itemToDelete && (
              <>
                <strong>{deleteState.itemToDelete.documentname}</strong> のレコードを削除します。この操作は元に戻せません。
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteState.loading}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteState.loading}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}