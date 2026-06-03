'use client';

import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Share2, Trash2, MessageSquare, EyeOff, Globe, AlertCircle, Play, Pause } from 'lucide-react';
import { Post, Profile, Comment, db } from '../lib/db';

interface PostCardProps {
  post: Post;
  currentUser: Profile | null;
  userVote: 'up' | 'down' | null;
  onVote: (postId: string, voteType: 'up' | 'down') => void;
  onShare: (post: Post) => void;
  onDelete: (postId: string) => void;
  onDeleteComment?: (commentId: string, onSuccess: () => void) => void;
  showAlert?: (title: string, message: string, onConfirm?: () => void) => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  onViewProfile?: (userId: string) => void;
}

export default function PostCard({
  post,
  currentUser,
  userVote,
  onVote,
  onShare,
  onDelete,
  onDeleteComment,
  showAlert,
  showConfirm,
  onViewProfile,
}: PostCardProps) {
  const alert = (message: string) => {
    if (showAlert) {
      showAlert('話題回覆提示', message);
    } else {
      window.alert(message);
    }
  };
  
  // 留言與回覆狀態
  const [showComments, setShowComments] = useState<boolean>(false);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState<string>( '');
  const [isAnonReply, setIsAnonReply] = useState<boolean>(false);
  const [replyError, setReplyError] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  // 敏感內容顯示解鎖狀態
  const [revealPost, setRevealPost] = useState<boolean>(false);
  const [revealedComments, setRevealedComments] = useState<Record<string, boolean>>({});

  // 新增多媒體與長文字狀態
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (post.audio_url) {
      const audio = new Audio(post.audio_url);
      
      const onTimeUpdate = () => setCurrentTime(audio.currentTime);
      const onLoadedMetadata = () => setDuration(audio.duration || 0);
      const onEnded = () => setIsPlaying(false);

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);

      setAudioInstance(audio);

      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
      };
    }
    return undefined;
  }, [post.audio_url]);

  const togglePlayAudio = () => {
    if (!audioInstance) return;
    if (isPlaying) {
      audioInstance.pause();
      setIsPlaying(false);
    } else {
      audioInstance.play();
      setIsPlaying(true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioInstance) {
      audioInstance.currentTime = newTime;
    }
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 實時觀看次數狀態與跳變邏輯
  const [liveViews, setLiveViews] = useState<number>(post.views || 0);

  useEffect(() => {
    // 初始載入時，將資料庫觀看次數 +1
    if (post.id) {
      db.incrementPostViews(post.id, post.views || 0);
    }
  }, [post.id]); // 只在元件初次掛載 (或 post.id 改變) 時執行一次寫入

  useEffect(() => {
    // 實時動態跳變特效 (每 4~8 秒隨機加 1~3 次)
    const interval = setInterval(() => {
      setLiveViews(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, Math.random() * 4000 + 4000);
    return () => clearInterval(interval);
  }, []);

  // 1. 卡片掛載時自動加載該話題的留言數與清單
  useEffect(() => {
    const loadComments = async () => {
      try {
        const list = await db.getComments(post.id);
        setCommentsList(list);
      } catch (err) {
        console.error('加載留言失敗：', err);
      }
    };
    loadComments();
  }, [post.id]);

  // 格式化時間
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

  // 判斷話題是否可刪除（非匿名且屬於本人）
  const canDelete = currentUser && !post.is_anonymous && post.author_id === currentUser.id;

  // 發表回覆留言
  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentUser) return;

    setIsSubmittingReply(true);
    setReplyError('');

    try {
      // 留言中的 @提及 隱私與公開審查
      const mentionRegex = /(?:^|\s)@([a-z0-9_]+)/gi;
      const matches = newCommentText.match(mentionRegex) || [];
      const mentionedUsernames = Array.from(
        new Set(matches.map(m => m.trim().substring(1).toLowerCase()))
      );

      if (mentionedUsernames.length > 0) {
        for (const username of mentionedUsernames) {
          const profile = await db.getProfileByUsername(username);
          if (!profile) {
            setReplyError(`提及的使用者 @${username} 不存在。`);
            setIsSubmittingReply(false);
            return;
          }
          if (profile.is_public === false) {
            setReplyError(`無法提及 @${username}，因為該帳戶設定為不公開。`);
            setIsSubmittingReply(false);
            return;
          }
        }
      }

      const comment = await db.createComment(post.id, currentUser, newCommentText.trim(), isAnonReply);
      setCommentsList(prev => [...prev, comment]);
      setNewCommentText('');
      setIsAnonReply(false);
      setReplyError('');
    } catch (err) {
      console.error(err);
      setReplyError('發表留言失敗，請稍後再試。');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // 刪除回覆留言
  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;

    const executeDelete = async () => {
      try {
        await db.deleteComment(commentId, currentUser.id);
        setCommentsList(prev => prev.filter(c => c.id !== commentId));
      } catch (err: any) {
        alert(err.message || '刪除留言失敗。');
      }
    };

    if (onDeleteComment) {
      onDeleteComment(commentId, executeDelete);
    } else {
      if (showConfirm) {
        showConfirm('刪除回覆確認', '確定要刪除這條回覆留言嗎？（※ 匿名回覆已實施物理隔離，無法刪除）', () => {
          executeDelete();
        });
      } else {
        const confirmDelete = window.confirm('確定要刪除這條回覆留言嗎？（匿名回覆已實施物理隔離，無法刪除）');
        if (!confirmDelete) return;
        executeDelete();
      }
    }
  };

  const isPostBlurred = post.has_sensitive_content && 
    (!currentUser || currentUser.sensitive_filter_enabled !== false) && 
    !revealPost;

  return (
    <article 
      className="relative flex flex-col p-6 mb-6 rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-2xl border border-white/[0.05] shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-white/[0.04] hover:border-white/[0.1] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgb(0,0,0,0.2)] transition-all duration-500 ease-out text-left group"
      id={`postcard-${post.id}`}
    >
      
      {/* 貼文主要內容區域 (Row 結構) */}
      <div className="flex w-full">
        {/* Column 1: 左側頭像與 Threads 經典垂直執行線 */}
        <div className="mr-3.5 flex flex-col items-center flex-shrink-0">
          {/* 頭像 */}
          <button
            onClick={() => {
              if (onViewProfile && !post.is_anonymous && post.author_id) {
                onViewProfile(post.author_id);
              }
            }}
            className={`relative h-9 w-9 overflow-hidden rounded-full border border-[#262626] bg-neutral-950 ${
              !post.is_anonymous && post.author_id ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.author_avatar}
              alt={post.author_name}
              className="h-full w-full object-cover"
            />
          </button>

          {/* 垂直線路引導 (當展開留言時，灰線會筆直拉長以串聯每一條留言的頭像) */}
          <div className={`w-[1.5px] flex-1 bg-[#262626] my-2 rounded-full min-h-[40px] ${
            showComments && commentsList.length > 0 ? 'opacity-100' : 'opacity-40'
          }`} />
        </div>

        {/* Column 2: 話題主體內容與互動列 */}
        <div className="flex-1 min-w-0">
          
          {/* 卡片標頭：名稱、時間 */}
          <div className="flex items-center justify-between mb-1">
            <button 
              onClick={() => {
                if (onViewProfile && !post.is_anonymous && post.author_id) {
                  onViewProfile(post.author_id);
                }
              }}
              className={`flex items-center gap-1.5 min-w-0 ${!post.is_anonymous && post.author_id ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
            >
              <span className="text-xs font-bold truncate block text-neutral-200">
                {post.author_name}
              </span>
              <span className="text-[10px] text-neutral-500 truncate block">
                @{post.author_username}
              </span>
            </button>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[9px] text-neutral-500 flex items-center gap-1">
                👁️ <span>{liveViews.toLocaleString()} 次觀看</span>
              </span>
              <span className="text-[10px] text-neutral-500 ml-1">
                {formatTime(post.created_at)}
              </span>
              
              {/* 垃圾桶刪除按鈕 */}
              {canDelete && (
                <button
                  id={`btn-delete-${post.id}`}
                  onClick={() => onDelete(post.id)}
                  className="text-neutral-600 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                  title="刪除此貼文"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {isPostBlurred ? (
            <div className="relative rounded-lg overflow-hidden border border-[#262626] bg-[#161616] p-4.5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left animate-fade-in mt-2">
              <div className="flex items-start gap-3">
                <EyeOff className="h-5 w-5 text-neutral-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-neutral-350 block">⚠️ 內容警示</span>
                  <span className="text-[10px] text-neutral-500 block leading-relaxed max-w-sm">
                    此話題包含敏感或爭議性內容。您的「敏感內容過濾器」已開啟，因此已自動隱藏此話題。
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevealPost(true)}
                className="flex-shrink-0 rounded bg-neutral-900 border border-[#262626] text-neutral-350 hover:text-white hover:bg-neutral-850 px-3.5 py-2 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
              >
                顯示內容
              </button>
            </div>
          ) : (
            <>
              {/* 話題主題標籤 (#感情公審...) */}
              <div className="mb-2">
                <span 
                  id={`tag-${post.id}`}
                  className="text-[10px] font-bold text-neutral-300 bg-neutral-900 px-2 py-0.5 rounded border border-[#262626] hover:bg-neutral-800 transition-colors inline-block"
                >
                  {post.topic}
                </span>
              </div>

              {/* 主文內容 */}
              <p className="text-xs text-neutral-200 leading-relaxed break-words whitespace-pre-wrap pr-1 mb-2 select-text">
                {post.content.length > 280 && !isExpanded ? `${post.content.substring(0, 280)}...` : post.content}
              </p>
              {post.content.length > 280 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors mb-4 block cursor-pointer animate-fade-in"
                >
                  {isExpanded ? '收起全文' : '展開全文'}
                </button>
              )}

              {/* 話題相片 */}
              {post.image_url && (
                <div className="mt-2.5 mb-4 relative rounded-lg overflow-hidden border border-[#262626] bg-neutral-950 max-h-[360px] flex items-center justify-center animate-fade-in">
                  <img
                    src={post.image_url}
                    alt="話題相片"
                    className="w-full h-full object-contain max-h-[360px]"
                  />
                </div>
              )}

              {/* 話題影片 */}
              {post.video_url && (
                <div className="mt-2.5 mb-4 relative rounded-lg overflow-hidden border border-[#262626] bg-black max-h-[360px] flex items-center justify-center animate-fade-in">
                  <video
                    src={post.video_url}
                    controls
                    preload="metadata"
                    className="w-full h-full rounded-lg max-h-[360px] bg-black"
                  />
                </div>
              )}

              {/* 語音播放器 */}
              {post.audio_url && (
                <div className="mt-2.5 mb-4 rounded-lg border border-[#262626] bg-black p-3.5 flex items-center gap-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={togglePlayAudio}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 transition-colors flex-shrink-0 cursor-pointer shadow-md"
                  >
                    {isPlaying ? (
                      <Pause className="h-4.5 w-4.5 text-black" />
                    ) : (
                      <Play className="h-4.5 w-4.5 text-black fill-black ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono select-none">
                      <span className="font-bold">{formatAudioTime(currentTime)}</span>
                      <span>{formatAudioTime(duration || 0)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSliderChange}
                      className="w-full h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-white transition-all hover:bg-neutral-850"
                      style={{
                        background: `linear-gradient(to right, #ffffff 0%, #ffffff ${(duration ? (currentTime / duration) : 0) * 100}%, #171717 ${(duration ? (currentTime / duration) : 0) * 100}%, #171717 100%)`
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* 靜態審判按鈕與功能操作列 */}
          <div className="flex items-center justify-start pt-3 gap-6">
            
            {/* 👍 挺他 按鈕 */}
            <button
              id={`btn-upvote-${post.id}`}
              onClick={() => onVote(post.id, 'up')}
              className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                userVote === 'up'
                  ? 'text-white fill-white'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              <ThumbsUp className={`h-4 w-4 ${userVote === 'up' ? 'fill-white' : ''}`} />
              <span>{post.upvotes > 0 ? post.upvotes : ''}</span>
            </button>

            {/* 👎 瞎爆 按鈕 */}
            <button
              id={`btn-downvote-${post.id}`}
              onClick={() => onVote(post.id, 'down')}
              className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                userVote === 'down'
                  ? 'text-white fill-white'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              <ThumbsDown className={`h-4 w-4 ${userVote === 'down' ? 'fill-white' : ''}`} />
              <span>{post.downvotes > 0 ? post.downvotes : ''}</span>
            </button>

            {/* 留言數 */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 hover:text-white transition-colors cursor-pointer"
              title={showComments ? '收合留言' : '查看留言'}
            >
              <MessageSquare className="h-4 w-4" />
              <span>{commentsList.length > 0 ? commentsList.length : ''}</span>
            </button>

            {/* 分享按鈕 */}
            <button
              id={`btn-share-${post.id}`}
              onClick={() => onShare(post)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500 hover:text-white transition-colors cursor-pointer ml-auto"
              title="匯出分享圖卡"
            >
              <Share2 className="h-4 w-4" />
            </button>

          </div>

        </div>
      </div>

      {/* 5. 話題留言與評論串展開區 (對稱灰線延伸排版) */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-[#202020] w-full flex flex-col gap-4 pl-0.5 animate-fade-in">
          
          {/* 渲染所有留言回覆 */}
          {commentsList.length > 0 ? (
            <div className="space-y-4 w-full">
              {commentsList.map((comment, index) => {
                const isMyComment = currentUser && !comment.is_anonymous && comment.author_id === currentUser.id;
                const isCommentBlurred = comment.has_sensitive_content && 
                  (!currentUser || currentUser.sensitive_filter_enabled !== false) && 
                  !revealedComments[comment.id];
                
                return (
                  <div key={comment.id} className="flex w-full items-start">
                    
                    {/* 左側：留言小頭像與垂直灰線段 */}
                    <div className="mr-3.5 flex flex-col items-center flex-shrink-0 w-9">
                      <div className={`relative h-7.5 w-7.5 overflow-hidden rounded-full border bg-neutral-950 ${
                        comment.is_anonymous ? 'border-emerald-500/20' : 'border-[#262626]'
                      }`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={comment.author_avatar}
                          alt={comment.author_name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      
                      {/* 若非最後一條留言，灰線繼續向下串接 */}
                      {index < commentsList.length && (
                        <div className="w-[1.5px] h-6 bg-[#262626] mt-2 rounded-full opacity-60" />
                      )}
                    </div>

                    {/* 右側：留言標頭與留言主體 */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-bold text-neutral-300 truncate">
                            {comment.author_name}
                          </span>
                          <span className="text-[9px] text-neutral-500 truncate">
                            @{comment.author_username}
                          </span>
                          {comment.is_anonymous && (
                            <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-1 rounded">匿名</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[9px] text-neutral-600">
                            {formatTime(comment.created_at)}
                          </span>
                          
                          {/* 刪除回覆留言 */}
                          {isMyComment && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-neutral-650 hover:text-rose-400 p-0.5 rounded transition-colors"
                              title="刪除此留言"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isCommentBlurred ? (
                        <div className="relative rounded-lg overflow-hidden border border-[#262626] bg-[#141414] p-3 mb-2 flex items-center justify-between gap-3 text-left mt-1.5 animate-fade-in">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                            <span className="text-[10px] text-neutral-500">⚠️ 此回覆含敏感爭議內容</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRevealedComments(prev => ({ ...prev, [comment.id]: true }))}
                            className="rounded bg-neutral-900 border border-[#262626] text-neutral-450 hover:text-white px-2 py-1 text-[9px] font-bold transition-all active:scale-95 cursor-pointer animate-fade-in"
                          >
                            顯示內容
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-200 leading-relaxed break-words whitespace-pre-wrap pr-1 select-text">
                          {comment.content}
                        </p>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-[10px] text-neutral-650 bg-black/20 rounded border border-[#202020] w-full">
              目前尚無話題留言，快來做第一個發表觀點的人吧！
            </div>
          )}

          {/* 新增回覆輸入列 */}
          {currentUser ? (
            <form onSubmit={handleAddReply} className="flex w-full items-start pt-3 border-t border-[#1a1a1a] mt-1">
              
              {/* 左側：當前發表回覆身分頭像 */}
              <div className="mr-3.5 flex-shrink-0 w-9 flex justify-center">
                <div className="relative h-7.5 w-7.5 overflow-hidden rounded-full border border-[#262626] bg-neutral-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={isAnonReply ? 'https://api.dicebear.com/7.x/identicon/svg?seed=anonymous&backgroundColor=262626&colors=ffffff' : currentUser.avatar_url}
                    alt="發表身分"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 右側：留言輸入框、雙軌隱私切換、提交 */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newCommentText}
                    onChange={(e) => {
                      setNewCommentText(e.target.value);
                      if (replyError) setReplyError('');
                    }}
                    placeholder={`以 @${isAnonReply ? 'anonymous' : currentUser.username} 身分回覆話題...`}
                    className="flex-1 rounded-lg bg-black border border-[#262626] px-3.5 py-2 text-xs text-white placeholder-neutral-600 focus:border-white focus:outline-none transition-colors"
                  />
                  
                  {/* 匿名模式 Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsAnonReply(!isAnonReply)}
                    className={`flex items-center gap-1 rounded text-[9px] font-bold px-2.5 py-2 border transition-colors ${
                      isAnonReply
                        ? 'text-black bg-white border-white'
                        : 'text-neutral-500 bg-neutral-950 border-[#262626] hover:text-white'
                    }`}
                    title={isAnonReply ? '已開啟匿名發表' : '開啟匿名發表'}
                  >
                    {isAnonReply ? <EyeOff className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    <span>{isAnonReply ? '匿名' : '公開'}</span>
                  </button>

                  {/* 送出回覆 */}
                  <button
                    type="submit"
                    disabled={isSubmittingReply || !newCommentText.trim()}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white border border-[#262626] px-3 py-2 text-xs font-bold rounded transition-all disabled:opacity-40"
                  >
                    {isSubmittingReply ? '傳送中...' : '回覆'}
                  </button>
                </div>

                {/* @提及 警告欄 */}
                {replyError && (
                  <div className="flex gap-1.5 text-[9px] text-rose-400 items-center justify-start mt-0.5 animate-fade-in text-left">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{replyError}</span>
                  </div>
                )}
              </div>

            </form>
          ) : (
            <div className="text-center py-2 text-[10px] text-neutral-600">
              * 請同意使用規章以載入分身帳戶發表回覆留言。
            </div>
          )}

        </div>
      )}

    </article>
  );
}
