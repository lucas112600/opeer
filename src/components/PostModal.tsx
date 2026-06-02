'use client';

import React, { useState } from 'react';
import { X, Globe, EyeOff, AlertCircle, Image, Trash2 } from 'lucide-react';
import { Profile, ANONYMOUS_OWL, db } from '../lib/db';

interface PostModalProps {
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string, topic: string, isAnonymous: boolean, imageUrl?: string) => Promise<void>;
}

export default function PostModal({
  currentUser,
  isOpen,
  onClose,
  onSubmit,
}: PostModalProps) {
  const [content, setContent] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('照片大小不能超過 5MB。');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
      setIsUploading(false);
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('照片讀取失敗。');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !topic.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. 解析與驗證 @提及 使用者公開狀態
      const mentionRegex = /(?:^|\s)@([a-z0-9_]+)/gi;
      const matches = content.match(mentionRegex) || [];
      const mentionedUsernames = Array.from(
        new Set(matches.map(m => m.trim().substring(1).toLowerCase()))
      );

      if (mentionedUsernames.length > 0) {
        for (const username of mentionedUsernames) {
          const profile = await db.getProfileByUsername(username);
          if (!profile) {
            setErrorMsg(`提及的使用者 @${username} 不存在。`);
            setIsSubmitting(false);
            return;
          }
          if (profile.is_public === false) {
            setErrorMsg(`無法提及 @${username}，因為該帳戶設定為不公開。`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      const cleanTopic = topic.trim();
      const finalTopic = cleanTopic.startsWith('#') ? cleanTopic : `#${cleanTopic}`;
      
      await onSubmit(content.trim(), finalTopic, isAnonymous, imageUrl || undefined);
      setContent('');
      setTopic('');
      setImageUrl('');
      setIsAnonymous(false);
      setErrorMsg('');
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('發表失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div 
        id="post-modal"
        className="w-full max-w-lg rounded-xl bg-[#121212] border border-[#262626] p-6 text-left shadow-2xl animate-scale-in flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4 flex-shrink-0">
          <h2 className="text-sm font-bold text-white">發表新話題</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-rose-950/40 border border-rose-900/30 p-3 text-xs text-rose-400 animate-fade-in flex-shrink-0">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* User Identity Preview */}
        <div className="flex items-center justify-between bg-black p-3.5 rounded-lg border border-[#262626] mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-[#262626]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isAnonymous ? ANONYMOUS_OWL.avatar_url : currentUser.avatar_url}
                alt="身分頭像"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold block text-neutral-200">
                {isAnonymous ? '匿名使用者' : currentUser.full_name}
              </span>
              <span className="text-[10px] text-neutral-500 block">
                @{isAnonymous ? 'anonymous' : currentUser.username}
              </span>
            </div>
          </div>

          {/* Privacy Badge */}
          <div className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border border-[#262626] text-neutral-400 bg-neutral-900">
            {isAnonymous ? (
              <>
                <EyeOff className="h-3 w-3" />
                <span>匿名模式</span>
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" />
                <span>公開模式</span>
              </>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col overflow-hidden">
          
          {/* Topic Tag Input */}
          <div className="flex-shrink-0">
            <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">
              話題標籤 (Topic Tag)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-bold text-neutral-500">#</span>
              <input
                type="text"
                required
                value={topic.replace('#', '')}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如: 感情公審、微辣AA制、職場黑幕"
                className="w-full rounded-lg bg-black border border-[#262626] text-xs text-white pl-7 pr-3.5 py-2.5 focus:border-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Main Content Input */}
          <div className="flex-1 flex flex-col min-h-[120px]">
            <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase tracking-wider flex-shrink-0">
              公審話題內容 (Content)
            </label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="輸入您想發布的話題主文，大眾將對其進行 👍 / 👎 投票表態..."
              className="w-full flex-1 rounded-lg bg-black border border-[#262626] text-xs text-white px-3.5 py-2.5 focus:border-white focus:outline-none transition-colors resize-none overflow-y-auto"
            />
          </div>

          {/* 話題相片附件區 */}
          <div className="flex-shrink-0 space-y-2">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              話題照片附件 (Image Attachment)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              {/* 網址貼上 */}
              <input
                type="text"
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={imageUrl.startsWith('data:')}
                placeholder={imageUrl.startsWith('data:') ? "已載入本機轉換相片..." : "輸入外部圖片網址 (如: https://...)"}
                className="flex-1 rounded-lg bg-black border border-[#262626] text-xs text-white px-3 py-2 focus:border-white focus:outline-none disabled:opacity-40 transition-colors"
              />
              
              {/* 檔案上傳按鈕 */}
              <label className="relative flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-[#262626] hover:bg-neutral-850 hover:text-white text-neutral-400 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer select-none">
                <Image className="h-3.5 w-3.5" />
                <span>{isUploading ? '讀取中...' : '選擇本地照片'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* 實時相片預覽卡片 */}
            {imageUrl && (
              <div className="relative mt-2 rounded-lg border border-[#262626] bg-black p-2 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-10 w-10 rounded overflow-hidden border border-[#202020] bg-neutral-950 flex-shrink-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="相片預覽"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-neutral-300 block truncate">已成功掛載照片附件</span>
                    <span className="text-[8px] text-neutral-500 block truncate font-mono">
                      {imageUrl.startsWith('data:') ? `Base64 資料串 (${Math.round(imageUrl.length / 1024)} KB)` : imageUrl}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="rounded p-1 text-neutral-500 hover:text-rose-455 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="移除附圖"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Dual-Track Anonymity Switch */}
          <div className="bg-neutral-950 p-3.5 rounded-lg border border-[#262626] flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-left pr-4">
                <span className="text-xs font-bold text-neutral-200 block">使用匿名身分發表</span>
                <span className="text-[10px] text-neutral-500 block mt-0.5">隱藏您的個人資料，此貼文無法追蹤到帳戶</span>
              </div>
              <button
                type="button"
                id="toggle-anonymous"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 outline-none ${
                  isAnonymous ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform duration-200 ${
                    isAnonymous ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Standard Warning Line */}
            {isAnonymous && (
              <span className="text-[10px] text-neutral-500 mt-2 block border-t border-[#262626] pt-2">
                * 已開啟匿名發表。本貼文在寫入後將不可編輯與刪除，以切斷帳戶操作關聯。
              </span>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-[#262626] flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-neutral-900 border border-[#262626] text-neutral-400 py-2 text-xs font-bold hover:bg-neutral-850 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim() || !topic.trim()}
              className="flex-[2] rounded-lg bg-white text-black py-2 text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? '發表中...' : '提交至公共擂台'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
