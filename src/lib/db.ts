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
  getPosts: async (orderBy: 'latest' | 'popular' = 'latest'): Promise<Post[]> => {
    let query = supabase.from('posts').select('*');
    if (orderBy === 'latest') {
      query = query.order('created_at', { ascending: false });
    } else {
      // 熱門排序：挺他 + 瞎爆 票數合計降序
      query = query.order('upvotes', { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as Post[];
  },

  // 發表話題
  createPost: async (
    author: Profile, 
    content: string, 
    topic: string, 
    isAnonymous: boolean
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
        };

    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single();
    if (error) throw error;
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

    // 獲取最新票數計數
    const { data: currentPost } = await supabase.from('posts').select('upvotes, downvotes').eq('id', postId).single();
    const newUp = Math.max(0, (currentPost?.upvotes || 0) + upDiff);
    const newDown = Math.max(0, (currentPost?.downvotes || 0) + downDiff);

    const { data: updatedPost } = await supabase
      .from('posts')
      .update({ upvotes: newUp, downvotes: newDown })
      .eq('id', postId)
      .select('upvotes, downvotes')
      .single();

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
  }
};
