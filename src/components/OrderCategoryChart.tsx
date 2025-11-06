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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button
} from '@mui/material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip 
} from 'recharts';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// カテゴリ別カラーパレット
const CATEGORY_COLORS = {
  'ホロライブ': '#EAB3B8',
  'にじさんじ': '#31BCD4',
  'SIXFONIA': '#008000',
  'その他': '#FF8042'
} as const;

interface CategoryData {
  category: string;
  totalAmount: number;
  orderCount: number;
  color: string;
}

interface PeriodFilter {
  year: number | 'all';
  month: number | 'all';
}

const OrderCategoryChart: React.FC = () => {
  const [data, setData] = useState<CategoryData[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    year: 'all',
    month: 'all'
  });
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);

  // データ処理を関数として分離
  const processOrderData = useCallback((orders: any[], filter: PeriodFilter) => {
    if (!orders || orders.length === 0) {
      setData([]);
      return;
    }

    // 期間フィルターを適用（注文日ベース）
    const filteredOrders = orders.filter(order => {
      // orderDateが存在しない場合は除外
      if (!order.orderDate) return false;
      
      const orderDate = new Date(order.orderDate);
      
      // 無効な日付の場合は除外
      if (isNaN(orderDate.getTime())) return false;
      
      const orderYear = orderDate.getFullYear();
      const orderMonth = orderDate.getMonth() + 1; // 0ベースなので+1
      
      // 年のフィルター
      if (filter.year !== 'all' && orderYear !== filter.year) {
        return false;
      }
      
      // 月のフィルター
      if (filter.month !== 'all' && orderMonth !== filter.month) {
        return false;
      }
      
      return true;
    });

    console.log(`フィルター適用結果: ${filteredOrders.length}件 (全体: ${orders.length}件)`);
    console.log('フィルター条件:', filter);

    // カテゴリ別に集計
    const categoryTotals = filteredOrders.reduce((acc, order) => {
      const category = order.category || 'その他';
      const amount = order.totalAmount || 0;
      
      if (acc[category]) {
        acc[category].totalAmount += amount;
        acc[category].orderCount += 1;
      } else {
        acc[category] = {
          totalAmount: amount,
          orderCount: 1
        };
      }
      
      return acc;
    }, {} as Record<string, { totalAmount: number; orderCount: number }>);

    // チャート用データに変換
    const chartData = (Object.entries(categoryTotals) as Array<[string, { totalAmount: number; orderCount: number }]>).map(([category, categoryData]) => ({
      category,
      totalAmount: categoryData.totalAmount,
      orderCount: categoryData.orderCount,
      color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#8884D8'
    }));

    // 金額順でソート
    chartData.sort((a, b) => b.totalAmount - a.totalAmount);
    setData(chartData);
  }, []);

  // 利用可能な年月を更新（注文日ベース）
  const updateAvailablePeriods = useCallback((orders: any[]) => {
    const years = new Set<number>();
    const months = new Set<number>();
    
    orders.forEach(order => {
      if (order.orderDate) {
        const orderDate = new Date(order.orderDate);
        
        // 有効な日付のみ処理
        if (!isNaN(orderDate.getTime())) {
          years.add(orderDate.getFullYear());
          months.add(orderDate.getMonth() + 1);
        }
      }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    const sortedMonths = Array.from(months).sort((a, b) => a - b);
    
    console.log('利用可能な年:', sortedYears);
    console.log('利用可能な月:', sortedMonths);
    
    setAvailableYears(sortedYears);
    setAvailableMonths(sortedMonths);
  }, []);

  // 初期データ取得
  const fetchOrderData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: orders } = await client.models.OrderHeader.list();
      
      console.log('取得したデータ数:', orders.length);
      console.log('サンプルデータ:', orders.slice(0, 3).map(order => ({
        orderId: order.orderId,
        orderDate: order.orderDate,
        createdAt: order.createdAt
      })));
      
      setAllOrders(orders);
      updateAvailablePeriods(orders);
      processOrderData(orders, periodFilter);
    } catch (err) {
      console.error('データの取得に失敗しました:', err);
      setError('データの取得に失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [processOrderData, periodFilter, updateAvailablePeriods]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  // 期間フィルター変更時の処理
  useEffect(() => {
    if (allOrders.length > 0) {
      processOrderData(allOrders, periodFilter);
    }
  }, [periodFilter, allOrders, processOrderData]);

  // リアルタイム更新のサブスクリプション
  useEffect(() => {
    console.log('リアルタイム更新を開始します...');
    
    const subscription = client.models.OrderHeader.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        console.log('リアルタイム更新受信:', { 
          itemCount: items.length, 
          isSynced,
          timestamp: new Date().toISOString()
        });
        
        if (isSynced) {
          setAllOrders(items);
          updateAvailablePeriods(items);
          processOrderData(items, periodFilter);
          setLoading(false);
        }
      },
      error: (error) => {
        console.error('リアルタイム更新エラー:', error);
        setError('リアルタイム更新でエラーが発生しました');
        setLoading(false);
      }
    });

    return () => {
      console.log('リアルタイム更新を停止します...');
      subscription.unsubscribe();
    };
  }, [processOrderData, periodFilter, updateAvailablePeriods]);

  // 期間フィルターのハンドラー
  const handleYearChange = (year: number | 'all') => {
    setPeriodFilter(prev => ({ ...prev, year }));
  };

  const handleMonthChange = (month: number | 'all') => {
    setPeriodFilter(prev => ({ ...prev, month }));
  };

  const handleResetFilter = () => {
    setPeriodFilter({ year: 'all', month: 'all' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: 1,
            padding: 2,
            boxShadow: 3
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {data.category}
          </Typography>
          <Typography variant="body2" color="primary">
            金額: {formatCurrency(data.totalAmount)}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            注文数: {data.orderCount}件
          </Typography>
        </Box>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  // 期間表示用のテキスト
  const getPeriodText = () => {
    if (periodFilter.year === 'all' && periodFilter.month === 'all') {
      return '全期間';
    }
    
    let text = '';
    if (periodFilter.year !== 'all') {
      text += `${periodFilter.year}年`;
    }
    if (periodFilter.month !== 'all') {
      text += `${periodFilter.month}月`;
    }
    
    return text || '全期間';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={400}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          データを読み込み中...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Box textAlign="center" sx={{ mt: 1 }}>
          <Button onClick={fetchOrderData} variant="outlined" size="small">
            再試行
          </Button>
        </Box>
      </Alert>
    );
  }

  const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.orderCount, 0);

  return (
    <Box>
      {/* ヘッダーとフィルター */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            グッズ注文分析 ({getPeriodText()})
          </Typography>
          <Chip 
            label="リアルタイム更新中" 
            color="success" 
            size="small"
            variant="outlined"
          />
        </Box>

        {/* 期間フィルター */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>注文年</InputLabel>
              <Select
                value={periodFilter.year}
                label="注文年"
                onChange={(e) => handleYearChange(e.target.value as number | 'all')}
              >
                <MenuItem value="all">全ての年</MenuItem>
                {availableYears.map(year => (
                  <MenuItem key={year} value={year}>{year}年</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>注文月</InputLabel>
              <Select
                value={periodFilter.month}
                label="注文月"
                onChange={(e) => handleMonthChange(e.target.value as number | 'all')}
              >
                <MenuItem value="all">全ての月</MenuItem>
                {availableMonths.map(month => (
                  <MenuItem key={month} value={month}>{month}月</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button 
              variant="outlined" 
              onClick={handleResetFilter}
              fullWidth
              size="small"
            >
              フィルターリセット
            </Button>
          </Grid>
        </Grid>

        {/* デバッグ情報（開発時のみ表示） */}
        {process.env.NODE_ENV === 'development' && (
          <Box sx={{ mb: 2, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="caption" color="textSecondary">
              デバッグ: 全データ{allOrders.length}件 / 
              注文日あり{allOrders.filter(o => o.orderDate).length}件 / 
              表示中{data.reduce((sum, item) => sum + item.orderCount, 0)}件
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* サマリー情報 */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip 
          label={`総注文: ${formatCurrency(totalAmount)}`}
          color="success"
          variant="filled"
        />
        <Chip 
          label={`総注文数: ${totalOrders}件`}
          color="info"
          variant="filled"
        />
      </Stack>

      {data.length === 0 ? (
        <Alert severity="info">
          選択した期間にデータがありません。注文日が設定されているデータのみ表示されます。
        </Alert>
      ) : (
        <>
          {/* 円グラフ */}
          <Box height={400}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={CustomLabel}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="totalAmount"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={(value, entry) => (
                    <span style={{ color: entry.color }}>
                      {(entry.payload as CategoryData).category} ({formatCurrency((entry.payload as CategoryData).totalAmount)})
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>

          {/* 詳細テーブル */}
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              詳細データ
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.map((item, index) => (
                <Box 
                  key={index}
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1,
                    backgroundColor: 'grey.50',
                    borderRadius: 1,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        backgroundColor: item.color,
                        borderRadius: '50%'
                      }} 
                    />
                    <Typography variant="body2" fontWeight="medium">
                      {item.category}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(item.totalAmount)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {item.orderCount}件 ({((item.totalAmount / totalAmount) * 100).toFixed(1)}%)
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </>
      )}

      {/* 最終更新時刻表示 */}
      <Box sx={{ mt: 2, textAlign: 'right' }}>
        <Typography variant="caption" color="textSecondary">
          最終更新: {new Date().toLocaleTimeString('ja-JP')}
        </Typography>
      </Box>
    </Box>
  );
};

export default OrderCategoryChart;