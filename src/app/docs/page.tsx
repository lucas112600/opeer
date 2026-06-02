'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Terminal, 
  Shield, 
  FileText, 
  Database, 
  Copy, 
  Check, 
  BookOpen,
  Code,
  Sparkles
} from 'lucide-react';

export default function DocsPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => {
      setCopiedSection(null);
    }, 2000);
  };

  const sqlSchemaCode = `-- 1. 建立個人檔案表 (Profiles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_public BOOLEAN DEFAULT true NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT false NOT NULL,
    sensitive_filter_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 24),
    CONSTRAINT bio_length CHECK (char_length(bio) <= 150)
);

-- 2. 建立串文表 (Posts) - 物理隔離關鍵：is_anonymous 為 true 時，author_id 必須為 NULL
CREATE TABLE public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN DEFAULT false NOT NULL,
    author_username TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT NOT NULL,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0 NOT NULL,
    downvotes INTEGER DEFAULT 0 NOT NULL,
    has_sensitive_content BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT topic_format CHECK (topic LIKE '#%')
);

-- 3. 建立投票紀錄表 (Votes)
CREATE TABLE public.votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    vote_type TEXT CHECK (vote_type IN ('up', 'down')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, post_id)
);

-- 4. 建立話題留言表 (Comments) - 物理隔離關鍵：is_anonymous 為 true 時，author_id 必須為 NULL
CREATE TABLE public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN DEFAULT false NOT NULL,
    author_username TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT NOT NULL,
    content TEXT NOT NULL,
    has_sensitive_content BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. 建立通知記錄表 (Notifications)
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_username TEXT NOT NULL,
    sender_avatar TEXT NOT NULL,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('vote_up', 'vote_down', 'comment', 'mention')) NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);`;

  const curlApiCode = `# 1. 獲取線上最新話題貼文 (最新排序)
curl -X GET "https://[YOUR_SUPABASE_PROJECT_URL]/rest/v1/posts?select=*&order=created_at.desc" \\
  -H "apikey: [YOUR_SUPABASE_ANON_KEY]" \\
  -H "Authorization: Bearer [YOUR_SUPABASE_ANON_KEY]"

# 2. 針對特定貼文發表留言 (非匿名留言，帶入 Authorization JWT)
curl -X POST "https://[YOUR_SUPABASE_PROJECT_URL]/rest/v1/comments" \\
  -H "apikey: [YOUR_SUPABASE_ANON_KEY]" \\
  -H "Authorization: Bearer [USER_JWT_TOKEN]" \\
  -H "Content-Type: application/json" \\
  -d '{
    "post_id": "4a5c907b-8e9d-4c3f-b6a2-e7f8d9c0a1b2",
    "author_id": "8f7e6d5c-4b3a-2e1d-0c9b-8a7f6e5d4c3b",
    "is_anonymous": false,
    "author_username": "lucas_dev",
    "author_name": "Lucas Wang",
    "author_avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=lucas",
    "content": "這個物理匿名隔離設計非常有說服力！"
  }'

# 3. 投下挺他 (upvote) 票
curl -X POST "https://[YOUR_SUPABASE_PROJECT_URL]/rest/v1/votes" \\
  -H "apikey: [YOUR_SUPABASE_ANON_KEY]" \\
  -H "Authorization: Bearer [USER_JWT_TOKEN]" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "8f7e6d5c-4b3a-2e1d-0c9b-8a7f6e5d4c3b",
    "post_id": "4a5c907b-8e9d-4c3f-b6a2-e7f8d9c0a1b2",
    "vote_type": "up"
  }'`;

  const jsApiCode = `// 初始化 Supabase 客戶端
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://[YOUR_SUPABASE_PROJECT_URL]';
const supabaseAnonKey = '[YOUR_SUPABASE_ANON_KEY]';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 1. 拉取所有話題貼文
async function fetchAllPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) console.error('Error fetching posts:', error);
  return data;
}

// 2. 發表匿名貼文 (author_id 強制傳入 null)
async function publishAnonymousPost(content, topic) {
  const { data, error } = await supabase
    .from('posts')
    .insert([{
      author_id: null, // 實體物理隔離，資料庫將無法追溯使用者
      is_anonymous: true,
      author_username: 'anonymous',
      author_name: '匿名使用者',
      author_avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=anonymous',
      topic: topic.startsWith('#') ? topic : \`#\${topic}\`,
      content: content,
      has_sensitive_content: false
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 3. 獲取未讀通知數
async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}`;

  return (
    <div className="flex flex-col min-h-screen bg-black text-[#f3f5f7] select-text">
      
      {/* 頂部靜態導覽列 */}
      <header className="sticky top-0 z-40 w-full border-b border-[#262626] bg-black/95">
        <div className="mx-auto flex max-w-5xl h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#262626] bg-neutral-900 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Opper" className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-white">Opper</span>
              <span className="text-[10px] bg-neutral-900 border border-[#262626] text-neutral-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                DEV-PORTAL
              </span>
            </div>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg border border-[#262626] hover:bg-neutral-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回主牆</span>
          </a>
        </div>
      </header>

      {/* 獨立文檔版面 - 左右雙欄對齊 */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-8 items-start">
        
        {/* 左側欄：文檔目錄導航 (Table of Contents) */}
        <aside className="w-full md:w-52 shrink-0 md:sticky md:top-24 flex flex-col gap-6 text-left">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block pl-2">
              文檔目錄
            </span>
            <nav className="flex flex-col gap-1">
              <a 
                href="#guidelines"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>社群行為規範</span>
              </a>
              <a 
                href="#anonymity"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>物理隔離設計</span>
              </a>
              <a 
                href="#algorithm"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-neutral-350" />
                <span>推薦演算法</span>
              </a>
              <a 
                href="#schema"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span>開源 SQL DDL</span>
              </a>
              <a 
                href="#api-curl"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <Terminal className="h-3.5 w-3.5 shrink-0" />
                <span>cURL 呼叫範例</span>
              </a>
              <a 
                href="#api-js"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <Code className="h-3.5 w-3.5 shrink-0" />
                <span>JavaScript API</span>
              </a>
              <a 
                href="#team"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-neutral-950 hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-neutral-350" />
                <span>團隊與聯絡資訊</span>
              </a>
            </nav>
          </div>

          <div className="border-t border-[#262626] pt-4 pl-2 space-y-2.5">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">
              開源倡議
            </span>
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              Opper 拒絕密閉黑箱，我們公開所有的 API 路由、資料庫綱要與 RLS 安全政策，藉此確保社群內部的言論公正與匿名權。
            </p>
          </div>
        </aside>

        {/* 右側欄：主文檔顯示區域 */}
        <main className="flex-1 w-full flex flex-col gap-12 text-left">
          
          {/* Header Description */}
          <section className="border-b border-[#262626] pb-8">
            <h1 className="text-2xl font-black text-white tracking-tight mb-3">Opper 社群規範與開源開發者 API 參考文檔</h1>
            <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl">
              本頁面為 Opper 平台的使用規範漢文檔以及為開發者提供的 API 與資料庫設計說明。我們秉持 100% 透明開源精神，公開資料庫 Schema 以及完整的安全政策，讓開發者在充分知悉底層設計原理的前提下，與我們的匿名物理隔離網路進行安全串接。
            </p>
          </section>

          {/* 1. 社群使用規範 */}
          <section id="guidelines" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <FileText className="h-4 w-4 text-white" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">社群行為與隱私防護規範</h2>
            </div>
            
            <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">
              <p>
                Opper 是一個鼓勵真實思維交鋒、支持分身社交的匿名討論社群。然而，匿名並不代表法律上的完全豁免與肆意侵害他人的權利。
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-[#121212] border border-[#262626] p-4 rounded-lg space-y-2">
                  <h3 className="font-bold text-neutral-200 text-[11px] uppercase tracking-wider">🚫 社群禁止與過濾行為</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-neutral-450">
                    <li>禁止散播血腥暴力、鼓勵自殘之言論。</li>
                    <li>禁止非法毒品交易、毒品調配等危害。</li>
                    <li>系統具備<strong>敏感內容詞庫篩選系統</strong>（內建篩選「自殺」、「毒品」、「暴力」、「黑幕」、「折舊費」等關鍵字），凡貼文或留言包含此類文字，將會被系統強制加上模糊遮罩。</li>
                  </ul>
                </div>

                <div className="bg-[#121212] border border-[#262626] p-4 rounded-lg space-y-2">
                  <h3 className="font-bold text-neutral-200 text-[11px] uppercase tracking-wider">🔒 不公開帳戶防提及騷擾機制</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-neutral-450">
                    <li>使用者可在個人帳戶隱私偏好中關閉「公開帳戶」選項（即 <code className="text-white bg-neutral-900 px-1 rounded font-mono font-bold">is_public = false</code>）。</li>
                    <li>當帳戶設為非公開時，其他使用者無論在發佈話題還是留言回覆時，若輸入 <code className="text-white bg-neutral-900 px-1 rounded font-mono font-bold">@username</code>，系統在儲存提及資訊前將會主動校驗。</li>
                    <li><strong>校驗防護：</strong>系統將拒絕對非公開使用者寫入提及通知，從物理層面杜絕針對個人的惡意轟炸與標記騷擾！</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 2. 物理匿名隔離設計原理 */}
          <section id="anonymity" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <Shield className="h-4 w-4 text-white" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">匿名發文的「物理隔離」設計原理</h2>
            </div>
            
            <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">
              <p>
                多數社交平台的「匿名發文」僅是前端的防塵套，後端資料庫依然使用外鍵強關聯至發文者的真實帳號 UUID，這使得平台管理員或入侵者能輕易地進行後台肉搜追蹤。
              </p>
              
              <div className="bg-[#121212] border border-l-2 border-[#262626] border-l-neutral-300 p-4 rounded-lg space-y-3">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider block">
                  ⚙️ Opper 的底層匿名架構分析：
                </span>
                <p>
                  當使用者在發表話題或回覆時勾選了<strong>「匿名發送」</strong>，Opper 的後端連線 API 層（`db.ts`）在寫入 Supabase 資料庫時，會執行嚴苛的物理隔離：
                </p>
                <div className="bg-black p-3 rounded border border-[#202020] font-mono text-[11px] text-emerald-400 overflow-x-auto">
                  {`author_id = null  // 完全清除外鍵關聯
is_anonymous = true
author_username = "anonymous"
author_name = "匿名使用者"`}
                </div>
                <p className="text-neutral-450 mt-1">
                  這意味著這篇貼文在資料庫底層與任何使用者的註冊帳號 Profile <strong>徹底斷開</strong>，完全不留任何外鍵或 ID 鏈接。
                </p>
                <p className="text-neutral-450">
                  <strong>防騷擾副作用：</strong>由於 <code className="text-white bg-neutral-900 px-1 rounded font-bold">author_id IS NULL</code>，當其他使用者對該匿名話題進行 👍/👎 投票或發表留言回覆時，系統在通知模組中無法為其找到話題作者的 UUID。因此，<strong>匿名貼文絕對不會對任何人產生話題通知。</strong> 這項設計完全切斷了惡意人士透過灌票、留言洗版來實施「通知轟炸」以干擾匿名者日常使用的可能性，這才是真正的物理匿名與防騷擾保護！
                </p>
                <p className="text-neutral-450 border-t border-[#1f1f1f] pt-3 mt-3">
                  <strong>🔒 後端端點反向代理隱蔽機制 (Reverse Proxy Endpoint Shielding)：</strong>
                  <br />
                  為了徹底避免在客戶端瀏覽器中洩漏 Supabase 雲端資料庫的真實後台網址，Opper 採用了 **Next.js Rewrite** 反向代理技術。在前端 JavaScript 連線初始化時，系統將 Supabase API 連線路徑統一指向本站端點 <code className="text-white bg-neutral-900 px-1 rounded font-mono">/_supabase</code>。當瀏覽器發起資料請求時，雲端 Edge 伺服器會在後台安靜地代理轉發至真實的後端資料庫網址。這使得訪客在開發者工具中<strong>永遠只能看到本地端點 `/_supabase`</strong>，絕無可能探查與追蹤真實後台網址！
                </p>
              </div>
            </div>
          </section>

          {/* 3. 熱度推薦推播演算法 */}
          <section id="algorithm" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <Sparkles className="h-4 w-4 text-white animate-pulse" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">為你推薦：Opper 熱度推播演算法公式</h2>
            </div>
            
            <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">
              <p>
                Opper 拒絕依據商業利益、政治審查或黑箱權重進行話題推播。我們公開每一行推薦排序邏輯，將首頁的「為你推薦」控制權重新交還給使用者。
              </p>

              <div className="bg-[#121212] border border-[#262626] p-5 rounded-lg space-y-4">
                <div>
                  <h3 className="font-bold text-neutral-200 text-[11px] uppercase tracking-wider mb-2">📊 熱度指數 (Heat Score) 計算公式</h3>
                  <div className="bg-black p-4 rounded border border-[#202020] font-mono text-xs text-center text-emerald-400 overflow-x-auto leading-relaxed select-all">
                    {"Score = ( (👍 * 1.5) - (👎 * 0.5) + (💬 * 3.0) + 10 ) / ( HoursPassed + 2 )^1.2"}
                  </div>
                </div>

                <div className="space-y-2 border-t border-[#1f1f1f] pt-4">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider block">
                    📝 權重變數詳解：
                  </span>
                  <ul className="list-disc list-inside space-y-1.5 text-neutral-450 pl-1">
                    <li><strong>👍 挺他票數 (Upvotes)：</strong>每票可獲得 <code className="text-white bg-neutral-900 px-1 rounded font-bold">+1.5</code> 權重。代表社群的直接肯定與擴大曝光。</li>
                    <li><strong>👎 瞎爆票數 (Downvotes)：</strong>每票扣除 <code className="text-white bg-neutral-900 px-1 rounded font-bold">-0.5</code> 權重。微幅抑制極端爭議言論的曝光率。</li>
                    <li><strong>💬 留言數 (Comments)：</strong>每則回覆留言可獲得 <code className="text-white bg-neutral-900 px-1 rounded font-bold">+3.0</code> 權重（代表話題引起深入交流與社群互動，權重最高）。</li>
                    <li><strong>常數 10 (Base Score)：</strong>確保全新話題在剛發表（無票數留言）時，仍具備高曝光，能進入用戶視野。</li>
                    <li><strong>(HoursPassed + 2)^1.2 (時間衰減因子)：</strong>其中 HoursPassed 是貼文發表至今的小時數。除以時間的指數因子能隨著時間流逝平滑降溫，促使首頁時時刻刻滾動新鮮話題，保證社群活水。</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 4. 開源 SQL DDL Schema */}
          <section id="schema" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <Database className="h-4 w-4 text-white" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">開源資料庫架構 (Open Source SQL DDL)</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>適用於 PostgreSQL / Supabase SQL 編輯器</span>
                <button
                  onClick={() => copyToClipboard(sqlSchemaCode, 'sql')}
                  className="flex items-center gap-1 hover:text-white transition-colors font-bold cursor-pointer"
                >
                  {copiedSection === 'sql' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">已複製 DDL！</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>複製 SQL DDL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative group">
                <pre className="text-[10px] font-mono text-neutral-300 bg-[#0c0c0c] p-4 rounded-xl border border-[#262626] overflow-x-auto leading-relaxed max-h-[380px] select-text">
                  {sqlSchemaCode}
                </pre>
              </div>
            </div>
          </section>

          {/* 5. cURL API 參考 */}
          <section id="api-curl" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <Terminal className="h-4 w-4 text-white" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">開發者 cURL REST API 參考範例</h2>
            </div>
            
            <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">
              <p>
                Opper 架設於 Supabase API 防護層之上，所有資料庫表格皆透過安全認證的 REST API 對外公開。您可以透過帶入 <code className="text-white bg-neutral-900 px-1 rounded">apikey</code> 以及使用者認證 <code className="text-white bg-neutral-900 px-1 rounded">Authorization</code> JWT 進行直接呼叫！
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-500">
                  <span>cURL Command Snippets</span>
                  <button
                    onClick={() => copyToClipboard(curlApiCode, 'curl')}
                    className="flex items-center gap-1 hover:text-white transition-colors font-bold cursor-pointer"
                  >
                    {copiedSection === 'curl' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">已複製指令！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>複製 cURL 指令</span>
                      </>
                    )}
                  </button>
                </div>
                
                <pre className="text-[10px] font-mono text-emerald-400 bg-[#0c0c0c] p-4 rounded-xl border border-[#262626] overflow-x-auto leading-relaxed select-text">
                  {curlApiCode}
                </pre>
              </div>
            </div>
          </section>

          {/* 6. JavaScript API 參考 */}
          <section id="api-js" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <BookOpen className="h-4 w-4 text-white" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">JavaScript / TypeScript SDK 串接說明</h2>
            </div>
            
            <div className="space-y-4 text-xs text-neutral-400 leading-relaxed">
              <p>
                如果您想在第三方網頁或腳本中連線 Opper，可以直接載入 <code className="text-white bg-neutral-900 px-1 rounded font-mono">@supabase/supabase-js</code> 客戶端套件，並以極簡方式撈取或匿名發表話題。
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-neutral-500">
                  <span>JavaScript / Node.js 範例</span>
                  <button
                    onClick={() => copyToClipboard(jsApiCode, 'js')}
                    className="flex items-center gap-1 hover:text-white transition-colors font-bold cursor-pointer"
                  >
                    {copiedSection === 'js' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">已複製代碼！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>複製 JavaScript 程式碼</span>
                      </>
                    )}
                  </button>
                </div>
                
                <pre className="text-[10px] font-mono text-neutral-300 bg-[#0c0c0c] p-4 rounded-xl border border-[#262626] overflow-x-auto leading-relaxed select-text">
                  {jsApiCode}
                </pre>
              </div>
            </div>
          </section>

          {/* 7. 開發團隊與聯絡資訊 */}
          <section id="team" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <Sparkles className="h-4 w-4 text-white" />
              <h2 className="text-sm font-black uppercase text-white tracking-wider">7. 團隊與開源聯絡資訊 (Team & Contact Info)</h2>
            </div>
            
            <div className="bg-[#121212] border border-[#262626] p-5 rounded-lg space-y-4 text-xs text-neutral-400 leading-relaxed">
              <p>
                Opper 社交審判與分身社群專案是由 **Opper 開發團隊** 獨立開發與安全維護。我們致力於推廣絕對隱私、物理隔離發文以及透明公正的智慧推薦演算法技術。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1f1f1f]">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">👥 核心開發團隊</span>
                  <span className="text-xs font-bold text-neutral-200 block">Opper 開發團隊 (Opper Team)</span>
                  <a 
                    href="https://github.com/lucas112600/opeer" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-neutral-450 hover:text-white underline inline-block"
                  >
                    專案儲存庫: lucas112600/opeer
                  </a>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">💼 工作機會與合作洽談</span>
                  <span className="text-xs font-bold text-neutral-200 block">聯絡人：Opper 招募小組</span>
                  <div className="text-[10px] text-neutral-400 space-y-0.5 mt-1 font-mono">
                    <div className="block">行動電話：<a href="tel:0912330351" className="hover:text-white underline">0912330351</a></div>
                    <div className="block">電子郵件：<a href="mailto:huchialin97@gmail.com" className="hover:text-white underline">huchialin97@gmail.com</a></div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1f1f1f]">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">✉️ 聯絡管道與資安漏洞回報</span>
                <p className="text-neutral-450">
                  如果您發現了任何系統資安漏洞、RLS 權限洩漏或是有功能升級提案，請直接至我們的 GitHub 儲存庫提交 **Issue** 或發起 **Pull Request**。我們的開源倡議小組將會於第一時間積極審查並對程式碼進行安全性修補，共同維護去中心化的言論淨土。
                </p>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* 頁尾 */}
      <footer className="w-full border-t border-[#262626] py-8 text-center text-[10px] text-neutral-600 bg-black mt-20 flex-shrink-0">
        <p className="mb-2">© 2026 opper.</p>
        <p className="text-neutral-500">本文件使用漢文 (繁體中文) 編譯，採用 MIT Open Source License 對外授權架構.</p>
      </footer>

    </div>
  );
}
