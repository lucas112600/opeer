'use client';

import React, { useState, useEffect } from 'react';
import { X, Lock, FileText, ThumbsUp, MessageSquare } from 'lucide-react';
import { Profile, Post, Comment, db } from '../lib/db';
import { supabase } from '../lib/supabase';
import PostCard from './PostCard';

interface UserProfileModalProps {
  userId: string;
  currentUser: Profile | null;
  onClose: () => void;
  onVote: (postId: string, voteType: 'up' | 'down') => void;
  onShare: (post: Post) => void;
  onDeletePost: (postId: string) => void;
  onViewProfile: (userId: string) => void;
}

export default function UserProfileModal({
  userId,
  currentUser,
  onClose,
  onVote,
  onShare,
  onDeletePost,
  onViewProfile
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [activeTab, setActiveTab] = useState<'posts' | 'votes' | 'replies'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [votedPosts, setVotedPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 取得該 UserProfile
        const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (p) setProfile(p as Profile);
        
        const isOwner = currentUser?.id === userId;
        const canView = p && (p.is_public || isOwner);

        if (canView) {
          const [fetchedPosts, fetchedVotes, fetchedComments] = await Promise.all([
            db.getUserPosts(userId),
            db.getUserVotedPosts(userId),
            db.getUserComments(userId)
          ]);
          setPosts(fetchedPosts);
          setVotedPosts(fetchedVotes);
          setComments(fetchedComments);

          if (currentUser) {
            const allPosts = [...fetchedPosts, ...fetchedVotes];
            const votesMap: Record<string, 'up' | 'down' | null> = {};
            await Promise.all(
              allPosts.map(async (post) => {
                const vote = await db.getUserVoteForPost(post.id, currentUser.id);
                votesMap[post.id] = vote;
              })
            );
            setUserVotes(votesMap);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, currentUser]);

  const isOwner = currentUser?.id === userId;
  const isPrivate = profile && !profile.is_public && !isOwner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in">
      <div 
        className="w-full max-w-[620px] rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] overflow-hidden"
      >
        {/* Header (Top Nav) */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-white">個人主頁</h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-800 border-t-white" />
          </div>
        ) : profile ? (
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
            {/* Profile Info Header */}
            <div className="px-6 py-6 flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-bold text-white">{profile.full_name}</h1>
                <span className="text-sm text-neutral-500">@{profile.username}</span>
                <p className="text-sm text-neutral-300 mt-3 whitespace-pre-wrap">{profile.bio}</p>
                {profile.two_factor_enabled && (
                  <span className="text-[10px] text-neutral-500 font-bold border border-[#1f1f1f] px-2 py-0.5 rounded-full mt-2 w-max inline-block">
                    2FA 已啟用
                  </span>
                )}
              </div>
              <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[#1f1f1f] bg-neutral-900 flex-shrink-0 ml-4">
                <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
              </div>
            </div>

            {isPrivate ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 border-t border-[#1f1f1f]">
                <div className="h-16 w-16 rounded-full border border-[#1f1f1f] bg-[#121212] flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-neutral-500" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">🔒 這是非公開帳號</h3>
                <p className="text-xs text-neutral-500 text-center max-w-sm leading-relaxed">
                  該帳戶的個人檔案是不公開的。只有被允許的跟隨者可以查看其話題串與回覆。
                </p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-[#1f1f1f] sticky top-0 bg-[#0a0a0a] z-10">
                  <button
                    onClick={() => setActiveTab('posts')}
                    className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      activeTab === 'posts' ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'
                    }`}
                  >
                    串文
                  </button>
                  <button
                    onClick={() => setActiveTab('votes')}
                    className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      activeTab === 'votes' ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'
                    }`}
                  >
                    參與投票
                  </button>
                  <button
                    onClick={() => setActiveTab('replies')}
                    className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                      activeTab === 'replies' ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'
                    }`}
                  >
                    回覆
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 bg-[#0a0a0a]">
                  {activeTab === 'posts' && (
                    <div className="flex flex-col">
                      {posts.length > 0 ? (
                        posts.map(post => (
                          <PostCard
                            key={post.id}
                            post={post}
                            currentUser={currentUser}
                            userVote={userVotes[post.id] || null}
                            onVote={onVote}
                            onShare={onShare}
                            onDelete={onDeletePost}
                            onViewProfile={onViewProfile}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-xs text-neutral-500 flex flex-col items-center">
                          <FileText className="h-8 w-8 mb-3 opacity-20" />
                          尚無發表任何串文
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'votes' && (
                    <div className="flex flex-col">
                      {votedPosts.length > 0 ? (
                        votedPosts.map(post => (
                          <PostCard
                            key={`vote-${post.id}`}
                            post={post}
                            currentUser={currentUser}
                            userVote={userVotes[post.id] || null}
                            onVote={onVote}
                            onShare={onShare}
                            onDelete={onDeletePost}
                            onViewProfile={onViewProfile}
                          />
                        ))
                      ) : (
                        <div className="text-center py-12 text-xs text-neutral-500 flex flex-col items-center">
                          <ThumbsUp className="h-8 w-8 mb-3 opacity-20" />
                          尚未參與任何投票表態
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'replies' && (
                    <div className="flex flex-col p-4 gap-4">
                      {comments.length > 0 ? (
                        comments.map(comment => (
                          <div key={comment.id} className="border-b border-[#1f1f1f] pb-4 last:border-b-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-6 w-6 rounded-full overflow-hidden border border-[#262626]">
                                <img src={comment.author_avatar} alt={comment.author_name} className="h-full w-full object-cover" />
                              </div>
                              <span className="text-xs font-bold text-neutral-300">{comment.author_name}</span>
                              <span className="text-[10px] text-neutral-500">回覆了話題</span>
                            </div>
                            <p className="text-sm text-neutral-200 pl-8">{comment.content}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-xs text-neutral-500 flex flex-col items-center">
                          <MessageSquare className="h-8 w-8 mb-3 opacity-20" />
                          尚無發表任何回覆
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-neutral-500">
            找不到該使用者的資料
          </div>
        )}
      </div>
    </div>
  );
}
