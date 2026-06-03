'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, EyeOff, AlertCircle, Image, Trash2, Mic, Square, Video } from 'lucide-react';
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isVideoUploading, setIsVideoUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 語音錄製狀態
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [timerId, setTimerId] = useState<any>(null);

  useEffect(() => {
    // 關閉彈窗時釋放資源
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [timerId]);

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
    setImageFile(file);
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
    setVideoFile(file);
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
      const supportedType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const mimeType = chunks[0]?.type || recorder.mimeType || supportedType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        
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

  // 刪除/重錄語音
  const clearAudio = () => {
    setAudioUrl('');
    setAudioBlob(null);
    setRecordingDuration(0);
    setErrorMsg('');
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

      let finalImageUrl = imageUrl;
      let finalVideoUrl = videoUrl;
      let finalAudioUrl = audioUrl;

      // 1. 上傳相片到 Supabase Storage
      if (imageFile) {
        setErrorMsg('正在上傳相片附件至儲存桶...');
        finalImageUrl = await db.uploadFile('media', 'images', imageFile, imageFile.name);
      }

      // 2. 上傳影片到 Supabase Storage
      if (videoFile) {
        setErrorMsg('正在上傳影片附件至儲存桶...');
        finalVideoUrl = await db.uploadFile('media', 'videos', videoFile, videoFile.name);
      }

      // 3. 上傳語音錄音到 Supabase Storage
      if (audioBlob) {
        setErrorMsg('正在上傳語音錄製音軌...');
        finalAudioUrl = await db.uploadFile('media', 'audio', audioBlob, 'audio.webm');
      }

      await onSubmit(
        content.trim(), 
        finalTopic, 
        isAnonymous, 
        finalImageUrl || undefined,
        finalVideoUrl || undefined,
        finalAudioUrl || undefined
      );

      setContent('');
      setTopic('');
      setImageUrl('');
      setImageFile(null);
      setVideoUrl('');
      setVideoFile(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div 
        id="post-modal"
        className="w-full max-w-[620px] rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] shadow-2xl animate-scale-in flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-6 py-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
          >
            取消
          </button>
          <h2 className="text-sm font-bold text-white">建立話題串</h2>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim() || !topic.trim()}
            className="rounded-full bg-white text-black px-4 py-1.5 text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSubmitting ? '發布中...' : '發布'}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded bg-rose-950/40 p-3 text-xs text-rose-400 flex-shrink-0">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Content (Threads Style Flow) */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin flex flex-col">
          <div className="flex w-full items-start">
            
            {/* Left: Avatar & Line */}
            <div className="mr-3.5 flex flex-col items-center flex-shrink-0 w-9">
              <div className="relative h-9 w-9 overflow-hidden rounded-full bg-neutral-900">
                <img
                  src={isAnonymous ? ANONYMOUS_OWL.avatar_url : currentUser.avatar_url}
                  alt="身分頭像"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="w-[1px] h-full min-h-[40px] bg-[#1f1f1f] mt-2 rounded-full" />
            </div>

            {/* Right: Content Input */}
            <div className="flex-1 flex flex-col min-w-0 pt-0.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">
                  {isAnonymous ? '匿名使用者' : currentUser.full_name}
                </span>
                
                {/* 匿名模式 Toggle */}
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`flex items-center gap-1 rounded text-[9px] font-bold px-2 py-0.5 border transition-colors ${
                    isAnonymous
                      ? 'text-black bg-white border-white'
                      : 'text-neutral-500 bg-transparent border-[#1f1f1f] hover:text-white hover:border-neutral-700'
                  }`}
                  title={isAnonymous ? '已開啟匿名發表' : '切換為匿名發表'}
                >
                  {isAnonymous ? <EyeOff className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                  <span>{isAnonymous ? '匿名' : '公開'}</span>
                </button>
              </div>

              {/* Main Textarea */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="發布新話題串..."
                className="w-full bg-transparent border-none text-sm text-white placeholder-neutral-600 focus:ring-0 focus:outline-none resize-none min-h-[100px] py-1"
              />

              {/* Topic Input (Minimalist) */}
              <div className="flex items-center mb-4 mt-2 border-b border-[#1f1f1f] pb-1">
                <span className="text-neutral-500 font-bold mr-1">#</span>
                <input
                  type="text"
                  value={topic.replace('#', '')}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="話題標籤"
                  className="flex-1 bg-transparent border-none text-xs text-white placeholder-neutral-700 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Attachments Preview */}
              <div className="flex flex-col gap-3 mt-2">
                {imageUrl && (
                  <div className="relative rounded-xl border border-[#1f1f1f] overflow-hidden max-w-sm">
                    <img src={imageUrl} alt="preview" className="w-full h-auto" />
                    <button onClick={() => { setImageUrl(''); setImageFile(null); }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-black/80">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {videoUrl && (
                  <div className="relative rounded-xl border border-[#1f1f1f] overflow-hidden max-w-sm">
                    <video src={videoUrl} className="w-full h-auto" controls />
                    <button onClick={() => { setVideoUrl(''); setVideoFile(null); }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-black/80">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {audioUrl && (
                  <div className="relative rounded-xl border border-[#1f1f1f] bg-[#121212] p-3 max-w-sm flex items-center gap-3">
                    <audio src={audioUrl} controls className="h-8 flex-1 outline-none" />
                    <button type="button" onClick={clearAudio} className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Compact Toolbar */}
              <div className="flex items-center gap-4 mt-6">
                <label className="text-neutral-500 hover:text-white cursor-pointer transition-colors" title="上傳照片">
                  <Image className="h-4.5 w-4.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                </label>
                <label className="text-neutral-500 hover:text-white cursor-pointer transition-colors" title="上傳影片">
                  <Video className="h-4.5 w-4.5" />
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoChange} disabled={isVideoUploading} />
                </label>
                {!isRecording && !audioUrl && (
                  <button type="button" onClick={startRecording} className="text-neutral-500 hover:text-white transition-colors" title="錄音">
                    <Mic className="h-4.5 w-4.5" />
                  </button>
                )}
                {isRecording && !audioUrl && (
                  <button type="button" onClick={stopRecording} className="text-rose-500 hover:text-rose-400 transition-colors animate-pulse flex items-center gap-1" title="停止錄音">
                    <Square className="h-4 w-4 fill-rose-500" />
                    <span className="text-[10px]">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
