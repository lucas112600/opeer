import { supabase } from './supabase';

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
// 真實 Supabase 雲端資料庫串接介面 (去 Mock 假資料)
// ----------------------------------------------------

export const db = {
  
  // --- 帳號管理與 Auth 登入邏輯 ---
  
  // 獲取目前登入的真實使用者資訊
  getCurrentUser: async (): Promise<Profile | null> => {
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

  // 登入/註冊帳戶（採用標準 Supabase 匿名登入安全機制）
  loginOrCreateAccount: async (username?: string, fullName?: string): Promise<Profile> => {
    // 優先檢查當前是否已存在真實 Session 憑證，避免重複建立匿名帳戶
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    let userId = currentUser?.id;

    if (!userId) {
      // 呼叫真實 Supabase 匿名登入 ( signInAnonymously )
      const { data: { session }, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !session) throw authError || new Error('真實 Supabase 匿名登入失敗');
      userId = session.user.id;
    }

    // 嘗試撈取由線上 Trigger 自動建立的 profiles 檔案
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error || !data) {
      // 若 trigger 有延遲 race-condition，手動為主機插入初始 Profile 資料
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
    await supabase.auth.signOut();
  },

  // 修改個人設定 (基本資料、隱私公開、2FA、敏感過濾)
  updateProfile: async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    
    // 若修改了基本顯示欄位，同步在資料庫中更新該使用者先前「非匿名」發送的話題與留言（Supabase 觸發器可做，此處於 API 層確保更新）
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

  // 依據 Username 獲取使用者個人檔案 (用於發文 @提及 審查)
  getProfileByUsername: async (username: string): Promise<Profile | null> => {
    const cleanUsername = username.trim().toLowerCase().replace('@', '');
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
    // 透過 comments(id) 關聯載入以統計每篇貼文的真實留言數量
    const { data, error } = await supabase
      .from('posts')
      .select('*, comments(id)');
      
    if (error) throw error;
    
    // 計算每篇貼文的演算法熱度分數
    const postsWithScores = (data || []).map((p: any) => {
      const hoursPassed = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
      const commentCount = p.comments?.length || 0;
      
      // 動態演算法熱度公式：
      // 分數 = ((挺你票 * 1.5) - (瞎爆票 * 0.5) + (留言數 * 3.0) + 10) / (時間差 + 2)^1.2
      const score = ((p.upvotes * 1.5) - (p.downvotes * 0.5) + (commentCount * 3.0) + 10) / Math.pow(hoursPassed + 2, 1.2);
      
      return {
        ...p,
        algorithm_score: score,
      } as Post;
    });

    // 進行排序
    if (orderBy === 'latest') {
      return postsWithScores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (orderBy === 'popular') {
      // 熱門排序：挺他 + 瞎爆 票數合計降序
      return postsWithScores.sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
    } else {
      // 智慧推薦排序：依演算法推播分數降序排列
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
    
    // 實時敏感內容詞庫篩選
    const hasSensitive = SENSITIVE_WORDS.some(word => content.includes(word));

    // 匿名發文「物理隔離」資料建構
    const postData = isAnonymous
       ? {
           author_id: null, // 資料庫中完全清除 user_id，杜絕實體追蹤
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

    // 解析貼文主文中的 @提及 並寫入通知列
    await db.createMentionNotifications(content, isAnonymous ? null : author, data.id);

    return data as Post;
  },

  // 刪除串文
  deletePost: async (postId: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', userId);
    if (error) throw error;
  },

  // --- 投票與審判管理 ---
  
  // 針對話題投票（防重複投票與線上計數器安全移轉）
  votePost: async (
    postId: string, 
    userId: string | null,
    voteType: 'up' | 'down'
  ): Promise<{ upvotes: number; downvotes: number; userVote: 'up' | 'down' | null }> => {
    // 查詢舊投票
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
        // 取消投票
        await supabase.from('votes').delete().eq('id', existingVote.id);
        if (voteType === 'up') upDiff = -1;
        else downDiff = -1;
        finalUserVote = null;
      } else {
        // 換票
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
      // 新投票
      await supabase.from('votes').insert([{
        user_id: userId,
        post_id: postId,
        vote_type: voteType
      }]);
      if (voteType === 'up') upDiff = 1;
      else downDiff = 1;
    }

    // 獲取最新票數計數與話題作者
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

    // 若為新投票、話題作者非匿名、且投票者已登入，寫入即時通知
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

  // 獲取特定話題的線上留言
  getComments: async (postId: string): Promise<Comment[]> => {
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
    // 敏感字詞比對
    const hasSensitive = SENSITIVE_WORDS.some(word => content.includes(word));

    // 匿名物理隔離數據建構
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

    // 獲取話題作者資訊並寫入即時通知
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

    // 解析留言內容中的 @提及 並寫入通知列
    await db.createMentionNotifications(content, isAnonymous ? null : author, postId);

    return data as Comment;
  },

  // 刪除回覆留言
  deleteComment: async (commentId: string, userId: string): Promise<void> => {
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
    // 若觸發者與接收者是同一個人，不需要產生通知列
    if (sender && sender.id === recipientId) return;

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
    // 寫入通知失敗時在背景靜態印出 log 即可，不影響核心發帖或投票流程
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

      for (const username of mentionedUsernames) {
        const { data: recipient } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        // 僅當被提及使用者存在且為公開帳戶時，才寫入提及通知
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
