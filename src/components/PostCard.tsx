'use client';

import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Share2, Trash2, MessageSquare, EyeOff, Globe, AlertCircle } from 'lucide-react';
import { Post, Profile, Comment, db } from '../lib/db';

interface PostCardProps {
  post: Post;
  currentUser: Profile | null;
  userVote: 'up' | 'down' | null;
  onVote: (postId: string, voteType: 'up' | 'down') => void;
  onShare: (post: Post) => void;
  onDelete: (postId: string) => void;
}

export default function PostCard({
  post,
  currentUser,
  userVote,
  onVote,
  onShare,
  onDelete,
}: PostCardProps) {
  
  // 留言與回覆狀態
  const [showComments, setShowComments] = useState<boolean>(false);
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState<string>( '');
  const [isAnonReply, setIsAnonReply] = useState<boolean>(false);
  const [replyError, setReplyError] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

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
      const mentionRegex = /@([a-z0-9_]+)/gi;
      const matches = newCommentText.match(mentionRegex) || [];
      const mentionedUsernames = Array.from(new Set(matches.map(m => m.substring(1).toLowerCase())));

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
    const confirmDelete = window.confirm('確定要刪除這條回覆留言嗎？（匿名回覆已實施物理隔離，無法刪除）');
    if (!confirmDelete) return;

    try {
      await db.deleteComment(commentId, currentUser.id);
      setCommentsList(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      alert(err.message || '刪除留言失敗。');
    }
  };

  return (
    <article 
      className="threads-card flex flex-col rounded-xl p-5 relative border border-[#262626] text-left bg-[#121212]"
      id={`postcard-${post.id}`}
    >
      
      {/* 貼文主要內容區域 (Row 結構) */}
      <div className="flex w-full">
        {/* Column 1: 左側頭像與 Threads 經典垂直執行線 */}
        <div className="mr-3.5 flex flex-col items-center flex-shrink-0">
          {/* 頭像 */}
          <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[#262626] bg-neutral-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.author_avatar}
              alt={post.author_name}
              className="h-full w-full object-cover"
            />
          </div>

          {/* 垂直線路引導 (當展開留言時，灰線會筆直拉長以串聯每一條留言的頭像) */}
          <div className={`w-[1.5px] flex-1 bg-[#262626] my-2 rounded-full min-h-[40px] ${
            showComments && commentsList.length > 0 ? 'opacity-100' : 'opacity-40'
          }`} />
        </div>

        {/* Column 2: 話題主體內容與互動列 */}
        <div className="flex-1 min-w-0">
          
          {/* 卡片標頭：名稱、時間 */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold truncate block text-neutral-200">
                {post.author_name}
              </span>
              <span className="text-[10px] text-neutral-500 truncate block">
                @{post.author_username}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-neutral-500">
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
          <p className="text-xs text-neutral-200 leading-relaxed break-words whitespace-pre-wrap pr-1 mb-4 select-text">
            {post.content}
          </p>

          {/* 靜態審判按鈕與功能操作列 */}
          <div className="flex items-center justify-between border-t border-[#262626] pt-3 flex-wrap sm:flex-nowrap gap-2">
            
            {/* 左側：👍 / 👎 審判與留言數 */}
            <div className="flex items-center gap-3">
              {/* 👍 挺他 按鈕 */}
              <button
                id={`btn-upvote-${post.id}`}
                onClick={() => onVote(post.id, 'up')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-bold border transition-colors ${
                  userVote === 'up'
                    ? 'text-black bg-white border-white'
                    : 'text-neutral-400 bg-neutral-950 border-[#262626] hover:text-white hover:bg-neutral-900'
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
                <span>挺他</span>
                <span className={`text-[9px] pl-0.5 ${userVote === 'up' ? 'text-black/70' : 'text-neutral-500'}`}>{post.upvotes}</span>
              </button>

              {/* 👎 瞎爆 按鈕 */}
              <button
                id={`btn-downvote-${post.id}`}
                onClick={() => onVote(post.id, 'down')}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-bold border transition-colors ${
                  userVote === 'down'
                    ? 'text-white bg-neutral-800 border-neutral-700'
                    : 'text-neutral-400 bg-neutral-950 border-[#262626] hover:text-white hover:bg-neutral-900'
                }`}
              >
                <ThumbsDown className="h-3 w-3" />
                <span>瞎爆</span>
                <span className={`text-[9px] pl-0.5 ${userVote === 'down' ? 'text-neutral-350' : 'text-neutral-500'}`}>{post.downvotes}</span>
              </button>

              {/* 留言數顯示連結 */}
              <button
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 hover:text-white transition-colors pl-1"
                title={showComments ? '收合留言' : '查看留言'}
              >
                <MessageSquare className="h-3 w-3" />
                <span>{commentsList.length} 則回覆</span>
              </button>
            </div>

            {/* 右側：分享/匯出戰報按鈕 */}
            <button
              id={`btn-share-${post.id}`}
              onClick={() => onShare(post)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-bold border text-neutral-400 bg-neutral-950 border-[#262626] hover:text-white hover:bg-neutral-900 transition-colors"
              title="匯出分享圖卡"
            >
              <Share2 className="h-3 w-3" />
              <span>分享圖卡</span>
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

                      <p className="text-[11px] text-neutral-200 leading-relaxed break-words whitespace-pre-wrap pr-1 select-text">
                        {comment.content}
                      </p>
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
