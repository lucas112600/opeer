'use client';

import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { Profile } from '../lib/db';

interface SettingsModalProps {
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<Profile>) => Promise<void>;
  onResetAll: () => void; // 清除快取並登出
}

export default function SettingsModal({
  currentUser,
  isOpen,
  onClose,
  onSave,
  onResetAll,
}: SettingsModalProps) {
  const [username, setUsername] = useState<string>(currentUser.username);
  const [fullName, setFullName] = useState<string>(currentUser.full_name || '');
  const [bio, setBio] = useState<string>(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatar_url || '');
  const [isPublic, setIsPublic] = useState<boolean>(currentUser.is_public !== false); // 預設為 true
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleRandomAvatar = () => {
    const styles = ['pixel-art', 'bottts', 'identicon', 'avataaars'];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const newAvatar = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
    setAvatarUrl(newAvatar);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3 || cleanUsername.length > 24) {
      setErrorMsg('帳號長度需介於 3 到 24 個字元之間。');
      return;
    }

    if (bio.length > 150) {
      setErrorMsg('個人簡介長度上限為 150 個字。');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        username: cleanUsername,
        full_name: fullName.trim() || '匿名使用者',
        bio: bio.trim(),
        avatar_url: avatarUrl,
        is_public: isPublic,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '更新失敗，帳號可能已被他人佔用。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div 
        id="settings-modal"
        className="w-full max-w-md rounded-xl bg-[#121212] border border-[#262626] p-6 text-left shadow-2xl animate-scale-in flex flex-col max-h-[95vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-4 flex-shrink-0">
          <h2 className="text-sm font-bold text-white">帳戶設定</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-950/40 border border-rose-900/30 p-3 text-xs text-rose-400 animate-fade-in flex-shrink-0">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          
          {/* Avatar Area */}
          <div className="flex items-center gap-4 bg-black p-3.5 rounded-lg border border-[#262626]">
            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#262626] bg-neutral-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt="預覽頭像"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-neutral-500 block mb-1.5">調整或生成隨機幾何與像素頭像</span>
              <button
                type="button"
                onClick={handleRandomAvatar}
                className="flex items-center gap-1.5 rounded bg-neutral-900 border border-[#262626] text-neutral-300 px-3 py-1.5 text-xs font-bold hover:bg-neutral-850 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                <span>更換隨機頭像</span>
              </button>
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">
              使用者帳號 (@username)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="例如: user_opper"
              className="w-full rounded-lg bg-black border border-[#262626] text-xs text-white px-3.5 py-2.5 focus:border-white focus:outline-none transition-colors"
            />
            <span className="text-[9px] text-neutral-500 mt-1 block">僅限小寫英文字母、數字與底線</span>
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">
              顯示名稱 (Full Name)
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="例如: 分身使用者"
              className="w-full rounded-lg bg-black border border-[#262626] text-xs text-white px-3.5 py-2.5 focus:border-white focus:outline-none transition-colors"
            />
          </div>

          {/* Biography Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                個人自介 (Biography)
              </label>
              <span className={`text-[9px] ${bio.length > 150 ? 'text-rose-400' : 'text-neutral-500'}`}>
                {bio.length} / 150 字
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.substring(0, 150))}
              placeholder="簡單介紹您的角色設定..."
              rows={2}
              className="w-full rounded-lg bg-black border border-[#262626] text-xs text-white px-3.5 py-2.5 focus:border-white focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Privacy Switch (is_public) */}
          <div className="bg-black p-4 rounded-lg border border-[#262626] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-left pr-4">
                <span className="text-xs font-bold text-neutral-200 block">帳戶隱私狀態</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">
                  {isPublic ? '允許其他人在發表話題時標記提及您' : '禁止他人提及標記您的帳戶'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors duration-200 outline-none ${
                  isPublic ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform duration-200 ${
                    isPublic ? 'translate-x-5' : 'translate-x-1.5'
                  }`}
                />
              </button>
            </div>

            {/* Privacy Badge */}
            <div className="flex gap-2 border-t border-[#262626] pt-3 text-[10px] text-neutral-400 items-center text-left">
              {isPublic ? (
                <>
                  <Shield className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                  <span><strong>公開帳戶：</strong>其他使用者在話題主文中輸入 <code className="text-white">@{username}</code> 時可以成功發布。</span>
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                  <span><strong>不公開帳戶：</strong>若其他人在發文時提及您，系統將攔截阻擋其發表話題，保護您的隱私不被騷擾。</span>
                </>
              )}
            </div>
          </div>

          {/* Reset All Data debug button */}
          <div className="border-t border-[#262626] pt-4 mt-2">
            <div className="bg-rose-950/20 border border-rose-900/30 p-3.5 rounded-lg flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <span className="text-xs font-bold text-rose-300 block">清除本地資料</span>
                <span className="text-[9px] text-neutral-500 block mt-0.5 leading-relaxed">
                  這會清空 `localStorage` 中所有貼文、投票與帳戶，適合重設測試。
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const confirmReset = window.confirm('這將徹底刪除瀏覽器快取中的所有貼文與投票紀錄，並登出帳戶。您確定要執行此操作嗎？');
                  if (confirmReset) {
                    onResetAll();
                  }
                }}
                className="flex items-center gap-1 bg-rose-900/10 border border-rose-900/30 hover:bg-rose-900/20 text-rose-400 px-3 py-2 rounded text-[10px] font-bold transition-all flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>清除並登出</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#262626] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-neutral-900 border border-[#262626] text-neutral-400 py-2 text-xs font-bold hover:bg-neutral-850 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] rounded-lg bg-white text-black py-2 text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? '正在保存...' : '確認保存設定'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
