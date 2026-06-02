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
  video_url?: string | null; // 話題附加影片網址或 Base64 字串
  audio_url?: string | null; // 話題語音錄製 Base64 字串
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
// 雙軌資料庫串接介面 (雲端 Supabase - 徹底剪除一切假數據)
// ----------------------------------------------------
export const db = {
  
  // --- 帳號管理與 Auth 登入邏輯 ---
  
  // 使用 Email 與密碼註冊帳戶，並手動傳入 Full Name
  signUpWithEmail: async (email: string, password: string, fullName: string): Promise<void> => {
    if (!isSupabaseConfigured) throw new Error('資料庫未配置，無法進行註冊。');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) throw error;
  },

  // 使用 Email 與密碼登入真實帳戶
  signInWithEmail: async (email: string, password: string): Promise<Profile> => {
    if (!isSupabaseConfigured) throw new Error('資料庫未配置，無法進行登入。');

    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !session) throw authError || new Error('帳號或密碼錯誤。');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !data) {
      const finalUsername = 'user_' + Math.random().toString(36).substring(2, 10);
      const newProfile = {
        id: session.user.id,
        username: finalUsername,
        full_name: email.split('@')[0],
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.id}`,
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

  // 獲取目前登入的使用者資訊
  getCurrentUser: async (): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return null;

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

  // 登入/註冊匿名帳戶 (相容舊版 RLS，但主推 Email 註冊)
  loginOrCreateAccount: async (username?: string, fullName?: string): Promise<Profile> => {
    if (!isSupabaseConfigured) throw new Error('資料庫未配置，無法進行登入。');

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
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  },

  // 修改個人設定 (基本資料、隱私公開、2FA、敏感過濾)
  updateProfile: async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    if (!isSupabaseConfigured) throw new Error('資料庫未配置。');

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
    if (!isSupabaseConfigured) return null;

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
    if (!isSupabaseConfigured) return [];

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
    imageUrl?: string,
    videoUrl?: string,
    audioUrl?: string
  ): Promise<Post> => {
    const formattedTopic = topic.startsWith('#') ? topic.trim() : `#${topic.trim()}`;
    const hasSensitive = SENSITIVE_WORDS.some(word => content.includes(word));

    if (!isSupabaseConfigured) throw new Error('資料庫未配置。');

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
            video_url: videoUrl || null,
            audio_url: audioUrl || null,
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
            video_url: videoUrl || null,
            audio_url: audioUrl || null,
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
    if (!isSupabaseConfigured) throw new Error('資料庫未配置。');

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
    if (!isSupabaseConfigured) throw new Error('資料庫未配置。');

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
    if (!isSupabaseConfigured) return null;

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
    if (!isSupabaseConfigured) return [];

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

    if (!isSupabaseConfigured) throw new Error('資料庫未配置。');

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
    if (!isSupabaseConfigured) throw new Error('資料庫未配置。');

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
    if (!isSupabaseConfigured) return [];

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
    if (!isSupabaseConfigured) return;

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
    if (!isSupabaseConfigured) return;

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
      if (!isSupabaseConfigured) return;

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
