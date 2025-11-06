import React, { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Button,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as ShoppingCartIcon
} from '@mui/icons-material';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// カテゴリ別カラーパレット（OrderCategoryChartと統一）
const CATEGORY_COLORS = {
  'ホロライブ': '#EAB3B8',
  'にじさんじ': '#31BCD4',
  'SIXFONIA': '#008000',
  'その他': '#FF8042'
} as const;

// 型定義
interface OrderWithDetails {
  orderId: string;
  orderDate?: string;
  subtotal?: number;
  shippingFee?: number;
  totalAmount?: number;
  category?: string;
  documentName: string;
  documentUri: string;
  content?: any;
  createdAt: string;
  updatedAt: string;
  orderDetails?: Array<{
    itemId: string;
    productName: string;
    unitPrice?: number;
    quantity?: number;
    subtotal?: number;
  }>;
}

interface FilterState {
  category: string;
  dateRange: string;
  searchTerm: string;
}

const LatestOrders: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    dateRange: 'all',
    searchTerm: ''
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // カテゴリカラーを取得する関数
  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS['その他'];
  };

  // 通貨フォーマット
  const formatCurrency = (value: number | undefined) => {
    if (!value && value !== 0) return '¥0';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(value);
  };

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 注文詳細の取得
  const fetchOrderDetails = useCallback(async (orderHeaderId: string) => {
    try {
      const { data: details } = await client.models.OrderDetail.list({
        filter: { orderHeaderId: { eq: orderHeaderId } }
      });
      return details;
    } catch (err) {
      console.error('注文詳細の取得に失敗:', err);
      return [];
    }
  }, []);

  // データ取得
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 注文ヘッダーを取得（作成日時でソート）
      const { data: orderHeaders } = await client.models.OrderHeader.list();
      
      // 作成日時で降順ソート（最新が上）
      const sortedHeaders = orderHeaders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // 上位50件に制限
      const limitedHeaders = sortedHeaders.slice(0, 50);

      console.log('取得した注文数:', limitedHeaders.length);

      // カテゴリ一覧を更新
      const categories = Array.from(new Set(
        orderHeaders
          .map(order => order.category)
          .filter((category): category is string => Boolean(category))
      ));
      setAvailableCategories(categories);

      // 各注文の詳細を並列取得
      const ordersWithDetails = await Promise.all(
        limitedHeaders.map(async (header) => {
          const details = await fetchOrderDetails(header.orderId);
          return {
            ...header,
            orderDetails: details
          } as OrderWithDetails;
        })
      );

      setOrders(ordersWithDetails);
      console.log('詳細付き注文データ:', ordersWithDetails.slice(0, 3));

    } catch (err) {
      console.error('データの取得に失敗:', err);
      setError('データの取得に失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [fetchOrderDetails]);

  // 初期データ取得
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // リアルタイム更新
  useEffect(() => {
    console.log('最新注文のリアルタイム更新を開始...');
    
    const subscription = client.models.OrderHeader.observeQuery().subscribe({
      next: async ({ items, isSynced }) => {
        console.log('リアルタイム更新受信:', { 
          itemCount: items.length, 
          isSynced,
          timestamp: new Date().toISOString()
        });
        
        if (isSynced) {
          // 作成日時で降順ソート
          const sortedItems = items.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          // 上位50件に制限
          const limitedItems = sortedItems.slice(0, 50);

          // 各注文の詳細を取得
          const ordersWithDetails = await Promise.all(
            limitedItems.map(async (header) => {
              const details = await fetchOrderDetails(header.orderId);
              return {
                ...header,
                orderDetails: details
              } as OrderWithDetails;
            })
          );

          setOrders(ordersWithDetails);
          setLoading(false);

          // カテゴリ一覧を更新
          const categories = Array.from(new Set(
            items
              .map(order => order.category)
              .filter((category): category is string => Boolean(category))
          ));
          setAvailableCategories(categories);
        }
      },
      error: (error) => {
        console.error('リアルタイム更新エラー:', error);
        setError('リアルタイム更新でエラーが発生しました');
        setLoading(false);
      }
    });

    return () => {
      console.log('最新注文のリアルタイム更新を停止...');
      subscription.unsubscribe();
    };
  }, [fetchOrderDetails]);

  // 展開/折りたたみの切り替え
  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // フィルタリング処理
  const filteredOrders = orders.filter(order => {
    // カテゴリフィルター
    if (filters.category !== 'all' && order.category !== filters.category) {
      return false;
    }

    // 検索フィルター
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesOrderId = order.orderId.toLowerCase().includes(searchLower);
      const matchesCategory = order.category?.toLowerCase().includes(searchLower);
      const matchesProduct = order.orderDetails?.some(detail => 
        detail.productName.toLowerCase().includes(searchLower)
      );
      
      if (!matchesOrderId && !matchesCategory && !matchesProduct) {
        return false;
      }
    }

    // 日付フィルター
    if (filters.dateRange !== 'all') {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          if (orderDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (orderDate < monthAgo) return false;
          break;
      }
    }

    return true;
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={400}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          最新の注文情報を読み込み中...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Box textAlign="center" sx={{ mt: 1 }}>
          <Button onClick={fetchOrders} variant="outlined" size="small">
            再試行
          </Button>
        </Box>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100vw' }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShoppingCartIcon color="primary" />
          <Typography variant="h5" component="h1" fontWeight="bold">
            最新注文情報
          </Typography>
          <Chip 
            label="リアルタイム更新中" 
            color="success" 
            size="small"
            variant="outlined"
          />
        </Box>
        <Tooltip title="手動更新">
          <IconButton onClick={fetchOrders} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* フィルター */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            フィルター
          </Typography>
          <Grid container spacing={2} sx={{ width: '100%' }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="注文ID、カテゴリ、商品名で検索"
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>カテゴリ</InputLabel>
                <Select
                  value={filters.category}
                  label="カテゴリ"
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  <MenuItem value="all">全てのカテゴリ</MenuItem>
                  {availableCategories.map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>期間</InputLabel>
                <Select
                  value={filters.dateRange}
                  label="期間"
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                >
                  <MenuItem value="all">全期間</MenuItem>
                  <MenuItem value="today">今日</MenuItem>
                  <MenuItem value="week">過去1週間</MenuItem>
                  <MenuItem value="month">過去1ヶ月</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* サマリー */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Chip 
          label={`表示中: ${filteredOrders.length}件`}
          color="info"
          variant="filled"
        />
        <Chip 
          label={`総注文額: ${formatCurrency(filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0))}`}
          color="success"
          variant="filled"
        />
        {filters.category !== 'all' && (
          <Chip 
            label={`カテゴリ: ${filters.category}`}
            size="small"
            sx={{
              backgroundColor: getCategoryColor(filters.category),
              color: 'white',
              fontWeight: 'bold'
            }}
          />
        )}
      </Stack>

      {/* 注文一覧 */}
      {filteredOrders.length === 0 ? (
        <Alert severity="info">
          条件に一致する注文がありません。
        </Alert>
      ) : (
        <Stack spacing={2}>
          {filteredOrders.map((order) => (
            <Card key={order.orderId} elevation={2}>
              <CardContent>
                {/* 注文ヘッダー情報 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ReceiptIcon color="action" fontSize="small" />
                      <Typography variant="h6" fontWeight="bold">
                        注文ID: {order.orderId}
                      </Typography>
                      {order.category && (
                        <Chip 
                          label={order.category} 
                          size="small" 
                          sx={{
                            backgroundColor: getCategoryColor(order.category),
                            color: 'white',
                            fontWeight: 'bold',
                            '&:hover': {
                              backgroundColor: getCategoryColor(order.category),
                              opacity: 0.8
                            }
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      作成日時: {formatDate(order.createdAt)}
                    </Typography>
                    {order.orderDate && (
                      <Typography variant="body2" color="textSecondary">
                        注文日: {order.orderDate}
                      </Typography>
                    )}
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {formatCurrency(order.totalAmount)}
                    </Typography>
                    {order.orderDetails && order.orderDetails.length > 0 && (
                      <Typography variant="caption" color="textSecondary">
                        {order.orderDetails.length}商品
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* 金額詳細 */}
                {(order.subtotal || order.shippingFee) && (
                  <Box sx={{ mb: 2 }}>
                    <Grid container spacing={2}>
                      {order.subtotal && (
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2">
                            小計: {formatCurrency(order.subtotal)}
                          </Typography>
                        </Grid>
                      )}
                      {order.shippingFee && (
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2">
                            送料: {formatCurrency(order.shippingFee)}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}

                {/* 展開ボタン */}
                {order.orderDetails && order.orderDetails.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Button
                        onClick={() => toggleExpand(order.orderId)}
                        endIcon={expandedOrders.has(order.orderId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        size="small"
                      >
                        注文詳細 ({order.orderDetails.length}商品)
                      </Button>
                    </Box>

                    {/* 注文詳細 */}
                    <Collapse in={expandedOrders.has(order.orderId)}>
                      <Box sx={{ mt: 2 }}>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>商品名</TableCell>
                                <TableCell align="right">単価</TableCell>
                                <TableCell align="right">数量</TableCell>
                                <TableCell align="right">小計</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {order.orderDetails.map((detail) => (
                                <TableRow key={detail.itemId}>
                                  <TableCell>{detail.productName}</TableCell>
                                  <TableCell align="right">
                                    {formatCurrency(detail.unitPrice)}
                                  </TableCell>
                                  <TableCell align="right">{detail.quantity}</TableCell>
                                  <TableCell align="right">
                                    {formatCurrency(detail.subtotal)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    </Collapse>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* 最終更新時刻 */}
      <Box sx={{ mt: 3, textAlign: 'right' }}>
        <Typography variant="caption" color="textSecondary">
          最終更新: {new Date().toLocaleTimeString('ja-JP')}
        </Typography>
      </Box>
    </Box>
  );
};

export default LatestOrders;
