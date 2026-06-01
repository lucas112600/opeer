'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, ShieldAlert } from 'lucide-react';

interface GatekeeperProps {
  onAccept: () => void;
}

export default function Gatekeeper({ onAccept }: GatekeeperProps) {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [hasConsented, setHasConsented] = useState<boolean>(true);

  useEffect(() => {
    const consented = localStorage.getItem('opper_consented');
    if (consented === 'true') {
      setHasConsented(true);
      onAccept();
    } else {
      setHasConsented(false);
      setIsVisible(true);
    }
  }, [onAccept]);

  const handleAgree = () => {
    localStorage.setItem('opper_consented', 'true');
    setIsVisible(false);
    setTimeout(() => {
      setHasConsented(true);
      onAccept();
    }, 150);
  };

  const handleDisagree = () => {
    window.location.href = 'https://www.google.com';
  };

  if (hasConsented) return null;

  return (
    <div
      id="gatekeeper-container"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black p-4 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* 去 AI 化：平直無光暈的扎實背景 */}
      <div
        id="consent-card"
        className="relative w-full max-w-lg rounded-xl bg-[#121212] border border-[#262626] p-8 text-center shadow-2xl animate-slide-up max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#262626] bg-neutral-950">
            <span className="text-xl font-black text-white">Op</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6 flex-shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-white mb-2" id="gatekeeper-title">
            Opper 使用條款與隱私宣告
          </h1>
          <p className="text-xs text-neutral-500">
            公共話題審判與匿名發表平台
          </p>
        </div>

        {/* 條款內容區 */}
        <div className="flex-1 overflow-y-auto text-left space-y-5 px-1 mb-6 border-y border-[#262626] py-4 scrollbar-thin">
          <div className="flex gap-4">
            <div className="mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded border border-[#262626] bg-neutral-900 text-neutral-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-200">1. 雙軌帳號（公開與匿名發表）</h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                本系統提供公開與匿名發表模式。選擇匿名發表時，系統在寫入貼文時不會記錄您的帳號關聯識別碼（`author_id` 欄位為 NULL），以確保實體數據完全隔離。
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded border border-[#262626] bg-neutral-900 text-neutral-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-200">2. 話題審判與靜態計票</h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                所有使用者皆可對貼文進行 👍 挺他 與 👎 瞎爆 靜態計票。本系統不使用複雜推播演算法，所有串文一律以時間倒序或點擊熱度排序於公共動態牆。
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded border border-[#262626] bg-neutral-900 text-neutral-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-200">3. 使用規範與責任限制</h3>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                禁止發表涉及惡意人身攻擊、違法交易、洩漏個人私密隱私（肉搜）或散播仇恨之言論。匿名發表後為保數據中性，貼文將無法被編輯與刪除。
              </p>
            </div>
          </div>
        </div>

        {/* 按鈕操作區 */}
        <div className="flex gap-3 flex-shrink-0">
          <button
            id="btn-disagree"
            onClick={handleDisagree}
            className="flex-1 rounded-lg bg-neutral-900 border border-[#262626] text-neutral-400 py-2.5 text-xs font-bold hover:bg-neutral-850 hover:text-white transition-colors"
          >
            拒絕並離開
          </button>
          <button
            id="btn-agree"
            onClick={handleAgree}
            className="flex-[2] rounded-lg bg-white text-black py-2.5 text-xs font-bold hover:bg-neutral-200 active:scale-[0.98] transition-all shadow-sm"
          >
            同意使用條款並進入
          </button>
        </div>
      </div>
    </div>
  );
}
