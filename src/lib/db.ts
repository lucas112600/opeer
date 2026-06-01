import { supabase, isSupabaseConfigured } from './supabase';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  is_public: boolean; // 是否為公開帳號（可被他人提及）
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
  created_at: string;
}

export interface Vote {
  id: string;
  user_id: string | null;
  post_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

// 預設的匿名使用者資訊，物理隔離發文者資訊時使用
export const ANONYMOUS_OWL = {
  username: 'anonymous',
  full_name: '匿名使用者',
  avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=anonymous&backgroundColor=262626&colors=ffffff',
};

// ----------------------------------------------------
// 1. LOCALSTORAGE MOCK DATABASE ENGINE (離線降級引擎)
// ----------------------------------------------------

const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const stored = window.localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const setLocalStorage = <T>(key: string, value: T): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

// 初始化本地 Mock 資料
const initMockDB = () => {
  if (typeof window === 'undefined') return;
  
  // 檢查是否已初始化，若無則塞入一些精緻的預設話題供使用者立刻體驗
  if (!window.localStorage.getItem('opper_posts')) {
    const defaultProfiles: Profile[] = [
      {
        id: 'user-mock-1',
        username: 'gossip_king',
        full_name: '八卦糾察隊長',
        avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=gossip_king',
        bio: '專門收集全網最辣的職場八卦，挺我不瞎！',
        is_public: true, // 公開帳號，可被提及
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'user-mock-2',
        username: 'love_therapist',
        full_name: '兩性情感諮商師',
        avatar_url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=love_therapist',
        bio: 'AA制真的是愛情終結者嗎？來這邊接受公審吧！',
        is_public: false, // 不公開帳號，不可被提及！
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      }
    ];

    const defaultPosts: Post[] = [
      {
        id: 'post-mock-1',
        author_id: 'user-mock-1',
        is_anonymous: false,
        author_username: 'gossip_king',
        author_name: '八卦糾察隊長',
        author_avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=gossip_king',
        topic: '#職場黑幕',
        content: '我們公司主管上週開會說「大家今年共體時艱，沒有年終，但明年一定大發」，結果今天看他開新牽的賓士來上班。請問我是該直接在茶水間散播，還是直接提離職？',
        upvotes: 42,
        downvotes: 3,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'post-mock-2',
        author_id: null, // 物理隔離，匿名發文
        is_anonymous: true,
        author_username: ANONYMOUS_OWL.username,
        author_name: ANONYMOUS_OWL.full_name,
        author_avatar: ANONYMOUS_OWL.avatar_url,
        topic: '#感情公審',
        content: '跟男友交往三年，上個月聊到結婚。他說婚後住在他們家，房貸他爸媽付的所以不用我們出。但是，他要求我每個月出 8000 元作為「住在他們家的磨損折舊費與孝親公積金」...這難道就是微辣版AA制嗎？我覺得極度瞎，大家怎麼看？',
        upvotes: 128,
        downvotes: 12,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'post-mock-3',
        author_id: 'user-mock-2',
        is_anonymous: false,
        author_username: 'love_therapist',
        author_name: '兩性情感諮商師',
        author_avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=love_therapist',
        topic: '#兩性關係',
        content: '許多人將「AA制」視為自私的代名詞，但我認為理性的財務切分，才是維持長遠平等的關鍵。只要雙方講好，AA制能讓關係更健康，大家同意嗎？',
        upvotes: 18,
        downvotes: 67,
        created_at: new Date(Date.now() - 1800000).toISOString(),
      }
    ];

    setLocalStorage('opper_profiles', defaultProfiles);
    setLocalStorage('opper_posts', defaultPosts);
    setLocalStorage('opper_votes', []);
  }
};

// ----------------------------------------------------
// 2. 雙軌資料庫實作介面
// ----------------------------------------------------

export const db = {
  // --- 帳號管理與登入邏輯 ---
  
  // 獲取目前登入的使用者資訊
  getCurrentUser: async (): Promise<Profile | null> => {
    if (isSupabaseConfigured && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error || !data) return null;
      return data as Profile;
    } else {
      initMockDB();
      return getLocalStorage<Profile | null>('opper_current_user', null);
    }
  },

  // 登入/註冊帳戶（一鍵生成 DiceBear 帳戶）
  loginOrCreateAccount: async (username?: string, fullName?: string): Promise<Profile> => {
    initMockDB();
    const finalUsername = username || 'user_' + Math.random().toString(36).substring(2, 10);
    const finalFullName = fullName || 'User_' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const mockId = 'user-' + Math.random().toString(36).substring(2, 15);
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${mockId}`;
    
    const newProfile: Profile = {
      id: mockId,
      username: finalUsername.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      full_name: finalFullName,
      avatar_url: avatarUrl,
      bio: '這是我的分身專用簡介。',
      is_public: true, // 預設帳號公開
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      // 註冊真實 Supabase 流程
      // 本專案開源演示中為簡化操作，優先以匿名登入 (Anonymously Sign In) 或 Mock 模擬為主
      // 若使用真實 Supabase，可在前端以 Supabase Auth UI 登入，此處回傳 profile
      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();
      if (error) {
        // 若已存在，則撈取
        const { data: existing } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', newProfile.username)
          .single();
        if (existing) return existing as Profile;
      }
      if (data) return data as Profile;
    }

    // Mock 模式：存入本地並設為當前帳號
    const profiles = getLocalStorage<Profile[]>('opper_profiles', []);
    profiles.push(newProfile);
    setLocalStorage('opper_profiles', profiles);
    setLocalStorage('opper_current_user', newProfile);
    return newProfile;
  },

  // 登出
  signOut: async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('opper_current_user');
      }
    }
  },

  // 修改個人檔案
  updateProfile: async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    } else {
      const currentUser = getLocalStorage<Profile | null>('opper_current_user', null);
      if (!currentUser || currentUser.id !== userId) {
        throw new Error('未授權修改此個人檔案');
      }

      const updatedUser = { ...currentUser, ...updates };
      setLocalStorage('opper_current_user', updatedUser);

      const profiles = getLocalStorage<Profile[]>('opper_profiles', []);
      const updatedProfiles = profiles.map(p => p.id === userId ? updatedUser : p);
      setLocalStorage('opper_profiles', updatedProfiles);

      // 同步更新所有該用戶非匿名發布的串文頭像與名稱
      const posts = getLocalStorage<Post[]>('opper_posts', []);
      const updatedPosts = posts.map(p => {
        if (!p.is_anonymous && p.author_id === userId) {
          return {
            ...p,
            author_username: updates.username || p.author_username,
            author_name: updates.full_name || p.author_name,
            author_avatar: updates.avatar_url || p.author_avatar,
          };
        }
        return p;
      });
      setLocalStorage('opper_posts', updatedPosts);

      return updatedUser;
    }
  },

  // 依據 Username 獲取使用者個人檔案 (用於發文 @提及 審查)
  getProfileByUsername: async (username: string): Promise<Profile | null> => {
    const cleanUsername = username.trim().toLowerCase().replace('@', '');
    
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();
      if (error || !data) return null;
      return data as Profile;
    } else {
      initMockDB();
      const profiles = getLocalStorage<Profile[]>('opper_profiles', []);
      const profile = profiles.find(p => p.username.toLowerCase() === cleanUsername);
      return profile || null;
    }
  },

  // --- 串文管理 ---
  
  // 獲取所有發文
  getPosts: async (orderBy: 'latest' | 'popular' = 'latest'): Promise<Post[]> => {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('posts').select('*');
      if (orderBy === 'latest') {
        query = query.order('created_at', { ascending: false });
      } else {
        // 熱門排序：挺他 + 瞎爆 票數合計降序
        query = query.order('upvotes', { ascending: false }); // 簡化邏輯為依據 👍 票數排序
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Post[];
    } else {
      initMockDB();
      const posts = getLocalStorage<Post[]>('opper_posts', []);
      if (orderBy === 'latest') {
        return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        return [...posts].sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
      }
    }
  },

  // 發表新串文
  createPost: async (
    author: Profile, 
    content: string, 
    topic: string, 
    isAnonymous: boolean
  ): Promise<Post> => {
    // 嚴格將主題格式化為包含 # 前綴
    const formattedTopic = topic.startsWith('#') ? topic.trim() : `#${topic.trim()}`;
    
    // 匿名發文「物理隔離」資料建構
    const postData: Omit<Post, 'id' | 'created_at' | 'upvotes' | 'downvotes'> = isAnonymous
      ? {
          author_id: null, // 資料庫中完全清除 user_id，杜絕實體追蹤
          is_anonymous: true,
          author_username: ANONYMOUS_OWL.username,
          author_name: ANONYMOUS_OWL.full_name,
          author_avatar: ANONYMOUS_OWL.avatar_url,
          topic: formattedTopic,
          content: content,
        }
      : {
          author_id: author.id,
          is_anonymous: false,
          author_username: author.username,
          author_name: author.full_name,
          author_avatar: author.avatar_url,
          topic: formattedTopic,
          content: content,
        };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('posts')
        .insert([postData])
        .select()
        .single();
      if (error) throw error;
      return data as Post;
    } else {
      const newPost: Post = {
        id: 'post-' + Math.random().toString(36).substring(2, 15),
        ...postData,
        upvotes: 0,
        downvotes: 0,
        created_at: new Date().toISOString(),
      };

      const posts = getLocalStorage<Post[]>('opper_posts', []);
      posts.unshift(newPost);
      setLocalStorage('opper_posts', posts);
      return newPost;
    }
  },

  // 刪除串文
  deletePost: async (postId: string, userId: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', userId); // RLS 會自動防禦，但防呆加上條件
      if (error) throw error;
    } else {
      const posts = getLocalStorage<Post[]>('opper_posts', []);
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error('貼文不存在');
      
      // 匿名貼文沒有 author_id，理論上物理隔離後無法由單一使用者刪除
      if (post.is_anonymous) {
        throw new Error('匿名貼文為物理隔離狀態，寫入後不可刪除');
      }
      
      if (post.author_id !== userId) {
        throw new Error('無權限刪除他人貼文');
      }

      const filteredPosts = posts.filter(p => p.id !== postId);
      setLocalStorage('opper_posts', filteredPosts);
    }
  },

  // --- 投票與審判管理 ---
  
  // 針對串文投票
  votePost: async (
    postId: string, 
    userId: string | null, // 訪客可以是 null
    voteType: 'up' | 'down'
  ): Promise<{ upvotes: number; downvotes: number; userVote: 'up' | 'down' | null }> => {
    if (isSupabaseConfigured && supabase) {
      // Supabase 模式：先寫入/更新投票表，再回傳最新貼文計數
      // 這裡採用交易或單純的 RPC/觸發器，在開源範例中，我們於前端完成兩階段操作：
      // 1. 寫入 votes 表
      // 2. 累加或移轉 posts 表對應的 counts 欄位
      
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
          // 重複點擊同一個按鈕：取消投票
          await supabase.from('votes').delete().eq('id', existingVote.id);
          if (voteType === 'up') upDiff = -1;
          else downDiff = -1;
          finalUserVote = null;
        } else {
          // 換票：👍 改 👎 或相反
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

      // 更新 posts 表票數
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
    } else {
      initMockDB();
      const posts = getLocalStorage<Post[]>('opper_posts', []);
      const votes = getLocalStorage<Vote[]>('opper_votes', []);
      
      const postIndex = posts.findIndex(p => p.id === postId);
      if (postIndex === -1) throw new Error('話題不存在');
      
      const post = posts[postIndex];
      
      // 本地防重複機制
      // 訪客投票：如果無 userId，使用 localStorage 中的 voted_ids 作為安全防線
      let localUserKey = userId ? `user-${userId}` : 'guest-visitor';
      const existingVoteIndex = votes.findIndex(v => v.post_id === postId && v.user_id === localUserKey);
      
      let upDiff = 0;
      let downDiff = 0;
      let finalUserVote: 'up' | 'down' | null = voteType;

      if (existingVoteIndex !== -1) {
        const existingVote = votes[existingVoteIndex];
        if (existingVote.vote_type === voteType) {
          // 取消投票
          votes.splice(existingVoteIndex, 1);
          if (voteType === 'up') upDiff = -1;
          else downDiff = -1;
          finalUserVote = null;
        } else {
          // 換票
          votes[existingVoteIndex].vote_type = voteType;
          if (voteType === 'up') {
            upDiff = 1;
            downDiff = -1;
          } else {
            upDiff = -1;
            downDiff = 1;
          }
        }
      } else {
        // 新增投票
        votes.push({
          id: 'vote-' + Math.random().toString(36).substring(2, 15),
          user_id: localUserKey,
          post_id: postId,
          vote_type: voteType,
          created_at: new Date().toISOString()
        });
        if (voteType === 'up') upDiff = 1;
        else downDiff = 1;
      }

      post.upvotes = Math.max(0, post.upvotes + upDiff);
      post.downvotes = Math.max(0, post.downvotes + downDiff);
      
      setLocalStorage('opper_posts', posts);
      setLocalStorage('opper_votes', votes);

      return {
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        userVote: finalUserVote
      };
    }
  },

  // 獲取使用者對某特定貼文的投票狀態
  getUserVoteForPost: async (postId: string, userId: string | null): Promise<'up' | 'down' | null> => {
    if (isSupabaseConfigured && supabase) {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return null;
      return data.vote_type as 'up' | 'down';
    } else {
      initMockDB();
      const votes = getLocalStorage<Vote[]>('opper_votes', []);
      let localUserKey = userId ? `user-${userId}` : 'guest-visitor';
      const vote = votes.find(v => v.post_id === postId && v.user_id === localUserKey);
      return vote ? vote.vote_type : null;
    }
  }
};
