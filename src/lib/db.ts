import { supabase, isSupabaseConfigured } from './supabase';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  is_public: boolean; // 是否為公開帳號（可被他人提及）
  two_factor_enabled: boolean; // 是否開啟雙重驗證 (2FA)
  sensitive_filter_enabled: boolean; // 是否開啟敏感內容模糊警示偏好
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string | null; // 匿名時物理隔離為 NULL
  is_anonymous: boolean;
  author_username: string;
  author_name: string;
  author_avatar: string;
  topic: string;
  content: string;
  upvotes: number;
  downvotes: number;
  has_sensitive_content: boolean; // 是否包含敏感爭議話題
  created_at: string;
  algorithm_score?: number; // 智慧推薦熱度分數
  image_url?: string | null; // 話題附加照片網址或 Base64 字串
}

export interface Vote {
  id: string;
  user_id: string | null;
  post_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string | null; // 匿名時物理隔離為 NULL
  is_anonymous: boolean;
  author_username: string;
  author_name: string;
  author_avatar: string;
  content: string;
  has_sensitive_content: boolean; // 是否包含敏感話題內容
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  sender_username: string;
  sender_avatar: string;
  post_id: string;
  type: 'vote_up' | 'vote_down' | 'comment' | 'mention';
  is_read: boolean;
  created_at: string;
}

// 預設的匿名使用者資訊，物理隔離發文者資訊時使用
export const ANONYMOUS_OWL = {
  username: 'anonymous',
  full_name: '匿名使用者',
  avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=anonymous&backgroundColor=262626&colors=ffffff',
};

// Meta 發文內容安全警示詞庫
const SENSITIVE_WORDS = ['自殺', '毒品', '暴力', '黑幕', '折舊費'];

// ----------------------------------------------------
// 離線預覽模式記憶體資料庫 (Offline Preview In-Memory Database)
// ----------------------------------------------------
let inMemoryCurrentUser: Profile | null = null;
let inMemoryProfiles: Profile[] = [];
let inMemoryPosts: Post[] = [
  {
    id: 'offline-post-1',
    author_id: 'offline-user-1',
    is_anonymous: false,
    author_username: 'clara_life',
    author_name: 'Clara Chen',
    author_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=clara',
    topic: '#感情公審',
    content: '跟男友交往五年了，最近討論到結婚，他居然跟我提折舊費？說我年紀大了、皮膚不如以前，所以聘金要扣除折舊費，這到底是什麼鬼邏輯？真的氣到發抖！',
    upvotes: 84,
    downvotes: 12,
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'offline-post-2',
    author_id: null,
    is_anonymous: true,
    author_username: ANONYMOUS_OWL.username,
    author_name: ANONYMOUS_OWL.full_name,
    author_avatar: ANONYMOUS_OWL.avatar_url,
    topic: '#微辣AA制',
    content: '昨天跟相親對象去吃米其林餐廳，結帳一共是 8600 元。男生主動刷卡，我說等等轉帳一半給他。結果他居然把發票明細拍下來，一項一項算，連服務費都要照比例算，甚至連我喝的兩口水（水資 120）也要我全出！這是不是有點太微辣了？',
    upvotes: 156,
    downvotes: 8,
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'offline-post-3',
    author_id: 'offline-user-2',
    is_anonymous: false,
    author_username: 'jacky_work',
    author_name: '阿傑',
    author_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=jacky',
    topic: '#職場黑幕',
    content: '我們公司的主管，每次開會都把別人的 Idea 包裝成自己的去跟大老闆報告。更扯的是，如果專案成功了就是他的功勞，搞砸了就推給底下的工程師，說我們執行力不夠。今天我終於忍無可忍，當著大老闆的面把所有會議紀錄跟 Commit 紀錄投影出來，直接洗臉他！現在準備收行李了，但真的很爽！',
    upvotes: 210,
    downvotes: 3,
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  }
];
let inMemoryVotes: Vote[] = [];
let inMemoryComments: Comment[] = [
  {
    id: 'offline-comment-1',
    post_id: 'offline-post-1',
    author_id: 'offline-user-3',
    is_anonymous: false,
    author_username: 'judy_love',
    author_name: '茱蒂',
    author_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=judy',
    content: '折舊費？！這種人趕快放生吧，結婚後只會更摳門更自私。',
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
  {
    id: 'offline-comment-2',
    post_id: 'offline-post-1',
    author_id: null,
    is_anonymous: true,
    author_username: ANONYMOUS_OWL.username,
    author_name: ANONYMOUS_OWL.full_name,
    author_avatar: ANONYMOUS_OWL.avatar_url,
    content: '天啊，活久見，居然把折舊費套用在感情上，快逃啊姊妹！',
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'offline-comment-3',
    post_id: 'offline-post-2',
    author_id: 'offline-user-4',
    is_anonymous: false,
    author_username: 'brian_hustle',
    author_name: '布萊恩',
    author_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=brian',
    content: '水資 120 也要算... 這真的不是一般的 AA 了，是鐵公雞吧！',
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'offline-comment-4',
    post_id: 'offline-post-3',
    author_id: null,
    is_anonymous: true,
    author_username: ANONYMOUS_OWL.username,
    author_name: ANONYMOUS_OWL.full_name,
    author_avatar: ANONYMOUS_OWL.avatar_url,
    content: '原 PO 帥爛了！這種主管就該給他死，祝你下一家公司更好！',
    has_sensitive_content: false,
    created_at: new Date(Date.now() - 3600000 * 11).toISOString(),
  }
];
let inMemoryNotifications: Notification[] = [];

// ----------------------------------------------------
// 雙軌資料庫串接介面 (雲端 Supabase + 精品離線預覽模式)
// ----------------------------------------------------
export const db = {
  
  // --- 帳號管理與 Auth 登入邏輯 ---
  
  // 獲取目前登入的使用者資訊
  getCurrentUser: async (): Promise<Profile | null> => {
    if (!isSupabaseConfigured) {
      if (!inMemoryCurrentUser) {
        inMemoryCurrentUser = {
          id: 'offline-guest',
          username: 'opper_guest',
          full_name: 'Opper 體驗官',
          avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=offline-guest',
          bio: '這是我的分身專用簡介 (離線預覽中)。',
          is_public: true,
          two_factor_enabled: false,
          sensitive_filter_enabled: true,
          created_at: new Date().toISOString()
        };
        if (!inMemoryProfiles.some(p => p.id === inMemoryCurrentUser!.id)) {
          inMemoryProfiles.push(inMemoryCurrentUser);
        }
      }
      return inMemoryCurrentUser;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (error || !data) return null;
    return data as Profile;
  },

  // 登入/註冊帳戶
  loginOrCreateAccount: async (username?: string, fullName?: string): Promise<Profile> => {
    if (!isSupabaseConfigured) {
      if (!inMemoryCurrentUser) {
        const finalUsername = username || 'user_' + Math.random().toString(36).substring(2, 10);
        const finalFullName = fullName || 'User_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        inMemoryCurrentUser = {
          id: 'offline-guest',
          username: finalUsername.toLowerCase().replace(/[^a-z0-9_]/g, ''),
          full_name: finalFullName,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=offline-guest`,
          bio: '這是我的分身專用簡介 (離線預覽中)。',
          is_public: true,
          two_factor_enabled: false,
          sensitive_filter_enabled: true,
          created_at: new Date().toISOString()
        };
        if (!inMemoryProfiles.some(p => p.id === inMemoryCurrentUser!.id)) {
          inMemoryProfiles.push(inMemoryCurrentUser);
        }
      }
      return inMemoryCurrentUser;
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    let userId = currentUser?.id;

    if (!userId) {
      const { data: { session }, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !session) throw authError || new Error('真實 Supabase 匿名登入失敗');
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error || !data) {
      const finalUsername = username || 'user_' + Math.random().toString(36).substring(2, 10);
      const finalFullName = fullName || 'User_' + Math.random().toString(36).substring(2, 6).toUpperCase();
      
      const newProfile = {
        id: userId,
        username: finalUsername.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        full_name: finalFullName,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
        bio: '這是我的分身專用簡介。',
        is_public: true,
        two_factor_enabled: false,
        sensitive_filter_enabled: true
      };

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();
      if (insertError) throw insertError;
      return inserted as Profile;
    }

    return data as Profile;
  },

  // 登出
  signOut: async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      inMemoryCurrentUser = null;
      return;
    }
    await supabase.auth.signOut();
  },

  // 修改個人設定 (基本資料、隱私公開、2FA、敏感過濾)
  updateProfile: async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    if (!isSupabaseConfigured) {
      if (inMemoryCurrentUser && inMemoryCurrentUser.id === userId) {
        inMemoryCurrentUser = { ...inMemoryCurrentUser, ...updates };
        inMemoryProfiles = inMemoryProfiles.map(p => p.id === userId ? inMemoryCurrentUser! : p);
        
        // 同步更新記憶體中該使用者的貼文與留言資訊
        if (updates.username || updates.full_name || updates.avatar_url) {
          inMemoryPosts = inMemoryPosts.map(p => {
            if (p.author_id === userId && !p.is_anonymous) {
              return {
                ...p,
                author_username: updates.username || p.author_username,
                author_name: updates.full_name || p.author_name,
                author_avatar: updates.avatar_url || p.author_avatar
              };
            }
            return p;
          });

          inMemoryComments = inMemoryComments.map(c => {
            if (c.author_id === userId && !c.is_anonymous) {
              return {
                ...c,
                author_username: updates.username || c.author_username,
                author_name: updates.full_name || c.author_name,
                author_avatar: updates.avatar_url || c.author_avatar
              };
            }
            return c;
          });
        }
        return inMemoryCurrentUser;
      }
      throw new Error('離線預覽：未找到該使用者設定');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    
    if (updates.username || updates.full_name || updates.avatar_url) {
      const postUpdates: any = {};
      const commentUpdates: any = {};
      
      if (updates.username) {
        postUpdates.author_username = updates.username;
        commentUpdates.author_username = updates.username;
      }
      if (updates.full_name) {
        postUpdates.author_name = updates.full_name;
        commentUpdates.author_name = updates.full_name;
      }
      if (updates.avatar_url) {
        postUpdates.author_avatar = updates.avatar_url;
        commentUpdates.author_avatar = updates.avatar_url;
      }

      await supabase.from('posts').update(postUpdates).eq('author_id', userId).eq('is_anonymous', false);
      await supabase.from('comments').update(commentUpdates).eq('author_id', userId).eq('is_anonymous', false);
    }

    return data as Profile;
  },

  // 依據 Username 獲取使用者個人檔案
  getProfileByUsername: async (username: string): Promise<Profile | null> => {
    const cleanUsername = username.trim().toLowerCase().replace('@', '');
    if (!isSupabaseConfigured) {
      const found = inMemoryProfiles.find(p => p.username === cleanUsername);
      if (found) return found;
      return {
        id: `offline-user-${cleanUsername}`,
        username: cleanUsername,
        full_name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
        bio: '這是我的分身專用簡介。',
        is_public: true,
        two_factor_enabled: false,
        sensitive_filter_enabled: true,
        created_at: new Date().toISOString()
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', cleanUsername)
      .maybeSingle();
    if (error || !data) return null;
    return data as Profile;
  },

  // --- 串文話題管理 ---
  
  // 獲取線上所有話題發文
  getPosts: async (orderBy: 'latest' | 'popular' | 'algorithm' = 'latest'): Promise<Post[]> => {
    if (!isSupabaseConfigured) {
      const postsWithScores = inMemoryPosts.map(p => {
        const hoursPassed = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
        const commentCount = inMemoryComments.filter(c => c.post_id === p.id).length;
        
        // 智慧熱度推薦排序公式
        const score = ((p.upvotes * 1.5) - (p.downvotes * 0.5) + (commentCount * 3.0) + 10) / Math.pow(hoursPassed + 2, 1.2);
        
        return {
          ...p,
          algorithm_score: score,
        } as Post;
      });

      if (orderBy === 'latest') {
        return postsWithScores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else if (orderBy === 'popular') {
        return postsWithScores.sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
      } else {
        return postsWithScores.sort((a, b) => (b.algorithm_score || 0) - (a.algorithm_score || 0));
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .select('*, comments(id)');
      
    if (error) throw error;
    
    const postsWithScores = (data || []).map((p: any) => {
      const hoursPassed = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
      const commentCount = p.comments?.length || 0;
      
      const score = ((p.upvotes * 1.5) - (p.downvotes * 0.5) + (commentCount * 3.0) + 10) / Math.pow(hoursPassed + 2, 1.2);
      
      return {
        ...p,
        algorithm_score: score,
      } as Post;
    });

    if (orderBy === 'latest') {
      return postsWithScores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (orderBy === 'popular') {
      return postsWithScores.sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
    } else {
      return postsWithScores.sort((a, b) => (b.algorithm_score || 0) - (a.algorithm_score || 0));
    }
  },

  // 發表話題
  createPost: async (
    author: Profile, 
    content: string, 
    topic: string, 
    isAnonymous: boolean,
    imageUrl?: string
  ): Promise<Post> => {
    const formattedTopic = topic.startsWith('#') ? topic.trim() : `#${topic.trim()}`;
    const hasSensitive = SENSITIVE_WORDS.some(word => content.includes(word));

    if (!isSupabaseConfigured) {
      const newPost: Post = isAnonymous
        ? {
            id: 'offline-post-' + Math.random().toString(36).substring(2, 9),
            author_id: null,
            is_anonymous: true,
            author_username: ANONYMOUS_OWL.username,
            author_name: ANONYMOUS_OWL.full_name,
            author_avatar: ANONYMOUS_OWL.avatar_url,
            topic: formattedTopic,
            content: content,
            upvotes: 0,
            downvotes: 0,
            has_sensitive_content: hasSensitive,
            created_at: new Date().toISOString(),
            image_url: imageUrl || null
          }
        : {
            id: 'offline-post-' + Math.random().toString(36).substring(2, 9),
            author_id: author.id,
            is_anonymous: false,
            author_username: author.username,
            author_name: author.full_name,
            author_avatar: author.avatar_url,
            topic: formattedTopic,
            content: content,
            upvotes: 0,
            downvotes: 0,
            has_sensitive_content: hasSensitive,
            created_at: new Date().toISOString(),
            image_url: imageUrl || null
          };

      inMemoryPosts.unshift(newPost);
      await db.createMentionNotifications(content, isAnonymous ? null : author, newPost.id);
      return newPost;
    }

    const postData = isAnonymous
       ? {
            author_id: null,
            is_anonymous: true,
            author_username: ANONYMOUS_OWL.username,
            author_name: ANONYMOUS_OWL.full_name,
            author_avatar: ANONYMOUS_OWL.avatar_url,
            topic: formattedTopic,
            content: content,
            has_sensitive_content: hasSensitive,
            image_url: imageUrl || null,
          }
       : {
            author_id: author.id,
            is_anonymous: false,
            author_username: author.username,
            author_name: author.full_name,
            author_avatar: author.avatar_url,
            topic: formattedTopic,
            content: content,
            has_sensitive_content: hasSensitive,
            image_url: imageUrl || null,
          };

    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single();
    if (error) throw error;

    await db.createMentionNotifications(content, isAnonymous ? null : author, data.id);
    return data as Post;
  },

  // 刪除話題
  deletePost: async (postId: string, userId: string): Promise<void> => {
    if (!isSupabaseConfigured) {
      inMemoryPosts = inMemoryPosts.filter(p => !(p.id === postId && p.author_id === userId));
      return;
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', userId);
    if (error) throw error;
  },

  // --- 投票與審判管理 ---
  
  // 針對話題投票
  votePost: async (
    postId: string, 
    userId: string | null,
    voteType: 'up' | 'down'
  ): Promise<{ upvotes: number; downvotes: number; userVote: 'up' | 'down' | null }> => {
    if (!isSupabaseConfigured) {
      const existingIdx = inMemoryVotes.findIndex(v => v.post_id === postId && v.user_id === userId);
      let upDiff = 0;
      let downDiff = 0;
      let finalUserVote: 'up' | 'down' | null = voteType;

      if (existingIdx !== -1) {
        const oldVote = inMemoryVotes[existingIdx];
        if (oldVote.vote_type === voteType) {
          inMemoryVotes.splice(existingIdx, 1);
          if (voteType === 'up') upDiff = -1;
          else downDiff = -1;
          finalUserVote = null;
        } else {
          inMemoryVotes[existingIdx].vote_type = voteType;
          if (voteType === 'up') {
            upDiff = 1;
            downDiff = -1;
          } else {
            upDiff = -1;
            downDiff = 1;
          }
        }
      } else {
        inMemoryVotes.push({
          id: 'offline-vote-' + Math.random().toString(36).substring(2, 9),
          user_id: userId,
          post_id: postId,
          vote_type: voteType,
          created_at: new Date().toISOString()
        });
        if (voteType === 'up') upDiff = 1;
        else downDiff = 1;
      }

      let postAuthorId: string | null = null;
      inMemoryPosts = inMemoryPosts.map(p => {
        if (p.id === postId) {
          postAuthorId = p.author_id;
          return {
            ...p,
            upvotes: Math.max(0, p.upvotes + upDiff),
            downvotes: Math.max(0, p.downvotes + downDiff)
          };
        }
        return p;
      });

      const updatedPost = inMemoryPosts.find(p => p.id === postId);

      if (existingIdx === -1 && postAuthorId && userId) {
        const sender = inMemoryProfiles.find(p => p.id === userId) || inMemoryCurrentUser;
        if (sender) {
          await db.createNotification(
            postAuthorId,
            sender,
            postId,
            voteType === 'up' ? 'vote_up' : 'vote_down'
          );
        }
      }

      return {
        upvotes: updatedPost?.upvotes || 0,
        downvotes: updatedPost?.downvotes || 0,
        userVote: finalUserVote
      };
    }

    const { data: existingVote } = await supabase
      .from('votes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    let upDiff = 0;
    let downDiff = 0;
    let finalUserVote: 'up' | 'down' | null = voteType;

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        await supabase.from('votes').delete().eq('id', existingVote.id);
        if (voteType === 'up') upDiff = -1;
        else downDiff = -1;
        finalUserVote = null;
      } else {
        await supabase
          .from('votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);
        if (voteType === 'up') {
          upDiff = 1;
          downDiff = -1;
        } else {
          upDiff = -1;
          downDiff = 1;
        }
      }
    } else {
      await supabase.from('votes').insert([{
        user_id: userId,
        post_id: postId,
        vote_type: voteType
      }]);
      if (voteType === 'up') upDiff = 1;
      else downDiff = 1;
    }

    const { data: currentPost } = await supabase
      .from('posts')
      .select('upvotes, downvotes, author_id')
      .eq('id', postId)
      .single();

    const newUp = Math.max(0, (currentPost?.upvotes || 0) + upDiff);
    const newDown = Math.max(0, (currentPost?.downvotes || 0) + downDiff);

    const { data: updatedPost } = await supabase
      .from('posts')
      .update({ upvotes: newUp, downvotes: newDown })
      .eq('id', postId)
      .select('upvotes, downvotes')
      .single();

    if (!existingVote && currentPost?.author_id && userId) {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (senderProfile) {
        await db.createNotification(
          currentPost.author_id,
          senderProfile as Profile,
          postId,
          voteType === 'up' ? 'vote_up' : 'vote_down'
        );
      }
    }

    return {
      upvotes: updatedPost?.upvotes || 0,
      downvotes: updatedPost?.downvotes || 0,
      userVote: finalUserVote
    };
  },

  // 獲取投票狀態
  getUserVoteForPost: async (postId: string, userId: string | null): Promise<'up' | 'down' | null> => {
    if (!userId) return null;
    if (!isSupabaseConfigured) {
      const found = inMemoryVotes.find(v => v.post_id === postId && v.user_id === userId);
      return found ? found.vote_type : null;
    }

    const { data, error } = await supabase
      .from('votes')
      .select('vote_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data.vote_type as 'up' | 'down';
  },

  // --- 話題留言/回覆區管理 ---

  // 獲取特定話題的留言
  getComments: async (postId: string): Promise<Comment[]> => {
    if (!isSupabaseConfigured) {
      return inMemoryComments
        .filter(c => c.post_id === postId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as Comment[];
  },

  // 發表回覆留言
  createComment: async (
    postId: string,
    author: Profile,
    content: string,
    isAnonymous: boolean
  ): Promise<Comment> => {
    const hasSensitive = SENSITIVE_WORDS.some(word => content.includes(word));

    if (!isSupabaseConfigured) {
      const newComment: Comment = isAnonymous
        ? {
            id: 'offline-comment-' + Math.random().toString(36).substring(2, 9),
            post_id: postId,
            author_id: null,
            is_anonymous: true,
            author_username: ANONYMOUS_OWL.username,
            author_name: ANONYMOUS_OWL.full_name,
            author_avatar: ANONYMOUS_OWL.avatar_url,
            content: content,
            has_sensitive_content: hasSensitive,
            created_at: new Date().toISOString()
          }
        : {
            id: 'offline-comment-' + Math.random().toString(36).substring(2, 9),
            post_id: postId,
            author_id: author.id,
            is_anonymous: false,
            author_username: author.username,
            author_name: author.full_name,
            author_avatar: author.avatar_url,
            content: content,
            has_sensitive_content: hasSensitive,
            created_at: new Date().toISOString()
          };

      inMemoryComments.push(newComment);

      const post = inMemoryPosts.find(p => p.id === postId);
      if (post && post.author_id) {
        await db.createNotification(
          post.author_id,
          isAnonymous ? null : author,
          postId,
          'comment'
        );
      }

      await db.createMentionNotifications(content, isAnonymous ? null : author, postId);
      return newComment;
    }

    const commentData = isAnonymous
      ? {
          post_id: postId,
          author_id: null,
          is_anonymous: true,
          author_username: ANONYMOUS_OWL.username,
          author_name: ANONYMOUS_OWL.full_name,
          author_avatar: ANONYMOUS_OWL.avatar_url,
          content: content,
          has_sensitive_content: hasSensitive,
        }
      : {
          post_id: postId,
          author_id: author.id,
          is_anonymous: false,
          author_username: author.username,
          author_name: author.full_name,
          author_avatar: author.avatar_url,
          content: content,
          has_sensitive_content: hasSensitive,
        };

    const { data, error } = await supabase
      .from('comments')
      .insert([commentData])
      .select()
      .single();
    if (error) throw error;

    const { data: postData } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (postData?.author_id) {
      await db.createNotification(
        postData.author_id,
        isAnonymous ? null : author,
        postId,
        'comment'
      );
    }

    await db.createMentionNotifications(content, isAnonymous ? null : author, postId);
    return data as Comment;
  },

  // 刪除回覆留言
  deleteComment: async (commentId: string, userId: string): Promise<void> => {
    if (!isSupabaseConfigured) {
      inMemoryComments = inMemoryComments.filter(c => !(c.id === commentId && c.author_id === userId));
      return;
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', userId);
    if (error) throw error;
  },

  // --- 即時通知中心管理 ---

  // 獲取使用者所有的通知列
  getNotifications: async (userId: string): Promise<Notification[]> => {
    if (!isSupabaseConfigured) {
      return inMemoryNotifications
        .filter(n => n.recipient_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Notification[];
  },

  // 將某個用戶的所有通知標記為已讀
  markAllNotificationsRead: async (userId: string): Promise<void> => {
    if (!isSupabaseConfigured) {
      inMemoryNotifications = inMemoryNotifications.map(n => 
        n.recipient_id === userId ? { ...n, is_read: true } : n
      );
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId);
    if (error) throw error;
  },

  // 建立通知
  createNotification: async (
    recipientId: string,
    sender: Profile | null,
    postId: string,
    type: Notification['type']
  ): Promise<void> => {
    if (sender && sender.id === recipientId) return;

    if (!isSupabaseConfigured) {
      inMemoryNotifications.push({
        id: 'offline-notif-' + Math.random().toString(36).substring(2, 9),
        recipient_id: recipientId,
        sender_id: sender ? sender.id : null,
        sender_username: sender ? sender.username : ANONYMOUS_OWL.username,
        sender_avatar: sender ? sender.avatar_url : ANONYMOUS_OWL.avatar_url,
        post_id: postId,
        type: type,
        is_read: false,
        created_at: new Date().toISOString()
      });
      return;
    }

    const notificationData = {
      recipient_id: recipientId,
      sender_id: sender ? sender.id : null,
      sender_username: sender ? sender.username : ANONYMOUS_OWL.username,
      sender_avatar: sender ? sender.avatar_url : ANONYMOUS_OWL.avatar_url,
      post_id: postId,
      type: type,
      is_read: false
    };

    const { error } = await supabase
      .from('notifications')
      .insert([notificationData]);
    if (error) {
      console.error('寫入通知失敗：', error);
    }
  },

  // 解析內容中的 @提及 並建立通知
  createMentionNotifications: async (
    content: string,
    sender: Profile | null,
    postId: string
  ): Promise<void> => {
    try {
      const mentionRegex = /(?:^|\s)@([a-z0-9_]+)/gi;
      const matches = content.match(mentionRegex) || [];
      const mentionedUsernames = Array.from(
        new Set(matches.map(m => m.trim().substring(1).toLowerCase()))
      );

      if (mentionedUsernames.length === 0) return;

      if (!isSupabaseConfigured) {
        for (const username of mentionedUsernames) {
          const recipient = inMemoryProfiles.find(p => p.username === username);
          if (recipient && recipient.is_public !== false) {
            await db.createNotification(
              recipient.id,
              sender,
              postId,
              'mention'
            );
          }
        }
        return;
      }

      for (const username of mentionedUsernames) {
        const { data: recipient } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (recipient && recipient.is_public !== false) {
          await db.createNotification(
            recipient.id,
            sender,
            postId,
            'mention'
          );
        }
      }
    } catch (err) {
      console.error('建立提及通知失敗：', err);
    }
  }
};
