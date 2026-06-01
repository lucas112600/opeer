import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 檢查是否已設定 Supabase 環境變數
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// 建立 Supabase 客戶端（若未配置，則為 null）
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
