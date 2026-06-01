-- Opper 開源社交平台資料庫結構定義檔 (Supabase / PostgreSQL)
-- 包含 Profiles, Posts, Votes 結構，以及行級安全政策 (RLS)

-- 1. 建立個人檔案表 (Profiles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_public BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 24),
    CONSTRAINT bio_length CHECK (char_length(bio) <= 150)
);

-- 啟用 Profiles 行級安全政策 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles 的 RLS 政策
CREATE POLICY "允許所有人讀取個人檔案" 
    ON public.profiles FOR SELECT 
    USING (true);

CREATE POLICY "允許登入使用者建立自己的個人檔案" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "僅允許本人更新自己的個人檔案" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);


-- 2. 建立串文表 (Posts)
-- 匿名發文防禦核心：當 is_anonymous 為 true 時，author_id 必須寫入 NULL
CREATE TABLE public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- 匿名時為 NULL，切斷與使用者的實體物理關聯
    is_anonymous BOOLEAN DEFAULT false NOT NULL,
    author_username TEXT NOT NULL,      -- 顯示名稱：若是真實則為真實 username，若匿名則為 "@anonymous_owl" 等遮罩
    author_name TEXT NOT NULL,          -- 顯示名稱：若是真實則為真實姓名，若匿名則為 "匿名貓頭鷹"
    author_avatar TEXT NOT NULL,        -- 顯示頭像：若是真實則為真實頭像 URL，若匿名則為統一的匿名 Owl 圖片或 DiceBear 遮罩
    topic TEXT NOT NULL,                -- 話題主題，例如 "#感情公審"
    content TEXT NOT NULL,              -- 發文主體內容
    upvotes INTEGER DEFAULT 0 NOT NULL, -- 挺他票數
    downvotes INTEGER DEFAULT 0 NOT NULL,-- 瞎爆票數
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    CONSTRAINT topic_format CHECK (topic LIKE '#%')
);

-- 啟用 Posts 行級安全政策 (RLS)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Posts 的 RLS 政策
CREATE POLICY "允許所有人讀取所有串文" 
    ON public.posts FOR SELECT 
    USING (true);

CREATE POLICY "允許登入使用者發送串文" 
    ON public.posts FOR INSERT 
    WITH CHECK (
        -- 如果是匿名發文，author_id 必須為 NULL，保障物理隔離
        (is_anonymous = true AND author_id IS NULL) OR
        -- 如果是非匿名發文，author_id 必須與當前登入者 ID 相同
        (is_anonymous = false AND auth.uid() = author_id)
    );

CREATE POLICY "僅允許發表者修改自己非匿名的發文" 
    ON public.posts FOR UPDATE 
    USING (is_anonymous = false AND auth.uid() = author_id)
    WITH CHECK (is_anonymous = false AND auth.uid() = author_id);

CREATE POLICY "僅允許發表者刪除自己非匿名的發文" 
    ON public.posts FOR DELETE 
    USING (is_anonymous = false AND auth.uid() = author_id);


-- 3. 建立投票紀錄表 (Votes)
-- 防止單一用戶對同一話題重複審判
CREATE TABLE public.votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- 未登入訪客或匿名投票時為 NULL
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    vote_type TEXT CHECK (vote_type IN ('up', 'down')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- 每個使用者針對每篇貼文只能投一票
    UNIQUE(user_id, post_id)
);

-- 啟用 Votes 行級安全政策 (RLS)
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Votes 的 RLS 政策
CREATE POLICY "允許所有人讀取投票紀錄" 
    ON public.votes FOR SELECT 
    USING (true);

CREATE POLICY "允許登入使用者投下贊成或反對票" 
    ON public.votes FOR INSERT 
    WITH CHECK (
        -- 可以是匿名訪客投票（user_id 為 NULL），或者是登入使用者投票（user_id 等於 auth.uid()）
        user_id IS NULL OR auth.uid() = user_id
    );

CREATE POLICY "允許登入使用者撤銷或修改自己的投票" 
    ON public.votes FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "允許登入使用者刪除自己的投票" 
    ON public.votes FOR DELETE 
    USING (auth.uid() = user_id);


-- 4. 建立自動建立個人檔案觸發器 (Trigger)
-- 當 Supabase Auth 新建帳號時，自動在 public.profiles 插入一條隨機頭像紀錄
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url, bio, is_public, created_at)
    VALUES (
        new.id,
        -- 使用隨機字串作為預設 username，讓使用者後續自訂
        'user_' || substring(md5(random()::text) from 1 for 8),
        new.raw_user_meta_data->>'full_name',
        -- 預設使用 DiceBear 酷炫的 bottts 機器人頭像
        'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id::text,
        '這是我的分身專用簡介。',
        true,
        NOW()
    );
    RETURN NEW;
END;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. 建立話題留言表 (Comments)
-- 匿名留言防禦核心：當 is_anonymous 為 true 時，author_id 必須寫入 NULL
CREATE TABLE public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- 匿名時為 NULL，切斷與使用者的實體物理關聯
    is_anonymous BOOLEAN DEFAULT false NOT NULL,
    author_username TEXT NOT NULL,      -- 顯示名稱：真實 username 或 "anonymous"
    author_name TEXT NOT NULL,          -- 顯示名稱：真實姓名 或 "匿名使用者"
    author_avatar TEXT NOT NULL,        -- 顯示頭像：真實頭像 或 幾何幾何頭像
    content TEXT NOT NULL,              -- 留言主體內容
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 啟用 Comments 行級安全政策 (RLS)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments 的 RLS 政策
CREATE POLICY "允許所有人讀取所有話題留言" 
    ON public.comments FOR SELECT 
    USING (true);

CREATE POLICY "允許登入使用者發表話題留言" 
    ON public.comments FOR INSERT 
    WITH CHECK (
        -- 如果是匿名回覆，author_id 必須為 NULL，保障物理隔離
        (is_anonymous = true AND author_id IS NULL) OR
        -- 如果是非匿名回覆，author_id 必須與當前登入者 ID 相同
        (is_anonymous = false AND auth.uid() = author_id)
    );

CREATE POLICY "僅允許發表者刪除自己非匿名之話題留言" 
    ON public.comments FOR DELETE 
    USING (is_anonymous = false AND auth.uid() = author_id);
