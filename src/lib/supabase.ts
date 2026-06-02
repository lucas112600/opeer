import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 檢查是否已設定 Supabase 環境變數
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// 建立真實 Supabase 客戶端連線
// 資安極致升級：在前端瀏覽器執行時，將連線網址指向本地反向代理端點 /_supabase 
// 這能徹底隱蔽 Supabase Real URL，防止向客戶端暴露後端敏感專案網址資訊
const finalUrl = typeof window !== 'undefined'
  ? window.location.origin + '/_supabase'
  : (supabaseUrl || 'https://placeholder-project.supabase.co');

const finalKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(finalUrl, finalKey);
