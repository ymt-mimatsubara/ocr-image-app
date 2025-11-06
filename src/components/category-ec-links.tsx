import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  Avatar
} from '@mui/material';
import {
  Launch as LaunchIcon,
  Store as StoreIcon
} from '@mui/icons-material';

// カテゴリ別ECサイト情報
const EC_SITES = {
  'ホロライブ': {
    name: 'HOLOSTARS OFFICIAL STORE',
    url: 'https://holostars.hololivepro.com/goods/',
    description: 'ホロスターズの公式グッズストア',
    color: '#EAB3B8',
    icon: '⭐'
  },
  'にじさんじ': {
    name: 'NIJISANJI OFFICIAL STORE',
    url: 'https://shop.nijisanji.jp/',
    description: 'にじさんじの公式グッズストア',
    color: '#31BCD4',
    icon: '🌈'
  },
  'SIXFONIA': {
    name: 'SIXFONIA OFFICIAL STORE',
    url: 'https://shop.sixfonia.com/',
    description: 'SIXFONIAの公式グッズストア',
    color: '#008000',
    icon: '🎼'
  },
  'その他': {
    name: '一般ECサイト',
    url: 'https://www.amazon.co.jp/',
    description: 'その他の商品を検索',
    color: '#FF8042',
    icon: '🛍️'
  }
} as const;

interface CategoryEcLinksProps {
  /** 表示するカテゴリを限定する場合に指定 */
  categories?: Array<keyof typeof EC_SITES>;
  /** カードのサイズ設定 */
  cardSize?: 'small' | 'medium' | 'large';
}

const CategoryEcLinks: React.FC<CategoryEcLinksProps> = ({
  categories = ['ホロライブ', 'にじさんじ', 'SIXFONIA'],
  cardSize = 'medium'
}) => {
  const handleSiteOpen = (url: string, siteName: string) => {
    // 別タブで開く
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // アナリティクス用のログ（必要に応じて）
    console.log(`ECサイトを開きました: ${siteName}`);
  };

  const getCardDimensions = () => {
    switch (cardSize) {
      case 'small': return { height: 180, aspectRatio: '1/1' };
      case 'large': return { height: 240, aspectRatio: '1/1' };
      default: return { height: 200, aspectRatio: '1/1' };
    }
  };

  const getGridSize = () => {
    switch (cardSize) {
      case 'small': return { xs: 6, sm: 4, md: 4 };
      case 'large': return { xs: 12, sm: 6, md: 4 };
      default: return { xs: 12, sm: 6, md: 4 };
    }
  };

  return (
    <Box sx={{ width: '100%', overflow: 'visible' }}>
      <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
        カテゴリ別ECサイト
      </Typography>
      
      <Grid container spacing={3}>
        {categories.map((category) => {
          const site = EC_SITES[category];
          
          return (
            <Grid key={category} size={getGridSize()}>
              <Card
                sx={{
                  ...getCardDimensions(),
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  width: '100%',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                    '& .launch-button': {
                      backgroundColor: site.color,
                      color: 'white'
                    }
                  }
                }}
                onClick={() => handleSiteOpen(site.url, site.name)}
              >
                <CardContent sx={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  p: 2,
                  height: '100%'
                }}>
                  {/* 上部コンテンツ */}
                  <Box sx={{ textAlign: 'center' }}>
                    {/* アイコン */}
                    <Avatar
                      sx={{
                        backgroundColor: site.color,
                        color: 'white',
                        width: cardSize === 'small' ? 48 : 56,
                        height: cardSize === 'small' ? 48 : 56,
                        fontSize: cardSize === 'small' ? '1.5rem' : '1.8rem',
                        mx: 'auto',
                        mb: 2
                      }}
                    >
                      {site.icon}
                    </Avatar>

                    {/* カテゴリ名 */}
                    <Typography 
                      variant={cardSize === 'small' ? 'subtitle2' : 'h6'} 
                      fontWeight="bold"
                      sx={{ mb: 1 }}
                    >
                      {category}
                    </Typography>

                    {/* サイト名 */}
                    <Typography 
                      variant={cardSize === 'small' ? 'caption' : 'body2'} 
                      color="textSecondary"
                      sx={{ 
                        mb: cardSize === 'small' ? 1 : 2,
                        fontSize: cardSize === 'small' ? '0.75rem' : '0.875rem'
                      }}
                    >
                      {site.name}
                    </Typography>

                    {/* 説明文 */}
                    <Typography 
                      variant="caption" 
                      color="textSecondary"
                      sx={{ 
                        display: 'block',
                        fontSize: cardSize === 'small' ? '0.7rem' : '0.75rem',
                        lineHeight: 1.3
                      }}
                    >
                      {site.description}
                    </Typography>
                  </Box>

                  {/* アクションボタン */}
                  <Button
                    className="launch-button"
                    variant="outlined"
                    size={cardSize === 'small' ? 'small' : 'medium'}
                    startIcon={<LaunchIcon />}
                    fullWidth
                    sx={{
                      borderColor: site.color,
                      color: site.color,
                      '&:hover': {
                        borderColor: site.color,
                        backgroundColor: site.color,
                        color: 'white'
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSiteOpen(site.url, site.name);
                    }}
                  >
                    サイトを開く
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* 注意事項 */}
      <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="caption" color="textSecondary" display="flex" alignItems="center">
          <StoreIcon sx={{ fontSize: 16, mr: 0.5 }} />
          各ECサイトは別タブで開きます。購入時は各サイトの利用規約をご確認ください。
        </Typography>
      </Box>
    </Box>
  );
};

export default CategoryEcLinks;
