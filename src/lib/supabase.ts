import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 檢查是否已設定 Supabase 環境變數
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// 建立真實 Supabase 客戶端連線（若未配置，使用 placeholder 以防編譯初始化崩潰，守衛會阻擋後續執行）
const finalUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const finalKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(finalUrl, finalKey);
