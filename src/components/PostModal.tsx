'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, EyeOff, AlertCircle, Image, Trash2, Mic, Square, Play, Pause, Video } from 'lucide-react';
import { Profile, ANONYMOUS_OWL, db } from '../lib/db';

interface PostModalProps {
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    content: string, 
    topic: string, 
    isAnonymous: boolean, 
    imageUrl?: string,
    videoUrl?: string,
    audioUrl?: string
  ) => Promise<void>;
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
  
  // 多媒體附件狀態
  const [imageUrl, setImageUrl] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isVideoUploading, setIsVideoUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 語音錄製狀態
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [timerId, setTimerId] = useState<any>(null);

  // 試聽狀態
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [previewAudioObj, setPreviewAudioObj] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 關閉彈窗時釋放錄音試聽資源
    return () => {
      if (previewAudioObj) {
        previewAudioObj.pause();
      }
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [previewAudioObj, timerId]);

  if (!isOpen) return null;

  // 處理本機相片上傳
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

  // 處理本機影片上傳
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('影片大小不能超過 15MB。');
      return;
    }

    setIsVideoUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoUrl(reader.result as string);
      setIsVideoUploading(false);
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('影片讀取失敗。');
      setIsVideoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // 啟動錄音
  const startRecording = async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        
        // 讀取為 Base64 Data URL 寫入 Supabase
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setTimerId(interval);

    } catch (err: any) {
      console.error(err);
      setErrorMsg('無法開啟麥克風，請確認已授權瀏覽器錄音權限。');
    }
  };

  // 停止錄音
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerId) {
        clearInterval(timerId);
        setTimerId(null);
      }
    }
  };

  // 試聽播放切換
  const togglePlayPreview = () => {
    if (!audioUrl) return;

    if (isPlayingPreview && previewAudioObj) {
      previewAudioObj.pause();
      setIsPlayingPreview(false);
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlayingPreview(false);
      };
      audio.play();
      setPreviewAudioObj(audio);
      setIsPlayingPreview(true);
    }
  };

  // 刪除/重錄語音
  const clearAudio = () => {
    if (previewAudioObj) {
      previewAudioObj.pause();
    }
    setAudioUrl('');
    setIsPlayingPreview(false);
    setPreviewAudioObj(null);
    setRecordingDuration(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !topic.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
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
      
      if (previewAudioObj) {
        previewAudioObj.pause();
      }

      await onSubmit(
        content.trim(), 
        finalTopic, 
        isAnonymous, 
        imageUrl || undefined,
        videoUrl || undefined,
        audioUrl || undefined
      );

      setContent('');
      setTopic('');
      setImageUrl('');
      setVideoUrl('');
      clearAudio();
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
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col overflow-y-auto pr-1 scrollbar-thin">
          
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
          <div className="flex-shrink-0 flex flex-col min-h-[140px]">
            <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">
              公審話題內容 (Content)
            </label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="輸入您想發布的話題主文，大眾將對其進行 👍 / 👎 投票表態..."
              className="w-full flex-1 rounded-lg bg-black border border-[#262626] text-xs text-white px-3.5 py-2.5 focus:border-white focus:outline-none transition-colors resize-none overflow-y-auto min-h-[100px]"
            />
          </div>

          {/* 話題相片附件區 */}
          <div className="flex-shrink-0 space-y-2">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              話題照片附件 (Image Attachment)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={imageUrl.startsWith('data:')}
                placeholder={imageUrl.startsWith('data:') ? "已載入本機轉換相片..." : "輸入外部圖片網址 (如: https://...)"}
                className="flex-1 rounded-lg bg-black border border-[#262626] text-xs text-white px-3 py-2 focus:border-white focus:outline-none disabled:opacity-40 transition-colors"
              />
              
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

            {imageUrl && (
              <div className="relative mt-2 rounded-lg border border-[#262626] bg-black p-2 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-10 w-10 rounded overflow-hidden border border-[#202020] bg-neutral-950 flex-shrink-0 flex items-center justify-center">
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

          {/* 話題影片附件區 */}
          <div className="flex-shrink-0 space-y-2">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              話題影片附件 (Video Attachment)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={videoUrl.startsWith('data:') ? '' : videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={videoUrl.startsWith('data:')}
                placeholder={videoUrl.startsWith('data:') ? "已載入本機影片..." : "輸入外部影片網址 (如: https://...)"}
                className="flex-1 rounded-lg bg-black border border-[#262626] text-xs text-white px-3 py-2 focus:border-white focus:outline-none disabled:opacity-40 transition-colors"
              />
              
              <label className="relative flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-[#262626] hover:bg-neutral-850 hover:text-white text-neutral-400 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer select-none">
                <Video className="h-3.5 w-3.5" />
                <span>{isVideoUploading ? '讀取中...' : '選擇本地影片'}</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="hidden"
                  disabled={isVideoUploading}
                />
              </label>
            </div>

            {videoUrl && (
              <div className="relative mt-2 rounded-lg border border-[#262626] bg-black p-2 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-10 w-10 rounded overflow-hidden border border-[#202020] bg-neutral-950 flex-shrink-0 flex items-center justify-center">
                    <video
                      src={videoUrl}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-neutral-300 block truncate">已成功掛載影片附件</span>
                    <span className="text-[8px] text-neutral-500 block truncate font-mono">
                      {videoUrl.startsWith('data:') ? `Base64 影片串 (${Math.round(videoUrl.length / 1024)} KB)` : videoUrl}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  className="rounded p-1 text-neutral-500 hover:text-rose-455 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="移除影片"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 語音說話錄音附件區 */}
          <div className="flex-shrink-0 space-y-2">
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              分身語音錄音 (Voice Attachment)
            </label>
            <div className="flex gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-neutral-900 border border-[#262626] hover:bg-neutral-850 hover:text-white text-neutral-400 py-2.5 text-xs font-bold transition-all cursor-pointer"
                >
                  <Mic className="h-4 w-4 text-emerald-400" />
                  <span>🎤 開始錄製語音說話</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-950/40 border border-red-900/30 text-rose-400 py-2.5 text-xs font-bold transition-all animate-pulse cursor-pointer"
                >
                  <Square className="h-4 w-4 text-rose-500 fill-rose-500 animate-ping" />
                  <span>⏹️ 停止錄音 ({Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')})</span>
                </button>
              )}
            </div>

            {audioUrl && (
              <div className="relative mt-2 rounded-lg border border-[#262626] bg-black p-3 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={togglePlayPreview}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 border border-[#262626] text-white hover:bg-neutral-850 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    {isPlayingPreview ? (
                      <Pause className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-neutral-300 block truncate">已錄製語音說話</span>
                    <span className="text-[8px] text-neutral-500 block truncate font-mono">
                      WebM 音軌資料串 ({Math.round(audioUrl.length / 1024)} KB)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAudio}
                  className="rounded p-1 text-neutral-500 hover:text-rose-455 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="刪除錄音"
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
              className="flex-[2] rounded-lg bg-white text-black py-2 text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? '發表中...' : '提交至公共擂台'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
