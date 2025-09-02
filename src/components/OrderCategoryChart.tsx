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
  Stack
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

const OrderCategoryChart: React.FC = () => {
  const [data, setData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データ処理を関数として分離
  const processOrderData = useCallback((orders: any[]) => {
    if (!orders || orders.length === 0) {
      setData([]);
      return;
    }

    // 集計用の型定義
    type CategoryTotal = {
      totalAmount: number;
      orderCount: number;
    };

    // カテゴリ別に集計
    const categoryTotals = orders.reduce((acc, order) => {
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
    }, {} as Record<string, CategoryTotal>);


    // チャート用データに変換
    const chartData = (Object.entries(categoryTotals) as Array<[string, CategoryTotal]>).map(([category, categoryData]) => ({
      category,
      totalAmount: categoryData.totalAmount,
      orderCount: categoryData.orderCount,
      color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#8884D8'
    }));

    // 金額順でソート
    chartData.sort((a, b) => b.totalAmount - a.totalAmount);
    setData(chartData);
  }, []);

  // 初期データ取得
  const fetchOrderData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: orders } = await client.models.OrderHeader.list();
      processOrderData(orders);
    } catch (err) {
      console.error('データの取得に失敗しました:', err);
      setError('データの取得に失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [processOrderData]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

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
          processOrderData(items);
          setLoading(false);
        }
      },
      error: (error) => {
        console.error('リアルタイム更新エラー:', error);
        setError('リアルタイム更新でエラーが発生しました');
        setLoading(false);
      }
    });

    // クリーンアップ関数
    return () => {
      console.log('リアルタイム更新を停止します...');
      subscription.unsubscribe();
    };
  }, [processOrderData]);

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
    if (percent < 0.05) return null; // 5%未満は表示しない

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
          <button onClick={fetchOrderData}>再試行</button>
        </Box>
      </Alert>
    );
  }

  if (data.length === 0) {
    return (
      <Alert severity="info">
        データがありません。注文データを追加してください。
      </Alert>
    );
  }

  const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.orderCount, 0);

  return (
    <Box>
      {/* リアルタイム更新インジケーター */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">
          カテゴリ別グッズ注文データ
        </Typography>
        <Chip
          label="リアルタイム更新中"
          color="success"
          size="small"
          variant="outlined"
        />
      </Box>

      {/* サマリー情報 */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip
          label={`総額: ${formatCurrency(totalAmount)}`}
          color="primary"
          variant="outlined"
        />
        <Chip
          label={`総注文数: ${totalOrders}件`}
          color="secondary"
          variant="outlined"
        />
      </Stack>

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
              // アニメーション追加
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
                transition: 'all 0.3s ease' // スムーズな更新アニメーション
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