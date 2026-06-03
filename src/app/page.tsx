'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Flame, 
  Clock, 
  MessageSquare, 
  AlertCircle, 
  Bookmark, 
  HelpCircle,
  Terminal,
  Lock,
  ShieldCheck,
  X,
  Bell,
  Sparkles,
  Eye,
  EyeOff,
  Mail,
  User,
  ThumbsUp,
  ThumbsDown,
  Check
} from 'lucide-react';
import { db, Profile, Post, Notification, Community } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';


import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import PostModal from '../components/PostModal';
import SettingsModal from '../components/SettingsModal';
import StoryGenerator from '../components/StoryGenerator';
import UserProfileModal from '../components/UserProfileModal';

interface PendingAction {
  type: 'delete_post' | 'delete_comment' | 'save_profile' | 'reset_all' | 'sign_out';
  payload?: any;
  execute: () => void | Promise<void>;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 排序狀態與投票對決
  const [activeTab, setActiveTab] = useState<'algorithm' | 'latest' | 'popular' | 'community' | 'explore'>('algorithm');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  // 社群狀態
  const [communities, setCommunities] = useState<Community[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [selectedCommunityMemberCount, setSelectedCommunityMemberCount] = useState<number>(0);

  // 彈窗與通知抽屜控制
  const [isPostModalOpen, setIsPostModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [appError, setAppError] = useState<string>('');
  
  // 新手引導狀態
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingSelected, setOnboardingSelected] = useState<string[]>([]);

  // 2FA 操作安全防護攔截狀態
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [show2FAVerifyModal, setShow2FAVerifyModal] = useState<boolean>(false);
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState<string>('');
  const [twoFAVerifyError, setTwoFAVerifyError] = useState<string>('');

  // 即時通知中心狀態
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

  // 帳號認證與註冊登入狀態
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authFullName, setAuthFullName] = useState<string>('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  // 脆風格自訂安全對話框 (Custom Dark Dialog Modal)
  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
  });

  const customAlert = (title: string, message: string, onConfirm?: () => void) => {
    setCustomDialog({
      isOpen: true,
      type: 'alert',
      title,
      message,
      confirmText: '確定',
      onConfirm: () => {
        setCustomDialog(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      }
    });
  };

  const customConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    setCustomDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: '確定',
      cancelText: '取消',
      onConfirm: () => {
        setCustomDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setCustomDialog(prev => ({ ...prev, isOpen: false }));
        if (onCancel) onCancel();
      }
    });
  };

  // 覆寫元件作用域內的 global alert
  const alert = (message: string) => {
    customAlert('話題社群提示', message);
  };

  // ----------------------------------------------------
  // 1. 資料載入與帳號綁定
  // ----------------------------------------------------

  const fetchFeed = useCallback(async (tab: 'algorithm' | 'latest' | 'popular' | 'community') => {
    setIsDataLoading(true);
    try {
      const allPosts = await db.getPosts(
        tab === 'community' ? 'latest' : tab, 
        tab === 'community' && selectedCommunity ? selectedCommunity.id : undefined
      );
      setPosts(allPosts);
      
      if (currentUser) {
        const votesMap: Record<string, 'up' | 'down' | null> = {};
        await Promise.all(
          allPosts.map(async (p) => {
            const vote = await db.getUserVoteForPost(p.id, currentUser.id);
            votesMap[p.id] = vote;
          })
        );
        setUserVotes(votesMap);
      }
    } catch (err) {
      console.error(err);
      setAppError('無法載入話題，請檢查網路連線。');
    } finally {
      setIsDataLoading(false);
    }
  }, [currentUser]);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const list = await db.getNotifications(currentUser.id);
      setNotifications(list);
    } catch (err) {
      console.error('獲取通知失敗：', err);
    }
  }, [currentUser]);

  // 在頁面加載時，優先嘗試偵測真實使用者的 Supabase 雲端 Session
  useEffect(() => {
    const autoInit = async () => {
      setIsCheckingSession(true);
      try {
        let user = await db.getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.error('偵測真實帳戶失敗：', err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    const loadCommunities = async () => {
      try {
        await db.initializeCommunitiesIfNeeded();
        const comms = await db.getCommunities();
        setCommunities(comms);
      } catch (err) {
        console.error('無法載入社群', err);
      }
    };

    autoInit();
    loadCommunities();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const user = await db.signInWithEmail(authEmail.trim(), authPassword);
        setCurrentUser(user);
      } else {
        if (authPassword.length < 6) {
          throw new Error('密碼長度最少需為 6 個字元。');
        }
        await db.signUpWithEmail(authEmail.trim(), authPassword, authFullName.trim() || '分身成員');
        alert('註冊成功！請點選「登入分身」以登入。');
        setAuthMode('login');
        setAuthPassword('');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || '認證操作失敗，請檢查輸入內容。');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const loadUserCommunities = async () => {
        try {
          const joined = await db.getJoinedCommunities(currentUser.id);
          setJoinedCommunities(joined);
          // 若加入的社群小於 3 個，觸發新手引導
          if (joined.length < 3) {
            setShowOnboarding(true);
            setOnboardingSelected(joined.map(c => c.id));
          } else {
            setShowOnboarding(false);
          }
        } catch (err) {}
      };
      loadUserCommunities();
    } else {
      setJoinedCommunities([]);
      // 若為匿名狀態且有社群列表，則直接開啟引導
      setShowOnboarding(true);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'community' && !selectedCommunity) {
      return;
    }
    
    if (activeTab === 'community' && selectedCommunity) {
      const loadMemberCount = async () => {
        try {
          const count = await db.getCommunityMemberCount(selectedCommunity.id);
          setSelectedCommunityMemberCount(count);
        } catch (e) {
          console.error(e);
        }
      };
      loadMemberCount();
    }
    
    if (activeTab === 'explore') {
      return;
    }
    fetchFeed(activeTab);
  }, [activeTab, selectedCommunity, fetchFeed, fetchNotifications]);



  // ----------------------------------------------------
  // 2. 搜尋過濾
  // ----------------------------------------------------
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setFilteredPosts(posts);
      return;
    }

    const filtered = posts.filter(p => 
      p.topic.toLowerCase().includes(query) || 
      p.content.toLowerCase().includes(query) ||
      p.author_name.toLowerCase().includes(query) ||
      p.author_username.toLowerCase().includes(query)
    );
    setFilteredPosts(filtered);
  }, [searchQuery, posts]);

  // ----------------------------------------------------
  // 3. 2FA 敏感操作安全攔截器與通知控制
  // ----------------------------------------------------
  const triggerActionWith2FAGuard = (
    type: PendingAction['type'],
    execute: () => void | Promise<void>,
    payload?: any
  ) => {
    if (currentUser?.two_factor_enabled) {
      setPendingAction({ type, execute, payload });
      setTwoFAVerifyCode('');
      setTwoFAVerifyError('');
      setShow2FAVerifyModal(true);
    } else {
      execute();
    }
  };

  const handleVerify2FAForAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFAVerifyError('');

    if (!twoFAVerifyCode || twoFAVerifyCode.trim().length !== 6) {
      setTwoFAVerifyError('請輸入完整的 6 位數安全驗證碼。');
      return;
    }

    try {
      // 1. 取得使用者已驗證的 2FA 因子列表
      const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactor = factorsData.totp.find(f => f.status === 'verified');
      if (!totpFactor) {
        // 如果資料庫啟用但 Supabase 端查無 verified 因子，則容錯放行
        if (pendingAction) {
          pendingAction.execute();
        }
        setShow2FAVerifyModal(false);
        setPendingAction(null);
        setTwoFAVerifyCode('');
        return;
      }

      // 2. 挑戰 (Challenge) 該因子以確認認證回合
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });
      if (challengeError) throw challengeError;

      // 3. 驗證 (Verify) 安全碼
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: twoFAVerifyCode.trim()
      });

      if (verifyError) {
        setTwoFAVerifyError('驗證碼不正確，請輸入您驗證 App 產生的最新安全碼。');
        return;
      }

      // 驗證成功，執行待處理之敏感操作
      if (pendingAction) {
        pendingAction.execute();
      }
      setShow2FAVerifyModal(false);
      setPendingAction(null);
      setTwoFAVerifyCode('');
    } catch (err: any) {
      console.error('2FA 驗證失敗：', err);
      setTwoFAVerifyError(err.message || '安全驗證過程出錯，請稍後重試。');
    }
  };

  const handleCancel2FA = () => {
    setShow2FAVerifyModal(false);
    setPendingAction(null);
    setTwoFAVerifyCode('');
    setTwoFAVerifyError('');
  };

  const getActionNameInChinese = (type: PendingAction['type']) => {
    switch (type) {
      case 'delete_post': return '刪除話題串';
      case 'delete_comment': return '刪除留言回覆';
      case 'save_profile': return '更新個人帳戶設定';
      case 'reset_all': return '重設本機資料並安全登出';
      case 'sign_out': return '登出當前分身帳戶';
      default: return '敏感安全操作';
    }
  };

  const handleToggleNotifications = () => {
    setShowNotificationsDrawer(prev => {
      const next = !prev;
      if (next) {
        fetchNotifications();
      }
      return next;
    });
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return;
    try {
      await db.markAllNotificationsRead(currentUser.id);
      await fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    setShowNotificationsDrawer(false);
    // 預留流暢微延遲以利滑入特效順暢
    setTimeout(() => {
      const element = document.getElementById(`postcard-${n.post_id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 像素級高亮框線提醒特效，維持冷酷感
        element.classList.add('highlight-flash');
        setTimeout(() => {
          element.classList.remove('highlight-flash');
        }, 2000);
      }
    }, 300);
  };

  const getNotificationText = (type: Notification['type']) => {
    switch (type) {
      case 'vote_up': return <span className="flex items-center gap-1">對您的話題投了 <ThumbsUp className="h-3 w-3" /> 挺你 (Upvote)。</span>;
      case 'vote_down': return <span className="flex items-center gap-1">對您的話題投了 <ThumbsDown className="h-3 w-3" /> 瞎爆 (Downvote)。</span>;
      case 'comment': return <span className="flex items-center gap-1">評論 <MessageSquare className="h-3 w-3" /> 回覆了您的話題。</span>;
      case 'mention': return '在話題內容或回覆中提及標記了你。';
      default: return '與您的話題進行了互動。';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  // ----------------------------------------------------
  // 4. 核心功能操作
  // ----------------------------------------------------

  const handleCreatePost = async (
    content: string, 
    topic: string, 
    isAnonymous: boolean, 
    imageUrl?: string,
    videoUrl?: string,
    audioUrl?: string,
    communityId?: string
  ) => {
    if (!currentUser) return;
    try {
      const newPost = await db.createPost(currentUser, content, topic, isAnonymous, imageUrl, videoUrl, audioUrl, communityId);
      setPosts(prev => [newPost, ...prev]);
      setIsPostModalOpen(false);
      fetchNotifications();
    } catch (err) {
      console.error(err);
      alert('發表話題失敗。');
    }
  };

  const handleUpdateProfile = async (updatedData: Partial<Profile>) => {
    if (!currentUser) return;
    
    const execute = async () => {
      try {
        const updated = await db.updateProfile(currentUser.id, updatedData);
        setCurrentUser(updated);
        setIsProfileModalOpen(false);
      } catch (err) {
        console.error(err);
        throw err;
      }
    };

    triggerActionWith2FAGuard('save_profile', execute);
  };

  const handleJoinCommunity = async (communityId: string) => {
    if (!currentUser) return;
    try {
      await db.joinCommunity(communityId, currentUser.id);
      const joined = await db.getJoinedCommunities(currentUser.id);
      setJoinedCommunities(joined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveCommunity = async (communityId: string) => {
    if (!currentUser) return;
    try {
      await db.leaveCommunity(communityId, currentUser.id);
      const joined = await db.getJoinedCommunities(currentUser.id);
      setJoinedCommunities(joined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVote = async (postId: string, voteType: 'up' | 'down') => {
    const userId = currentUser ? currentUser.id : null;
    try {
      const result = await db.votePost(postId, userId, voteType);
      
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, upvotes: result.upvotes, downvotes: result.downvotes };
        }
        return p;
      }));

      setUserVotes(prev => ({
        ...prev,
        [postId]: result.userVote
      }));

      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;

    const execute = async () => {
      try {
        await db.deletePost(postId, currentUser.id);
        setPosts(prev => prev.filter(p => p.id !== postId));
      } catch (err: any) {
        alert(err.message || '刪除失敗。');
      }
    };

    customConfirm(
      '刪除話題確認', 
      '您確定要永久刪除這篇公開貼文嗎？（※ 匿名話題已實施物理隔離，無法被任何人刪除）', 
      () => {
        triggerActionWith2FAGuard('delete_post', execute);
      }
    );
  };

  const handleSignOut = async () => {
    const execute = async () => {
      await db.signOut();
      setCurrentUser(null);
      localStorage.removeItem('opper_consented');
      window.location.reload();
    };

    customConfirm(
      '帳戶登出確認', 
      '您確定要安全登出當前分身帳戶嗎？', 
      () => {
        triggerActionWith2FAGuard('sign_out', execute);
      }
    );
  };

  const handleResetAll = async () => {
    const execute = async () => {
      await db.signOut();
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
      }
      setCurrentUser(null);
      window.location.reload();
    };

    triggerActionWith2FAGuard('reset_all', execute);
  };

  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-[#f3f5f7]">
        <div className="relative flex items-center justify-center h-20 w-20">
          <div className="absolute inset-0 rounded-2xl bg-white/5 animate-ping" />
          <div className="relative h-16 w-16 rounded-xl border border-[#262626] bg-neutral-950 overflow-hidden shadow-2xl animate-pulse">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Opper" className="h-full w-full object-cover animate-spin-slow" style={{ animationDuration: '3s' }} />
          </div>
        </div>
        <span className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-6 animate-pulse">
          Opeer 載入中...
        </span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-[#f3f5f7] p-6 text-center select-none overflow-hidden">
        
        {/* Dynamic SVG Text Background */}
        <div className="absolute top-[-30vh] left-1/2 -translate-x-1/2 w-[150vw] md:w-[100vw] h-[100vw] max-h-[800px] pointer-events-none z-0 opacity-90 mix-blend-screen flex items-center justify-center">
          <svg viewBox="0 0 1000 1000" className="w-full h-full animate-[spin_120s_linear_infinite]" xmlns="http://www.w3.org/2000/svg">
            <path id="curve1" d="M 100,500 A 400,400 0 1,1 900,500 A 400,400 0 1,1 100,500" fill="transparent" />
            <path id="curve2" d="M 200,500 A 300,300 0 1,0 800,500 A 300,300 0 1,0 200,500" fill="transparent" />
            <path id="curve3" d="M 350,500 A 150,150 0 1,1 650,500 A 150,150 0 1,1 350,500" fill="transparent" />
            
            <text fontSize="52" fontWeight="900" fill="transparent" stroke="rgba(255,255,255,0.8)" strokeWidth="2" letterSpacing="12">
              <textPath href="#curve1" startOffset="0%">OPEER OPEER OPEER OPEER OPEER OPEER OPEER OPEER OPEER OPEER</textPath>
            </text>
            <text fontSize="44" fontWeight="900" fill="white" letterSpacing="10">
              <textPath href="#curve2" startOffset="25%">OPEER OPEER OPEER OPEER OPEER OPEER OPEER</textPath>
            </text>
            <text fontSize="36" fontWeight="900" fill="transparent" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" letterSpacing="8">
              <textPath href="#curve3" startOffset="50%">OPEER OPEER OPEER</textPath>
            </text>
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-[360px] flex flex-col items-center mt-32 md:mt-48">
          
          <h2 className="text-[13px] font-bold text-white mb-6">
            {authMode === 'login' ? '登入 Opeer 分身帳戶' : '註冊 Opeer 分身帳戶'}
          </h2>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="w-full flex flex-col items-center">
            
            <div className="w-full rounded-xl overflow-hidden border border-[#262626] bg-[#121212] mb-4">
              {authMode === 'register' && (
                <div className="border-b border-[#262626]">
                  <input
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="顯示名稱 (Full Name)"
                    className="w-full bg-transparent px-4 py-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
                  />
                </div>
              )}
              <div className="border-b border-[#262626]">
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="用戶名稱、手機號碼或電子郵件地址"
                  className="w-full bg-transparent px-4 py-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="密碼"
                  className="w-full bg-transparent px-4 py-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {authError && (
              <div className="w-full flex items-start gap-2 rounded bg-rose-950/40 border border-rose-900/30 p-3 text-[11px] text-rose-450 text-left mb-4">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-xl bg-white text-black py-3.5 text-[13px] font-bold hover:bg-neutral-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-t-white" />
              ) : authMode === 'login' ? (
                '登入'
              ) : (
                '註冊'
              )}
            </button>
          </form>

          {authMode === 'login' && (
            <button className="mt-5 text-[11px] text-neutral-500 hover:text-white transition-colors cursor-pointer">
              忘記密碼？
            </button>
          )}


          <button 
            onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
            className="mt-8 text-[11px] text-neutral-500 hover:text-white transition-colors cursor-pointer"
          >
            {authMode === 'login' ? '還沒有帳號嗎？註冊' : '已經有帳號了嗎？登入'}
          </button>

          {/* Database Setup Info (Warning Banner if not configured) */}
          {!isSupabaseConfigured && (
            <div className="w-full text-[10px] text-amber-500 bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 text-left space-y-1 mt-6">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>資料庫未設定 (Local DB Disconnected)</span>
              </div>
              <p className="text-neutral-400 leading-normal">
                本系統不提供假資料模擬。請先於專案根目錄配置 `.env.local` 檔案以連接您的真實 Supabase 雲端資料庫。
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-[#0a0a0a] text-[#f3f5f7] p-6 pb-24">
        <div className="w-full max-w-4xl mx-auto mt-12 mb-8 text-center">
          <h1 className="text-2xl font-black text-white mb-2 tracking-tight">打造你的專屬情報流</h1>
          <p className="text-sm text-neutral-500 font-bold">請選擇至少 3 個您感興趣的社群加入（已選擇：{onboardingSelected.length}）</p>
        </div>
        
        <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {communities.map(c => {
            const isSelected = onboardingSelected.includes(c.id);
            return (
              <div 
                key={c.id}
                onClick={async () => {
                  if (isSelected) {
                    setOnboardingSelected(prev => prev.filter(id => id !== c.id));
                    if (currentUser) await db.leaveCommunity(c.id, currentUser.id);
                  } else {
                    setOnboardingSelected(prev => [...prev, c.id]);
                    if (currentUser) await db.joinCommunity(c.id, currentUser.id);
                  }
                }}
                className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  isSelected 
                    ? 'bg-white/10 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                    : 'bg-[#121212] border-[#262626] hover:border-neutral-500 hover:bg-[#1a1a1a]'
                }`}
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="w-12 h-12 rounded-xl object-contain bg-[#1f1f1f] p-1.5 mb-3" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-[#262626] mb-3" />
                )}
                <span className="text-xs font-bold text-center text-white line-clamp-1">{c.name}</span>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0a] to-transparent flex justify-center pointer-events-none">
          <button
            onClick={() => {
              if (onboardingSelected.length >= 3) setShowOnboarding(false);
            }}
            disabled={onboardingSelected.length < 3}
            className="pointer-events-auto bg-white text-black px-12 py-3 rounded-full text-sm font-black tracking-widest uppercase transition-all disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 hover:scale-105 active:scale-95"
          >
            {onboardingSelected.length < 3 ? `還差 ${3 - onboardingSelected.length} 個` : '開始探索'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-black text-[#f3f5f7]">
      

      {/* 導覽列 */}
      <Navbar 
        currentUser={currentUser}
        onEditProfile={() => setIsProfileModalOpen(true)}
        onNewPost={() => setIsPostModalOpen(true)}
        onSignOut={handleSignOut}
        unreadNotificationsCount={notifications.filter(n => !n.is_read).length}
        onToggleNotifications={handleToggleNotifications}
      />

      {/* 電腦 Web 專屬多欄式對齊版面 (最大寬度 1040px) */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex gap-8 justify-center items-start">
        


        {/* Center Column: 置中沉浸式貼文牆 */}
        <main className="flex-1 w-full max-w-[700px] flex flex-col gap-6 mx-auto">
          
          {/* 頂部快捷導覽與社群水平列 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button 
                onClick={() => { setActiveTab('algorithm'); setSearchQuery(''); setSelectedCommunity(null); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                  activeTab === 'algorithm' && !searchQuery && !selectedCommunity
                    ? 'bg-white text-black border-white' 
                    : 'bg-[#121212] text-neutral-400 border-[#262626] hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span>演算法推播</span>
              </button>
              <button 
                onClick={() => { setActiveTab('latest'); setSearchQuery(''); setSelectedCommunity(null); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                  activeTab === 'latest' && !searchQuery && !selectedCommunity
                    ? 'bg-white text-black border-white' 
                    : 'bg-[#121212] text-neutral-400 border-[#262626] hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>最新發表</span>
              </button>
              <button 
                onClick={() => { setActiveTab('popular'); setSearchQuery(''); setSelectedCommunity(null); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                  activeTab === 'popular' && !searchQuery && !selectedCommunity
                    ? 'bg-white text-black border-white' 
                    : 'bg-[#121212] text-neutral-400 border-[#262626] hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <Flame className="h-3 w-3" />
                <span>熱門話題</span>
              </button>
              <button 
                onClick={() => { setActiveTab('explore'); setSearchQuery(''); setSelectedCommunity(null); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                  activeTab === 'explore' && !searchQuery && !selectedCommunity
                    ? 'bg-white text-black border-white' 
                    : 'bg-[#121212] text-neutral-400 border-[#262626] hover:bg-[#1a1a1a] hover:text-white'
                }`}
              >
                <Search className="h-3 w-3" />
                <span>探索社群</span>
              </button>
              
              <div className="w-[1px] h-4 bg-[#262626] mx-1"></div>

              {/* 已加入的社群快速跳轉 */}
              {joinedCommunities.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setActiveTab('community'); setSelectedCommunity(c); setSearchQuery(''); }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                    activeTab === 'community' && selectedCommunity?.id === c.id
                      ? 'bg-neutral-800 text-white border-neutral-600'
                      : 'bg-transparent text-neutral-400 border-[#262626] hover:bg-[#121212] hover:text-white'
                  }`}
                >
                  {c.logo_url && <img src={c.logo_url} alt="" className="w-3.5 h-3.5 rounded object-contain bg-[#1f1f1f] p-0.5" />}
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* 搜尋列 */}
          <section className="relative flex items-center flex-shrink-0">
            <Search className="absolute left-4 h-4 w-4 text-neutral-500" />
            <input
              id="search-topics"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋話題標籤 (如: #感情) 或貼文內文..."
              className="w-full rounded-xl bg-[#121212] border border-[#1f1f1f] pl-10 pr-10 py-3 text-xs text-white focus:border-neutral-700 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 rounded bg-neutral-900 border border-[#262626] text-[9px] text-neutral-400 px-2 py-0.5 hover:bg-neutral-800 hover:text-white cursor-pointer"
              >
                重設
              </button>
            )}
          </section>

          {/* 警告說明 */}
          {appError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-950/40 border border-rose-900/30 p-4 text-xs text-rose-400 animate-fade-in text-left">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{appError}</span>
            </div>
          )}

          {/* 社群專屬標頭 (若進入社群模式) */}
          {activeTab === 'community' && selectedCommunity && (
            <div className="bg-[#121212] border border-[#1f1f1f] rounded-2xl p-5 relative overflow-hidden animate-fade-in flex flex-col gap-4">
              <div className="flex items-start gap-4">
                {selectedCommunity.logo_url ? (
                  <img src={selectedCommunity.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-contain bg-[#1f1f1f] p-1.5 border border-[#262626]" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-neutral-900 border border-[#262626] flex items-center justify-center text-xl font-black text-neutral-600">
                    {selectedCommunity.name.substring(0, 1).replace('#', '') || 'C'}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-lg font-black text-white">{selectedCommunity.name}</h1>
                    {selectedCommunity.is_official && (
                      <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">官方</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mb-3">{selectedCommunity.description}</p>
                  
                  <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-medium">
                    <span className="flex items-center gap-1"><User className="w-3 h-3"/> 總人數: {selectedCommunityMemberCount}</span>
                    <span className="flex items-center gap-1 text-emerald-500"><Sparkles className="w-3 h-3"/> 線上: 依實際活躍計算</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> 創立於: {new Date(selectedCommunity.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end border-t border-[#1f1f1f] pt-4 mt-1">
                {joinedCommunities.some(c => c.id === selectedCommunity.id) ? (
                  <button 
                    onClick={() => handleLeaveCommunity(selectedCommunity.id)}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg border border-[#262626] text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
                  >
                    退出社群
                  </button>
                ) : (
                  <button 
                    onClick={() => handleJoinCommunity(selectedCommunity.id)}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors"
                  >
                    加入社群
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 移動端分頁分欄快捷切換 (僅於窄螢幕顯示) */}
          <section className="flex items-center justify-between border-b border-[#262626] pb-2 md:hidden">
            <div className="flex items-center gap-3 overflow-x-auto">
              <button
                id="tab-algorithm"
                onClick={() => { setActiveTab('algorithm'); setSearchQuery(''); }}
                className={`pb-3 text-xs font-black transition-colors border-b-2 whitespace-nowrap px-1 ${
                  activeTab === 'algorithm' && !searchQuery
                    ? 'text-white border-white'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                演算法推播
              </button>
              <button
                id="tab-latest"
                onClick={() => { setActiveTab('latest'); setSearchQuery(''); }}
                className={`pb-3 text-xs font-black transition-colors border-b-2 whitespace-nowrap px-1 ${
                  activeTab === 'latest' && !searchQuery
                    ? 'text-white border-white'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                最新發表
              </button>
              <button
                id="tab-popular"
                onClick={() => { setActiveTab('popular'); setSearchQuery(''); }}
                className={`pb-3 text-xs font-black transition-colors border-b-2 whitespace-nowrap px-1 ${
                  activeTab === 'popular' && !searchQuery
                    ? 'text-white border-white'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                熱門公審
              </button>
              <button
                id="tab-explore"
                onClick={() => { setActiveTab('explore'); setSearchQuery(''); }}
                className={`pb-3 text-xs font-black transition-colors border-b-2 whitespace-nowrap px-1 ${
                  activeTab === 'explore' && !searchQuery
                    ? 'text-white border-white'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                探索社群
              </button>
            </div>
            <div className="text-[10px] text-neutral-500 flex-shrink-0 pl-2">
              共 {filteredPosts.length} 篇
            </div>
          </section>

          {/* 串文卡片清單 / 社群總覽 */}
          <section className="flex flex-col gap-4">
            {activeTab === 'explore' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-12">
                {communities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveTab('community');
                      setSelectedCommunity(c);
                    }}
                    className="flex flex-col items-center p-4 rounded-2xl bg-[#121212] border border-[#262626] hover:bg-[#1a1a1a] transition-colors text-center group"
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-contain bg-[#1f1f1f] p-1.5 mb-3 group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-neutral-900 border border-[#262626] mb-3 flex items-center justify-center text-xl font-black text-neutral-600 group-hover:scale-105 transition-transform">
                        {c.name.substring(0, 1)}
                      </div>
                    )}
                    <span className="text-xs font-bold text-white mb-1 line-clamp-1">{c.name}</span>
                    <span className="text-[10px] text-neutral-500 line-clamp-2">{c.description}</span>
                  </button>
                ))}
              </div>
            ) : isDataLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-white" />
                <span className="text-xs text-neutral-500 font-bold">正在讀取審判話題...</span>
              </div>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  communityName={communities.find(c => c.id === post.community_id)?.name}
                  userVote={userVotes[post.id] || null}
                  onVote={handleVote}
                  onShare={(p) => setSelectedPostForShare(p)}
                  onDelete={handleDeletePost}
                  onViewProfile={(uid) => setViewingUserId(uid)}
                  onDeleteComment={(commentId, executeDelete) => {
                    customConfirm(
                      '刪除留言確認', 
                      '您確定要永久刪除這條回覆留言嗎？（※ 匿名回覆已實施物理隔離，無法刪除）', 
                      () => {
                        triggerActionWith2FAGuard('delete_comment', executeDelete, commentId);
                      }
                    );
                  }}
                  showAlert={customAlert}
                  showConfirm={customConfirm}
                />
              ))
            ) : (
              <div className="text-center py-20 border border-[#262626] rounded-xl bg-[#121212] p-8 space-y-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-950 border border-[#262626] text-neutral-500">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-300">目前沒有找到話題貼文</h3>
                  <p className="text-[11px] text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    您可以點擊右上角「發表話題」來建立您的首篇爆料，或更換搜尋字詞。
                  </p>
                </div>
              </div>
            )}
          </section>

        </main>



      </div>

      {/* 4. 彈窗群 */}
      
      {/* 發表話題彈窗 */}
      {currentUser && (
        <PostModal
          currentUser={currentUser}
          isOpen={isPostModalOpen}
          onClose={() => setIsPostModalOpen(false)}
          communities={communities}
          defaultCommunityId={selectedCommunity?.id}
          onSubmit={handleCreatePost}
        />
      )}

      {/* 帳戶與隱私設定彈窗 */}
      {currentUser && (
        <SettingsModal
          currentUser={currentUser}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleUpdateProfile}
          onResetAll={handleResetAll}
          showAlert={customAlert}
          showConfirm={customConfirm}
        />
      )}

      {/* 限動戰報下載彈窗 */}
      {selectedPostForShare && (
        <StoryGenerator
          post={selectedPostForShare}
          isOpen={!!selectedPostForShare}
          onClose={() => setSelectedPostForShare(null)}
        />
      )}

      {/* 用戶主頁彈窗 */}
      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          currentUser={currentUser}
          onClose={() => setViewingUserId(null)}
          onVote={handleVote}
          onShare={(p) => setSelectedPostForShare(p)}
          onDeletePost={handleDeletePost}
          onViewProfile={(uid) => setViewingUserId(uid)}
        />
      )}

      {/* 2FA 敏感操作驗證彈窗 */}
      {show2FAVerifyModal && pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-[#121212] border border-[#262626] p-6 text-left shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4.5 w-4.5 text-white" />
                <h3 className="text-sm font-bold text-white">🔑 雙重安全驗證 (2FA)</h3>
              </div>
              <button
                type="button"
                onClick={handleCancel2FA}
                className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-neutral-855 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            <div className="space-y-3 mb-4 text-xs leading-relaxed text-neutral-400">
              <p>
                為了保障您的帳戶安全，執行敏感操作<strong>「{getActionNameInChinese(pendingAction.type)}」</strong>前，必須通過雙重身份安全校驗。
              </p>
              <p className="text-[10px] text-neutral-500">
                請開啟您手機上的驗證器 App（如 Google Authenticator），並在下方輸入對應的 6 位數安全驗證碼以確認授權放行：
              </p>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleVerify2FAForAction} className="space-y-4">
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={twoFAVerifyCode}
                  onChange={(e) => setTwoFAVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="請輸入 6 位數安全驗證碼"
                  className="w-full text-center font-mono rounded-lg bg-black border border-[#262626] text-xs text-white px-3 py-2.5 focus:border-white focus:outline-none transition-colors"
                />
                {twoFAVerifyError && (
                  <div className="flex gap-1.5 text-[9px] text-rose-400 items-center text-left">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{twoFAVerifyError}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={handleCancel2FA}
                  className="flex-1 rounded-lg bg-neutral-900 border border-[#262626] text-neutral-400 py-2 text-xs font-bold hover:bg-neutral-855 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-white text-black py-2 text-xs font-bold hover:bg-neutral-200 transition-colors"
                >
                  驗證並授權
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 右側抽屜式即時通知中心 Drawer */}
      {showNotificationsDrawer && currentUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="absolute inset-0" onClick={() => setShowNotificationsDrawer(false)} />
          <div className="relative w-full max-w-xs h-full bg-[#121212] border-l border-[#262626] p-6 shadow-2xl animate-slide-left flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-white" />
                <span className="text-xs font-bold text-white">即時通知中心</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {notifications.some(n => !n.is_read) && (
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="text-[9px] font-bold text-neutral-300 hover:text-white px-2 py-1 rounded bg-neutral-900 border border-[#262626] transition-colors cursor-pointer"
                  >
                    全部已讀
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="text-neutral-450 hover:text-white p-1 rounded hover:bg-neutral-900 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-3">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex gap-3 p-3 rounded-lg border transition-all cursor-pointer text-left relative ${
                      n.is_read
                        ? 'bg-black/20 border-[#1c1c1c] text-neutral-400 hover:bg-neutral-900/30'
                        : 'bg-neutral-900/40 border-[#262626] text-white hover:bg-neutral-850/40 shadow-sm'
                    }`}
                  >
                    {!n.is_read && (
                      <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                    
                    <div className="relative h-7 w-7 overflow-hidden rounded-full border border-[#262626] bg-neutral-950 flex-shrink-0">
                      <img
                        src={n.sender_avatar}
                        alt={n.sender_username}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[10px] leading-relaxed break-words pr-1">
                        <span className="font-bold text-neutral-200">@{n.sender_username}</span>{' '}
                        {getNotificationText(n.type)}
                      </p>
                      <span className="text-[8px] text-neutral-600 block">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-24 text-[10px] text-neutral-650 space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-950 border border-[#262626] text-neutral-600">
                    <Bell className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-500">目前尚無通知</h4>
                    <p className="text-[9px] text-neutral-650 leading-relaxed max-w-[180px] mx-auto mt-1">
                      當其他使用者對您發表的話題投票、評論留言，或提及您的帳號時，通知將會即時顯示在此。
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 5. 脆風格自訂安全對話框 (Custom Dark Dialog Modal) */}
      {customDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 select-none animate-fade-in backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl bg-[#121212] border border-[#262626] p-6 space-y-5 shadow-2xl animate-scale-in text-center">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {customDialog.title}
              </h3>
            </div>
            
            <p className="text-xs text-neutral-400 leading-relaxed text-left bg-black/40 p-3.5 rounded-lg border border-[#202020]">
              {customDialog.message}
            </p>
            
            <div className="flex gap-2">
              {customDialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={customDialog.onCancel}
                  className="flex-1 rounded-lg border border-[#262626] hover:bg-neutral-900 text-neutral-400 hover:text-white py-2 text-xs font-bold transition-all cursor-pointer"
                >
                  {customDialog.cancelText || '取消'}
                </button>
              )}
              <button
                type="button"
                onClick={customDialog.onConfirm}
                className="flex-1 rounded-lg bg-white text-black hover:bg-neutral-200 py-2 text-xs font-bold transition-all cursor-pointer"
              >
                {customDialog.confirmText || '確定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 頁尾 */}
      <footer className="w-full border-t border-[#262626] py-6 text-center text-[10px] text-neutral-650 bg-black mt-12 flex-shrink-0">
        <p className="mb-2">© 2026 opper.</p>
        <p>
          <a href="/docs" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white underline transition-colors">
            使用規範漢文檔、資料庫開源 Schema 與開發者 API 參考文檔
          </a>
        </p>
      </footer>

    </div>
  );
}
