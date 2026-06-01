'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Flame, Clock, MessageSquare, AlertCircle, Bookmark, HelpCircle } from 'lucide-react';
import { db, Profile, Post } from '../lib/db';

import Gatekeeper from '../components/Gatekeeper';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import PostModal from '../components/PostModal';
import SettingsModal from '../components/SettingsModal';
import StoryGenerator from '../components/StoryGenerator';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 排序狀態與投票對決
  const [activeTab, setActiveTab] = useState<'latest' | 'popular'>('latest');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  // 彈窗控制
  const [isPostModalOpen, setIsPostModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
  
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [appError, setAppError] = useState<string>('');

  // 預設熱門話題標籤快捷列
  const hotTopics = [
    '#感情公審',
    '#微辣AA制',
    '#職場黑幕',
    '#兩性關係',
    '#職場八卦'
  ];

  // ----------------------------------------------------
  // 1. 資料載入與帳號綁定
  // ----------------------------------------------------

  const fetchFeed = useCallback(async (tab: 'latest' | 'popular') => {
    setIsDataLoading(true);
    try {
      const allPosts = await db.getPosts(tab);
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

  const handleGatekeeperAccept = async () => {
    try {
      let user = await db.getCurrentUser();
      if (!user) {
        user = await db.loginOrCreateAccount();
      }
      setCurrentUser(user);
    } catch (err) {
      console.error('登入初始化失敗：', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchFeed(activeTab);
    }
  }, [currentUser, activeTab, fetchFeed]);

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
  // 3. 核心功能操作
  // ----------------------------------------------------

  const handleCreatePost = async (content: string, topic: string, isAnonymous: boolean) => {
    if (!currentUser) return;
    try {
      const newPost = await db.createPost(currentUser, content, topic, isAnonymous);
      setPosts(prev => [newPost, ...prev]);
      setIsPostModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('發表話題失敗。');
    }
  };

  const handleUpdateProfile = async (updatedData: Partial<Profile>) => {
    if (!currentUser) return;
    try {
      const updated = await db.updateProfile(currentUser.id, updatedData);
      setCurrentUser(updated);
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error(err);
      throw err;
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

    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;
    const confirmDelete = window.confirm('確定要刪除這篇公開貼文嗎？（匿名貼文實施物理隔離，無法刪除）');
    if (!confirmDelete) return;

    try {
      await db.deletePost(postId, currentUser.id);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      alert(err.message || '刪除失敗。');
    }
  };

  const handleSignOut = async () => {
    const confirmOut = window.confirm('確定要登出並重置分身 Session 嗎？');
    if (!confirmOut) return;

    await db.signOut();
    setCurrentUser(null);
    localStorage.removeItem('opper_consented');
    window.location.reload();
  };

  const handleResetAll = async () => {
    await db.signOut();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    setCurrentUser(null);
    window.location.reload();
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-black text-[#f3f5f7]">
      
      {/* 進入同意書 */}
      <Gatekeeper onAccept={handleGatekeeperAccept} />

      {/* 導覽列 */}
      <Navbar 
        currentUser={currentUser}
        onEditProfile={() => setIsProfileModalOpen(true)}
        onNewPost={() => setIsPostModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* 電腦 Web 專屬多欄式對齊版面 (最大寬度 1040px) */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex gap-8 justify-center items-start">
        
        {/* Left Column: 桌面版極簡快捷側欄 */}
        <aside className="hidden md:flex flex-col w-44 shrink-0 sticky top-24 gap-6 text-left">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">
              快速導覽
            </span>
            <nav className="flex flex-col gap-1">
              <button 
                onClick={() => { setActiveTab('latest'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'latest' && !searchQuery
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-400 hover:bg-neutral-950 hover:text-white'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>最新發表</span>
              </button>
              <button 
                onClick={() => { setActiveTab('popular'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'popular' && !searchQuery
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-400 hover:bg-neutral-950 hover:text-white'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>熱門公審</span>
              </button>
            </nav>
          </div>

          {currentUser && (
            <div className="border-t border-[#262626] pt-4 mt-2 space-y-3.5">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">
                當前分身
              </span>
              <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.full_name}
                    className="h-7.5 w-7.5 rounded-full border border-[#262626]"
                  />
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-neutral-200 block truncate">
                      {currentUser.full_name}
                    </span>
                    <span className="text-[9px] text-neutral-500 block truncate">
                      @{currentUser.username}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="w-full text-center py-1 rounded bg-neutral-900 border border-[#262626] hover:bg-neutral-800 text-[10px] text-neutral-300 font-bold transition-colors"
                >
                  設定分身
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Center Column: 經典 620px 窄版貼文牆 */}
        <main className="flex-1 w-full max-w-[620px] flex flex-col gap-6">
          
          {/* 搜尋列 */}
          <section className="relative flex items-center flex-shrink-0">
            <Search className="absolute left-3.5 h-3.5 w-3.5 text-neutral-550" />
            <input
              id="search-topics"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋話題標籤 (如: #感情) 或貼文內文..."
              className="w-full rounded-lg bg-[#121212] border border-[#262626] pl-9 pr-9 py-2.5 text-xs text-white focus:border-white focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 rounded bg-neutral-900 border border-[#262626] text-[9px] text-neutral-400 px-2 py-0.5 hover:bg-neutral-800 hover:text-white"
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

          {/* 移動端分頁分欄快捷切換 (僅於窄螢幕顯示) */}
          <section className="flex items-center justify-between border-b border-[#262626] pb-2 md:hidden">
            <div className="flex items-center gap-4">
              <button
                id="tab-latest"
                onClick={() => { setActiveTab('latest'); setSearchQuery(''); }}
                className={`pb-2 text-xs font-black transition-all border-b-2 ${
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
                className={`pb-2 text-xs font-black transition-all border-b-2 ${
                  activeTab === 'popular' && !searchQuery
                    ? 'text-white border-white'
                    : 'text-neutral-500 border-transparent hover:text-neutral-300'
                }`}
              >
                熱門公審
              </button>
            </div>
            <div className="text-[10px] text-neutral-500">
              共 {filteredPosts.length} 篇
            </div>
          </section>

          {/* 串文卡片清單 */}
          <section className="flex flex-col gap-4">
            {isDataLoading ? (
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
                  userVote={userVotes[post.id] || null}
                  onVote={handleVote}
                  onShare={(p) => setSelectedPostForShare(p)}
                  onDelete={handleDeletePost}
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

        {/* Right Column: 桌面版話題標籤篩選與分身宣告手冊 */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-24 gap-6 text-left">
          
          {/* 熱門標籤清單 */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">
              熱門話題標籤
            </span>
            <div className="flex flex-col gap-2">
              {hotTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSearchQuery(topic)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-bold border transition-colors truncate block ${
                    searchQuery === topic
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-[#262626] text-neutral-400 hover:text-white hover:bg-neutral-950'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* 中性宣告說明卡 */}
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <HelpCircle className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                關於分身社群
              </span>
            </div>
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              Opper 是一款開源公共話題討論網站。您可以在右上角隨意編輯使用者暱稱、帳號、自介，甚至切換隨機幾何圖形頭像，擁有全新的社交分身角色。
            </p>
            <p className="text-[10px] text-neutral-500 leading-relaxed border-t border-[#262626] pt-2">
              發表話題時若開啟匿名，系統不會儲存帳號關聯 UUID，此動作將永久斷開個人資訊。
            </p>
          </div>

        </aside>

      </div>

      {/* 4. 彈窗群 */}
      
      {/* 發表話題彈窗 */}
      {currentUser && (
        <PostModal
          currentUser={currentUser}
          isOpen={isPostModalOpen}
          onClose={() => setIsPostModalOpen(false)}
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

      {/* 頁尾 */}
      <footer className="w-full border-t border-[#262626] py-6 text-center text-[10px] text-neutral-600 bg-black mt-12 flex-shrink-0">
        <p>© 2026 Opper Open Source Social Project. 脆風格公共話題審判與分身社交網站.</p>
      </footer>

    </div>
  );
}
