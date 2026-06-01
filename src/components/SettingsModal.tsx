'use client';

import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  AlertCircle, 
  Shield, 
  ShieldOff, 
  Trash2, 
  Lock, 
  Unlock, 
  Smartphone, 
  MapPin, 
  Check, 
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import { Profile } from '../lib/db';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<Profile>) => Promise<void>;
  onResetAll: () => void; // 清除快取並登出
}

type TabType = 'basic' | 'privacy' | 'security';

export default function SettingsModal({
  currentUser,
  isOpen,
  onClose,
  onSave,
  onResetAll,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  // Basic info states
  const [username, setUsername] = useState<string>(currentUser.username);
  const [fullName, setFullName] = useState<string>(currentUser.full_name || '');
  const [bio, setBio] = useState<string>(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatar_url || '');

  // Privacy preferences states
  const [isPublic, setIsPublic] = useState<boolean>(currentUser.is_public !== false);
  const [sensitiveFilterEnabled, setSensitiveFilterEnabled] = useState<boolean>(
    currentUser.sensitive_filter_enabled !== false
  );

  // Security states (2FA)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(
    currentUser.two_factor_enabled === true
  );

  // 2FA TOTP configuration modal states
  const [show2FAConfig, setShow2FAConfig] = useState<boolean>(false);
  const [totpCode, setTotpCode] = useState<string>('');
  const [totpError, setTotpError] = useState<string>('');
  const [isActivating2FA, setIsActivating2FA] = useState<boolean>(true); // true = setup, false = turn off

  // Login activity states
  const [isSigningOutOthers, setIsSigningOutOthers] = useState<boolean>(false);
  const [signOutOthersSuccess, setSignOutOthersSuccess] = useState<boolean>(false);

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

  const handleToggle2FA = () => {
    if (!twoFactorEnabled) {
      // Prompt setup form
      setIsActivating2FA(true);
      setTotpCode('');
      setTotpError('');
      setShow2FAConfig(true);
    } else {
      // Prompt turn off form
      setIsActivating2FA(false);
      setTotpCode('');
      setTotpError('');
      setShow2FAConfig(true);
    }
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');

    if (totpCode.trim() === '123456') {
      setTwoFactorEnabled(isActivating2FA);
      setShow2FAConfig(false);
      setTotpCode('');
    } else {
      setTotpError('驗證碼不正確。請輸入預設安全驗證碼 123456');
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    setSignOutOthersSuccess(false);
    try {
      // 呼叫真實的 Supabase Auth 登出其他裝置會話 API
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      setSignOutOthersSuccess(true);
    } catch (err: any) {
      console.error('登出其他裝置失敗：', err);
      alert('無法登出其他裝置，可能因為目前是匿名會話或網路連線問題。');
    } finally {
      setIsSigningOutOthers(false);
    }
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
        sensitive_filter_enabled: sensitiveFilterEnabled,
        two_factor_enabled: twoFactorEnabled,
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
        className="w-full max-w-md rounded-xl bg-[#121212] border border-[#262626] p-6 text-left shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden"
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1f1f1f] mb-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex-1 text-center py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'basic'
                ? 'text-white border-white'
                : 'text-neutral-500 border-transparent hover:text-neutral-350'
            }`}
          >
            基本資料
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 text-center py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'privacy'
                ? 'text-white border-white'
                : 'text-neutral-500 border-transparent hover:text-neutral-350'
            }`}
          >
            隱私偏好
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 text-center py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'security'
                ? 'text-white border-white'
                : 'text-neutral-500 border-transparent hover:text-neutral-350'
            }`}
          >
            帳號安全
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
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-5 pb-4">
            
            {/* 1. Basic Settings Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4 animate-fade-in">
                {/* Avatar Area */}
                <div className="flex items-center gap-4 bg-black p-3.5 rounded-lg border border-[#262626]">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#262626] bg-neutral-950 flex-shrink-0">
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
                    rows={2.5}
                    className="w-full rounded-lg bg-black border border-[#262626] text-xs text-white px-3.5 py-2.5 focus:border-white focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {/* 2. Privacy Settings Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-4 animate-fade-in">
                {/* Privacy Switch (is_public) */}
                <div className="bg-black p-4 rounded-lg border border-[#262626] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-left pr-4">
                      <span className="text-xs font-bold text-neutral-200 block">帳戶隱私狀態</span>
                      <span className="text-[10px] text-neutral-500 block mt-0.5 leading-relaxed">
                        {isPublic ? '允許其他人在發表話題時標記提及您' : '禁止他人提及標記您的帳戶'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                      className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
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
                  <div className="flex gap-2 border-t border-[#1f1f1f] pt-3 text-[10px] text-neutral-400 items-start text-left leading-relaxed">
                    {isPublic ? (
                      <>
                        <Shield className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                        <span><strong>公開帳戶：</strong>其他使用者在發表話題或回覆留言時標記 <code className="text-white bg-neutral-900 px-1 rounded">@{username}</code> 可以正常發布。</span>
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-4 w-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                        <span><strong>不公開帳戶：</strong>若其他人在發文時提及您，系統將自動攔截並阻擋其發表，保護您的隱私不被騷擾。</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Sensitive Content Filter Switch */}
                <div className="bg-black p-4 rounded-lg border border-[#262626] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-left pr-4">
                      <span className="text-xs font-bold text-neutral-200 block">敏感內容過濾器</span>
                      <span className="text-[10px] text-neutral-500 block mt-0.5 leading-relaxed">
                        針對敏感話題或爭議內容卡片覆蓋模糊遮罩
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSensitiveFilterEnabled(!sensitiveFilterEnabled)}
                      className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
                        sensitiveFilterEnabled ? 'bg-white' : 'bg-neutral-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform duration-200 ${
                          sensitiveFilterEnabled ? 'translate-x-5' : 'translate-x-1.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex gap-2 border-t border-[#1f1f1f] pt-3 text-[10px] text-neutral-400 items-start text-left leading-relaxed">
                    <AlertCircle className="h-4 w-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <span>
                      {sensitiveFilterEnabled 
                        ? '過濾器已開啟：凡貼文或回覆中包含「自殺、毒品、暴力、黑幕、折舊費」等敏感內容時，系統會自動在動態牆覆蓋灰色「⚠️ 內容警示」遮罩，點擊「顯示內容」後方可解鎖查看。' 
                        : '過濾器已關閉：所有敏感話題與留言內容將直接在牆上完全展示，不提供警示與模糊遮罩。'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Security Settings Tab (2FA & Login Activities) */}
            {activeTab === 'security' && (
              <div className="space-y-4 animate-fade-in text-left">
                
                {/* 2FA Toggle Widget */}
                <div className="bg-black p-4 rounded-lg border border-[#262626] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="text-left pr-4">
                      <div className="flex items-center gap-1.5">
                        <Lock className={`h-4 w-4 ${twoFactorEnabled ? 'text-white' : 'text-neutral-500'}`} />
                        <span className="text-xs font-bold text-neutral-200">雙重驗證 (2FA)</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 block mt-1 leading-relaxed">
                        開啟後，在執行敏感操作前須提供 6 位數驗證代碼。
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggle2FA}
                      className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors duration-200 outline-none flex-shrink-0 ${
                        twoFactorEnabled ? 'bg-white' : 'bg-neutral-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform duration-200 ${
                          twoFactorEnabled ? 'translate-x-5' : 'translate-x-1.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* 2FA Status Badge */}
                  <div className="text-[10px] text-neutral-400 border-t border-[#1f1f1f] pt-3 leading-relaxed">
                    {twoFactorEnabled ? (
                      <span className="text-white flex items-center gap-1 font-bold">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        已受雙重驗證保護。敏感操作已被安全攔截。
                      </span>
                    ) : (
                      <span className="text-neutral-500">
                        目前未開啟 2FA。為了提升您的帳號安全防禦強度，建議啟用。
                      </span>
                    )}
                  </div>
                </div>

                {/* 2FA Setup/Disable Sub-panel (In-place modal state) */}
                {show2FAConfig && (
                  <div className="bg-neutral-950 p-4 rounded-lg border border-[#262626] space-y-3.5 animate-scale-in">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">
                        {isActivating2FA ? '🛠️ 設定雙重驗證' : '🔓 停用雙重驗證'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShow2FAConfig(false)}
                        className="text-neutral-500 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {isActivating2FA ? (
                      <div className="text-[10px] text-neutral-400 space-y-2 leading-relaxed">
                        <p>請將下列安全金鑰手動加入到您的 Google Authenticator 或 TOTP 雙重驗證 App 中：</p>
                        <div className="bg-black p-2.5 rounded border border-[#262626] font-mono text-xs text-white text-center flex items-center justify-center gap-1.5">
                          <Key className="h-3.5 w-3.5 text-neutral-500" />
                          <span>OPPER-SEC-8F92</span>
                        </div>
                        <p className="text-[9px] text-neutral-500 mt-1">※ 請在下方輸入 App 產生的安全驗證碼（請輸入 <code className="text-white">123456</code> 進行驗證啟用）：</p>
                      </div>
                    ) : (
                      <div className="text-[10px] text-neutral-400 leading-relaxed">
                        <p>關閉雙重驗證會降低安全防護。請輸入您的 6 位數安全驗證碼（請輸入 <code className="text-white">123456</code> 驗證關閉）：</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="請輸入 6 位數驗證碼"
                          className="flex-1 text-center font-mono rounded bg-black border border-[#262626] text-xs text-white px-3 py-2 focus:border-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerify2FA}
                          className="bg-white text-black px-4 rounded text-xs font-bold hover:bg-neutral-200"
                        >
                          確認
                        </button>
                      </div>
                      
                      {totpError && (
                        <span className="text-[9px] text-rose-400 block text-left">
                          {totpError}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Recent Login Activities */}
                <div className="bg-black p-4 rounded-lg border border-[#262626] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-200">最近登入活動 (Login Activity)</span>
                    <button
                      type="button"
                      onClick={handleSignOutOthers}
                      disabled={isSigningOutOthers || signOutOthersSuccess}
                      className="text-[9px] font-bold bg-neutral-900 border border-[#262626] hover:bg-neutral-800 disabled:opacity-40 text-neutral-300 hover:text-white px-2.5 py-1.5 rounded transition-all"
                    >
                      {isSigningOutOthers ? '登出中...' : signOutOthersSuccess ? '已登出其他' : '登出其他裝置'}
                    </button>
                  </div>

                  <div className="space-y-3.5 border-t border-[#1f1f1f] pt-3.5">
                    {/* Device 1 */}
                    <div className="flex items-start gap-2.5 text-xs text-left">
                      <Smartphone className="h-4 w-4 text-white flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-white block">Chrome (Windows PC)</span>
                          <span className="text-[8px] bg-white/10 text-neutral-200 px-1 rounded font-bold uppercase tracking-wider scale-90">作用中</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span>台北, 台灣 · 當前裝置</span>
                        </div>
                      </div>
                    </div>

                    {/* Device 2 */}
                    <div className="flex items-start gap-2.5 text-xs text-left opacity-75">
                      <Smartphone className="h-4 w-4 text-neutral-550 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-neutral-300 block">Safari (iPhone)</span>
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 mt-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span>新北, 台灣 · 2 天前</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {signOutOthersSuccess && (
                    <div className="text-[9px] text-emerald-400 bg-emerald-500/10 p-2 rounded text-left border border-emerald-950 flex items-center gap-1 animate-fade-in">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>已發送登出命令。除了此瀏覽器會話外，其他裝置已被登出。</span>
                    </div>
                  )}
                </div>

                {/* Danger Zone */}
                <div className="border-t border-[#262626] pt-4 mt-2">
                  <div className="bg-[#1c080c] border border-rose-950 p-3.5 rounded-lg flex items-center justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-rose-400 block">清除本地資料</span>
                      <span className="text-[9px] text-neutral-500 block mt-0.5 leading-relaxed">
                        這會登出當前分身，並重設本機快取與 Gatekeeper 同意書狀態。
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
                      className="flex items-center gap-1 bg-rose-950/20 border border-rose-900/40 hover:bg-rose-900/30 text-rose-400 px-3 py-2 rounded text-[10px] font-bold transition-all flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>清除並登出</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-[#262626] flex-shrink-0 bg-[#121212]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-neutral-900 border border-[#262626] text-neutral-400 py-2.5 text-xs font-bold hover:bg-neutral-850 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || show2FAConfig}
              className="flex-[2] rounded-lg bg-white text-black py-2.5 text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? '正在保存...' : '確認保存設定'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
