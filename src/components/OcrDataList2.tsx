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
    Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react/styles.css';

// 型定義
type OcrDataType = Schema['OrderHeader']['type'];
type OrderDetailType = Schema['OrderDetail']['type'];

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

// カテゴリ別カラー定義
const CATEGORY_STYLES = {
    'ホロライブ': { backgroundColor: '#EAB3B8', color: '#000000' },
    'にじさんじ': { backgroundColor: '#31BCD4', color: '#000000' },
    'SIXFONIA': { backgroundColor: '#008000', color: '#FFFFFF' },
    'その他': { backgroundColor: '#FF8042', color: '#FFFFFF' }
} as const;

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

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY'
    }).format(value);
};

export default function OcrDataList() {
    // データ管理の状態
    const [ocrData, setOcrData] = useState<OcrDataType[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderDetails, setOrderDetails] = useState<OrderDetailType[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

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

    // OrderDetail取得関数
    const fetchOrderDetails = useCallback(async (orderHeaderId: string) => {
        try {
            setLoadingDetails(true);
            const { data: details } = await client.models.OrderDetail.list({
                filter: {
                    orderHeaderId: {
                        eq: orderHeaderId
                    }
                }
            });
            setOrderDetails(details || []);
        } catch (error) {
            console.error('OrderDetail取得エラー:', error);
            setOrderDetails([]);
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    // カスタムフック：OCRデータ取得
    const fetchOcrData = useCallback(async () => {
        setLoading(true);
        const { data: items } = await client.models.OrderHeader.list();
        setOcrData(sortByCreatedAt(items));
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchOcrData();
    }, [fetchOcrData]);

    // リアルタイム更新のためのサブスクリプション
    useEffect(() => {
        const subscription = client.models.OrderHeader.observeQuery().subscribe({
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

        // OrderDetailを取得
        fetchOrderDetails(item.orderId);
    }, [fetchOrderDetails]);

    const handleCloseModal = useCallback(() => {
        setModalState({
            open: false,
            selectedItem: null
        });

        // OrderDetailをクリア
        setOrderDetails([]);
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

        try {
            // 1. 関連するOrderDetailを先に削除
            const { data: orderDetails } = await client.models.OrderDetail.list({
                filter: {
                    orderHeaderId: {
                        eq: deleteState.itemToDelete.orderId
                    }
                }
            });

            // 各OrderDetailを削除
            for (const detail of orderDetails) {
                await client.models.OrderDetail.delete({
                    itemId: detail.itemId
                });
            }

            // 2. OrderHeaderを削除
            await client.models.OrderHeader.delete({
                orderId: deleteState.itemToDelete.orderId
            });

            // UI更新
            setOcrData(prevData =>
                prevData.filter(item => item.orderId !== deleteState.itemToDelete!.orderId)
            );

            setDeleteState({
                dialogOpen: false,
                loading: false,
                itemToDelete: null
            });

            if (modalState.open && modalState.selectedItem &&
                modalState.selectedItem.orderId === deleteState.itemToDelete.orderId) {
                setModalState({
                    open: false,
                    selectedItem: null
                });
            }

        } catch (error) {
            console.error('削除処理でエラーが発生しました:', error);
            setDeleteState(prev => ({ ...prev, loading: false }));
        }
    }, [deleteState.itemToDelete, modalState]);

    // メモ化された値
    const displayedData = useMemo(() =>
        ocrData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [ocrData, page, rowsPerPage]
    );

    // OrderDetailテーブルコンポーネント
    const OrderDetailTable = useCallback(() => {
        if (loadingDetails) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ ml: 2 }}>
                        注文詳細を読み込み中...
                    </Typography>
                </Box>
            );
        }

        if (orderDetails.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                        注文詳細データがありません
                    </Typography>
                </Box>
            );
        }

        return (
            <TableContainer sx={{ maxHeight: 400, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>商品名</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>単価</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>数量</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>小計</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {orderDetails.map((detail, index) => (
                            <TableRow key={detail.itemId || `detail-${index}`} hover>
                                <TableCell>
                                    <Typography variant="body2">
                                        {detail.productName || 'N/A'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2">
                                        {detail.unitPrice ? formatCurrency(detail.unitPrice) : 'N/A'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <Typography variant="body2">
                                        {detail.quantity || 0}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2" fontWeight="medium">
                                        {detail.subtotal ? formatCurrency(detail.subtotal) : 'N/A'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }, [loadingDetails, orderDetails]);

    // 詳細モーダルコンポーネント
    const DetailModal = useCallback(() => {
        if (!modalState.selectedItem) return null;

        const { selectedItem } = modalState;

        return (
            <Modal open={modalState.open} onClose={handleCloseModal}>
                <Paper sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: 1200,
                    maxHeight: '90vh',
                    p: 3,
                    overflow: 'auto'
                }}>
                    <Box sx={{ mb: 3, pb: 2, borderBottom: '1px solid #ccc' }}>
                        <Typography variant="h5" gutterBottom>
                            注文詳細情報
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Typography variant="h6" color="primary">
                                {selectedItem.orderId}
                            </Typography>
                            {selectedItem.category && (
                                <Chip
                                    label={selectedItem.category}
                                    size="small"
                                    sx={{
                                        backgroundColor: CATEGORY_STYLES[selectedItem.category as keyof typeof CATEGORY_STYLES]?.backgroundColor || CATEGORY_STYLES['その他'].backgroundColor,
                                        color: CATEGORY_STYLES[selectedItem.category as keyof typeof CATEGORY_STYLES]?.color || CATEGORY_STYLES['その他'].color,
                                        fontWeight: 'bold',
                                        border: 'none'
                                    }}
                                />
                            )}
                        </Box>
                    </Box>

                    {/* 基本情報 */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    基本情報
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">注文番号</Typography>
                                        <Typography variant="body1" fontWeight="bold">{selectedItem.orderId}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">ドキュメント名</Typography>
                                        <Typography variant="body1">{selectedItem.documentName || 'N/A'}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">注文日</Typography>
                                        <Typography variant="body1">
                                            {selectedItem.orderDate
                                                ? new Date(selectedItem.orderDate).toLocaleDateString('ja-JP')
                                                : 'N/A'
                                            }
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">カテゴリ</Typography>
                                        <Typography variant="body1">{selectedItem.category || 'その他'}</Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    金額情報
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">小計</Typography>
                                        <Typography variant="body1">
                                            {selectedItem.subtotal ? formatCurrency(selectedItem.subtotal) : 'N/A'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">送料</Typography>
                                        <Typography variant="body1">
                                            {selectedItem.shippingFee ? formatCurrency(selectedItem.shippingFee) : 'N/A'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" color="textSecondary">合計金額</Typography>
                                        <Typography variant="h6" color="primary" fontWeight="bold">
                                            {selectedItem.totalAmount ? formatCurrency(selectedItem.totalAmount) : 'N/A'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Grid container spacing={3}>
                        {/* 画像表示 */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    アップロード画像
                                </Typography>
                                <Box sx={{ textAlign: 'center', border: '1px solid #ddd', borderRadius: 1, p: 2, backgroundColor: '#fafafa' }}>
                                    {selectedItem.documentUri ? (
                                        <StorageImage
                                            alt={selectedItem.documentName || 'OCR処理画像'}
                                            path={selectedItem.documentUri}
                                            fallbackSrc="/placeholder-image.png"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '500px',
                                                objectFit: 'contain',
                                                borderRadius: '4px'
                                            }}
                                        />
                                    ) : (
                                        <Typography color="textSecondary">
                                            画像が利用できません
                                        </Typography>
                                    )}
                                </Box>
                            </Paper>
                        </Grid>

                        {/* 注文詳細一覧表示 */}
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom color="primary">
                                    注文詳細一覧
                                </Typography>
                                <OrderDetailTable />

                                {/* 合計表示 */}
                                {orderDetails.length > 0 && (
                                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="body2" color="textSecondary">
                                                商品点数: {orderDetails.reduce((sum, detail) => sum + (detail.quantity || 0), 0)}点
                                            </Typography>
                                            <Typography variant="h6" color="primary" fontWeight="bold">
                                                小計: {formatCurrency(orderDetails.reduce((sum, detail) => sum + (detail.subtotal || 0), 0))}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>

                    <Box sx={{
                        mt: 3,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: 2,
                        borderTop: '1px solid #ccc'
                    }}>
                        <Typography variant="body2" color="textSecondary">
                            処理日時: {new Date(selectedItem.createdAt).toLocaleString('ja-JP')}
                        </Typography>
                        <Button onClick={handleCloseModal} variant="contained" size="large">
                            閉じる
                        </Button>
                    </Box>
                </Paper>
            </Modal>
        );
    }, [modalState, orderDetails, handleCloseModal, OrderDetailTable]);

    // メインコンテンツ
    const MainContent = useCallback(() => {
        if (loading) {
            return (
                <Box sx={{ textAlign: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        データを読み込み中...
                    </Typography>
                </Box>
            );
        }

        if (ocrData.length === 0) {
            return (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body1" color="textSecondary">
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
    }, [loading, ocrData.length, displayedData, handleRowClick, handleDeleteClick, page, rowsPerPage, handleChangePage, handleChangeRowsPerPage]);

    // データテーブルコンポーネント
    const DataTable = useCallback(({
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
                        <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>注文番号</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>ドキュメント名</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', minWidth: 140 }}>処理日時</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>カテゴリ</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', width: 80, textAlign: 'center' }}>削除</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow
                            key={item.orderId || `ocr-item-${index}`}
                            hover
                            onClick={() => onRowClick(item)}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell>
                                <Typography variant="body2" fontWeight="medium" color="primary">
                                    {truncateText(item.orderId || '', 15)}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {truncateText(item.documentName || 'N/A', 30)}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2">
                                    {new Date(item.createdAt).toLocaleString('ja-JP', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    })}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                {item.category ? (
                                    <Chip
                                        label={item.category}
                                        size="small"
                                        sx={{
                                            backgroundColor: CATEGORY_STYLES[item.category as keyof typeof CATEGORY_STYLES]?.backgroundColor || CATEGORY_STYLES['その他'].backgroundColor,
                                            color: CATEGORY_STYLES[item.category as keyof typeof CATEGORY_STYLES]?.color || CATEGORY_STYLES['その他'].color,
                                            fontWeight: 'bold',
                                            border: 'none',
                                            '&:hover': {
                                                backgroundColor: CATEGORY_STYLES[item.category as keyof typeof CATEGORY_STYLES]?.backgroundColor || CATEGORY_STYLES['その他'].backgroundColor,
                                                opacity: 0.8
                                            }
                                        }}
                                    />
                                ) : (
                                    <Chip
                                        label="その他"
                                        size="small"
                                        sx={{
                                            backgroundColor: CATEGORY_STYLES['その他'].backgroundColor,
                                            color: CATEGORY_STYLES['その他'].color,
                                            fontWeight: 'bold',
                                            border: 'none'
                                        }}
                                    />
                                )}
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
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    ), []);

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
                                注文番号: <strong>{deleteState.itemToDelete.orderId}</strong><br />
                                ドキュメント: <strong>{deleteState.itemToDelete.documentName}</strong><br />
                                のレコードを削除します。この操作は元に戻せません。
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
                        {deleteState.loading ? '削除中...' : '削除'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}