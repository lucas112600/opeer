'use client';

import React from 'react';
import { PlusCircle, LogOut, Settings } from 'lucide-react';
import { Profile } from '../lib/db';

interface NavbarProps {
  currentUser: Profile | null;
  onEditProfile: () => void;
  onNewPost: () => void;
  onSignOut: () => void;
}

export default function Navbar({
  currentUser,
  onEditProfile,
  onNewPost,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#262626] bg-black/90">
      <div className="mx-auto flex max-w-5xl h-16 items-center justify-between px-6">
        
        {/* Left Side: Minimalist Text Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#262626] bg-neutral-900">
            <span className="text-sm font-black text-white">Op</span>
          </div>
          <span className="text-sm font-black tracking-tight text-white">
            Opper
          </span>
        </div>

        {/* Right Side: Navigation Actions */}
        <div className="flex items-center gap-4">
          {currentUser ? (
            <>
              {/* Write Thread Button */}
              <button
                id="nav-btn-newpost"
                onClick={onNewPost}
                className="flex items-center gap-1.5 rounded-lg bg-[#f3f5f7] hover:bg-neutral-200 text-black px-4 py-2 text-xs font-bold transition-colors active:scale-[0.98]"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>發表話題</span>
              </button>

              {/* User Profile Widget */}
              <div className="flex items-center gap-3 pl-3 border-l border-[#262626]">
                <button
                  id="nav-btn-profile"
                  onClick={onEditProfile}
                  className="group relative flex h-7.5 w-7.5 overflow-hidden rounded-full border border-[#262626] hover:border-neutral-400 transition-colors"
                  title="編輯個人檔案"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.full_name}
                    className="h-full w-full object-cover"
                  />
                </button>
                
                <div className="hidden flex-col text-left md:flex">
                  <span className="text-xs font-bold text-neutral-200 max-w-[100px] truncate">
                    {currentUser.full_name}
                  </span>
                  <span className="text-[10px] text-neutral-500 max-w-[100px] truncate">
                    @{currentUser.username}
                  </span>
                </div>

                {/* Settings Gear Button */}
                <button
                  id="nav-btn-settings"
                  onClick={onEditProfile}
                  className="rounded-lg p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors"
                  title="帳戶設定"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>

                {/* Sign Out Button */}
                <button
                  id="nav-btn-signout"
                  onClick={onSignOut}
                  className="rounded-lg p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors"
                  title="登出帳戶"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <span className="text-xs text-neutral-500">正在準備公審...</span>
          )}
        </div>

      </div>
    </header>
  );
}
