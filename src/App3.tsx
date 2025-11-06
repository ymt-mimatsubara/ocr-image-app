import { useState, useRef, useEffect } from "react";
import { signOut } from "aws-amplify/auth";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Paper,
  Button,
  CssBaseline,
  IconButton,
  Avatar,
  Divider,
  Fade,
  TextField,
  InputAdornment,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
} from "@mui/material";
import {
  Logout as LogoutIcon,
  Send as SendIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Mic as MicIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  AccountBalance as AccountBalanceIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";


// チャットメッセージの型定義
interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
}

export default function App() {
  // 状態管理
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: '総務チャットボットへようこそ！何かご質問がございましたら、お気軽にお聞かせください。',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // メッセージリストを自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // チャットメッセージを追加
  const addChatMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, newMessage]);
  };

  // 簡単なチャットボット応答システム
  const getBotResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('こんにちは') || message.includes('はじめまして')) {
      return 'こんにちは！総務チャットボットです。何かお手伝いできることはありますか？';
    }
    
    if (message.includes('経費') || message.includes('請求')) {
      return '経費に関するご質問ですね。経費申請の手続きや必要書類について詳しくご説明いたします。具体的にどのような内容でしょうか？';
    }
    
    if (message.includes('休暇') || message.includes('有給')) {
      return '休暇申請についてのお問い合わせですね。有給休暇の申請方法や残日数の確認方法についてサポートいたします。';
    }
    
    if (message.includes('備品') || message.includes('消耗品')) {
      return '備品・消耗品の発注に関するご相談ですね。発注手続きや承認フローについてご案内いたします。';
    }
    
    if (message.includes('ありがとう')) {
      return 'どういたしまして！他にもご不明な点がございましたら、お気軽にお声かけください。';
    }
    
    return 'ご質問ありがとうございます。総務に関することでしたら何でもお答えします。経費申請、休暇申請、備品発注など、具体的な内容をお聞かせください。';
  };

  // メッセージ送信
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    addChatMessage({
      type: 'user',
      content: userMsg
    });

    setInputMessage('');
    setIsTyping(true);

    // ボットの応答（タイピング効果付き）
    setTimeout(() => {
      setIsTyping(false);
      addChatMessage({
        type: 'bot',
        content: getBotResponse(userMsg)
      });
    }, 1500);
  };

  // Enterキーでメッセージ送信
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // ドロワーの開閉
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  // メニューの展開/折りたたみ
  const handleMenuExpand = (menuId: string) => {
    setExpandedMenu(expandedMenu === menuId ? null : menuId);
  };

  // メニューアイテムクリック処理
  const handleMenuItemClick = (item: string) => {
    addChatMessage({
      type: 'user',
      content: `${item}について教えてください`
    });
    
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      let response = '';
      
      switch (item) {
        case '社内規定':
          response = '社内規定に関するご質問ですね。就業規則、服務規程、情報セキュリティポリシーなど、どの規定についてお知りになりたいですか？';
          break;
        case '社員就業規則':
          response = '社員就業規則についてご案内いたします。勤務時間、休暇制度、服務規律など、具体的にどの項目についてお聞きになりたいですか？';
          break;
        case '年末調整':
          response = '年末調整に関するサポートをいたします。必要書類の準備、提出期限、控除項目など、どのような内容でお困りでしょうか？';
          break;
        case '会話履歴':
          response = '会話履歴機能は現在開発中です。過去の質問内容を確認したい場合は、具体的な内容をお聞かせください。';
          break;
        default:
          response = `${item}に関するご質問を承りました。詳細な内容をお聞かせください。`;
      }
      
      addChatMessage({
        type: 'bot',
        content: response
      });
    }, 1500);
  };

  return (
    <>
      <CssBaseline />
      <Box sx={{
        flexGrow: 1,
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        display: 'flex',
        background: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
        overflow: 'hidden'
      }}>
        {/* アイコンサイドバー（常時表示） */}
        <Box sx={{
          width: 64,
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2
        }}>
          {/* メニュー展開ボタン */}
          <IconButton 
            onClick={toggleDrawer}
            sx={{ 
              mb: 2,
              color: '#1976d2',
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.1)'
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Divider sx={{ width: '80%', mb: 2 }} />
          
          {/* アイコンメニュー */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <IconButton 
              onClick={() => handleMenuItemClick('社内規定')}
              sx={{ 
                color: '#1976d2',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.1)'
                }
              }}
              title="社内規定"
            >
              <BusinessIcon />
            </IconButton>
            
            <IconButton 
              onClick={() => handleMenuItemClick('年末調整')}
              sx={{ 
                color: '#1976d2',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.1)'
                }
              }}
              title="年末調整"
            >
              <AccountBalanceIcon />
            </IconButton>
            
            <IconButton 
              onClick={() => handleMenuItemClick('会話履歴')}
              sx={{ 
                color: '#1976d2',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.1)'
                }
              }}
              title="会話履歴"
            >
              <HistoryIcon />
            </IconButton>
          </Box>
        </Box>

        {/* 詳細サイドバー */}
        <Box sx={{
          width: drawerOpen ? 280 : 0,
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)',
          backdropFilter: 'blur(20px)',
          borderRight: drawerOpen ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
          zIndex: 1200
        }}>
          <Box sx={{ p: 2, width: 280 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                メニュー
              </Typography>
              <IconButton onClick={toggleDrawer} size="small">
                <ChevronLeftIcon />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <List>
              {/* 社内規定 */}
              <ListItemButton onClick={() => handleMenuExpand('regulations')}>
                <ListItemIcon>
                  <BusinessIcon sx={{ color: '#1976d2' }} />
                </ListItemIcon>
                <ListItemText primary="社内規定" />
                {expandedMenu === 'regulations' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              <Collapse in={expandedMenu === 'regulations'} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItemButton sx={{ pl: 4 }} onClick={() => handleMenuItemClick('社員就業規則')}>
                    <ListItemIcon>
                      <AssignmentIcon sx={{ color: '#42a5f5', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="社員就業規則" />
                  </ListItemButton>
                  <ListItemButton sx={{ pl: 4 }} onClick={() => handleMenuItemClick('服務規程')}>
                    <ListItemIcon>
                      <AssignmentIcon sx={{ color: '#42a5f5', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="服務規程" />
                  </ListItemButton>
                  <ListItemButton sx={{ pl: 4 }} onClick={() => handleMenuItemClick('情報セキュリティポリシー')}>
                    <ListItemIcon>
                      <AssignmentIcon sx={{ color: '#42a5f5', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="情報セキュリティポリシー" />
                  </ListItemButton>
                </List>
              </Collapse>

              {/* 年末調整 */}
              <ListItemButton onClick={() => handleMenuItemClick('年末調整')}>
                <ListItemIcon>
                  <AccountBalanceIcon sx={{ color: '#1976d2' }} />
                </ListItemIcon>
                <ListItemText primary="年末調整" />
              </ListItemButton>

              <Divider sx={{ my: 1 }} />

              {/* 会話履歴 */}
              <ListItemButton onClick={() => handleMenuItemClick('会話履歴')}>
                <ListItemIcon>
                  <HistoryIcon sx={{ color: '#1976d2' }} />
                </ListItemIcon>
                <ListItemText primary="会話履歴" />
              </ListItemButton>
            </List>
          </Box>
        </Box>

        {/* メインコンテンツエリア */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* モダンなヘッダー */}
          <AppBar
            position="static"
            elevation={0}
            sx={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#1a1a1a'
            }}
          >
            <Toolbar sx={{ px: 3 }}>
              <Avatar sx={{ 
                mr: 2, 
                bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}>
                <SmartToyIcon />
              </Avatar>
              <Typography variant="h5" component="div" sx={{ 
                flexGrow: 1, 
                fontWeight: 700,
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                総務チャットボット
              </Typography>
              <Button
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={() => signOut()}
                sx={{
                  border: '1px solid rgba(26, 26, 26, 0.1)',
                  borderRadius: 3,
                  px: 2,
                  color: '#666',
                  '&:hover': {
                    backgroundColor: 'rgba(26, 26, 26, 0.05)',
                    borderColor: 'rgba(26, 26, 26, 0.2)'
                  }
                }}
              >
                ログアウト
              </Button>
            </Toolbar>
          </AppBar>

          {/* メインチャットエリア */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 64px)',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(15px)',
            m: 2,
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {/* チャットメッセージエリア */}
            <Box
              ref={chatContainerRef}
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                '&::-webkit-scrollbar': {
                  width: '6px'
                },
                '&::-webkit-scrollbar-track': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '3px'
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '3px'
                }
              }}
            >
              {chatMessages.map((message) => (
                <Fade in={true} timeout={500} key={message.id}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                      mb: 2
                    }}
                  >
                    {message.type !== 'user' && (
                      <Avatar sx={{
                        mr: 2,
                        mt: 0.5,
                        bgcolor: message.type === 'system' ? '#ff9800' : '#1976d2',
                        width: 36,
                        height: 36
                      }}>
                        <SmartToyIcon fontSize="small" />
                      </Avatar>
                    )}
                    
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        borderRadius: 3,
                      background: message.type === 'user' 
                        ? 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)'
                        : message.type === 'system'
                        ? 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)'
                        : 'rgba(255, 255, 255, 0.95)',
                        color: message.type === 'user' ? 'white' : '#1a1a1a',
                        border: message.type !== 'user' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                        {message.content}
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        display: 'block', 
                        mt: 1, 
                        opacity: 0.7,
                        color: message.type === 'user' ? 'rgba(255,255,255,0.8)' : '#666'
                      }}>
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Paper>

                    {message.type === 'user' && (
                      <Avatar sx={{
                        ml: 2,
                        mt: 0.5,
                        bgcolor: '#42a5f5',
                        width: 36,
                        height: 36
                      }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                    )}
                  </Box>
                </Fade>
              ))}

              {/* タイピング中インジケーター */}
              {isTyping && (
                <Fade in={true}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      mb: 2
                    }}
                  >
                    <Avatar sx={{
                      mr: 2,
                      mt: 0.5,
                      bgcolor: '#1976d2',
                      width: 36,
                      height: 36
                    }}>
                      <SmartToyIcon fontSize="small" />
                    </Avatar>
                    
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        borderRadius: 3,
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#1976d2',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            animationDelay: '0s',
                            '@keyframes bounce': {
                              '0%, 80%, 100%': {
                                transform: 'scale(0)',
                              },
                              '40%': {
                                transform: 'scale(1)',
                              },
                            },
                          }}
                        />
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#1976d2',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            animationDelay: '0.16s',
                          }}
                        />
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: '#1976d2',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            animationDelay: '0.32s',
                          }}
                        />
                        <Typography variant="body2" sx={{ ml: 1, color: '#666' }}>
                          入力中...
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                </Fade>
              )}

              <div ref={messagesEndRef} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.2)' }} />

            {/* メッセージ入力エリア */}
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="メッセージを入力..."
                  variant="outlined"
                  disabled={isTyping}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: 3,
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)'
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.5)'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1976d2'
                      }
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" disabled={isTyping}>
                          <MicIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <IconButton
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isTyping}
                  sx={{
                    bgcolor: '#1976d2',
                    color: 'white',
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    '&:hover': {
                      bgcolor: '#1565c0'
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(255, 255, 255, 0.3)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }
                  }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}