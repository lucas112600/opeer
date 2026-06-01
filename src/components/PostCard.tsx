'use client';

import React from 'react';
import { ThumbsUp, ThumbsDown, Share2, Trash2 } from 'lucide-react';
import { Post, Profile } from '../lib/db';

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
  
  // 格式化時間顯示
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

  // 判斷是否可刪除：僅限非匿名且為本人發文
  const canDelete = currentUser && !post.is_anonymous && post.author_id === currentUser.id;

  return (
    <article 
      className="threads-card flex rounded-xl p-5 relative border border-[#262626] text-left overflow-hidden bg-[#121212]"
      id={`postcard-${post.id}`}
    >
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

        {/* 垂直線路引導 (Threads 核心視覺骨架) */}
        <div className="w-[1.5px] flex-1 bg-[#262626] my-2 rounded-full min-h-[40px]" />
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
          
          {/* 左側：👍 / 👎 審判列 */}
          <div className="flex items-center gap-2">
            {/* 👍 挺他 按鈕 */}
            <button
              id={`btn-upvote-${post.id}`}
              onClick={() => onVote(post.id, 'up')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-bold border transition-colors ${
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
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-bold border transition-colors ${
                userVote === 'down'
                  ? 'text-white bg-neutral-800 border-neutral-700'
                  : 'text-neutral-400 bg-neutral-950 border-[#262626] hover:text-white hover:bg-neutral-900'
              }`}
            >
              <ThumbsDown className="h-3 w-3" />
              <span>瞎爆</span>
              <span className={`text-[9px] pl-0.5 ${userVote === 'down' ? 'text-neutral-350' : 'text-neutral-500'}`}>{post.downvotes}</span>
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
    </article>
  );
}
