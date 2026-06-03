'use client';

import React, { useState, useRef } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { Post } from '../lib/db';

interface StoryGeneratorProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

export default function StoryGenerator({
  post,
  isOpen,
  onClose,
}: StoryGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);
  const [cardTheme, setCardTheme] = useState<'dark' | 'light'>('dark');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 計算百分比
  const totalVotes = post.upvotes + post.downvotes;
  const upPercent = totalVotes > 0 ? Math.round((post.upvotes / totalVotes) * 100) : 50;
  const downPercent = totalVotes > 0 ? 100 - upPercent : 50;

  if (!isOpen) return null;

  const getShareUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?topic=${encodeURIComponent(post.topic)}`;
    }
    return 'https://opper.social';
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    setIsDownloaded(false);

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isDark = cardTheme === 'dark';

      // 1. 設定 1080 x 1920 標準限動規格
      canvas.width = 1080;
      canvas.height = 1920;

      // 2. 繪製背景
      ctx.fillStyle = isDark ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, 1080, 1920);

      // 3. 繪製標準細緻灰框線
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDark ? '#262626' : '#e5e5e5';
      ctx.strokeRect(50, 50, 980, 1820);

      // 4. 頂部 Opper 簡約字樣
      ctx.fillStyle = isDark ? '#ffffff' : '#000000';
      ctx.font = '900 56px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OPPER', 540, 190);

      ctx.fillStyle = isDark ? '#777777' : '#888888';
      ctx.font = '700 20px -apple-system, sans-serif';
      ctx.fillText('‧  公  共  話  題  存  檔  備  份  ‧', 540, 240);

      // 5. 話題標籤 (平整無發光膠囊樣式)
      const topicText = post.topic;
      ctx.font = '900 40px -apple-system, sans-serif';
      const textWidth = ctx.measureText(topicText).width;
      const paddingX = 35;
      const paddingY = 18;
      
      ctx.fillStyle = isDark ? '#121212' : '#f5f5f5';
      ctx.strokeStyle = isDark ? '#262626' : '#e5e5e5';
      ctx.lineWidth = 1.5;
      
      const rectX = 540 - textWidth / 2 - paddingX;
      const rectY = 350;
      const rectW = textWidth + paddingX * 2;
      const rectH = 65 + paddingY;
      const radius = 8; // 像素級平直直角/微圓角
      
      ctx.beginPath();
      ctx.moveTo(rectX + radius, rectY);
      ctx.lineTo(rectX + rectW - radius, rectY);
      ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
      ctx.lineTo(rectX + rectW, rectY + rectH - radius);
      ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
      ctx.lineTo(rectX + radius, rectY + rectH);
      ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
      ctx.lineTo(rectX, rectY + radius);
      ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDark ? '#f3f5f7' : '#111111';
      ctx.fillText(topicText, 540, 410);

      // 6. 內文自動折行繪製
      ctx.fillStyle = isDark ? '#f3f5f7' : '#222222';
      ctx.font = '500 38px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      
      const contentX = 140;
      const contentMaxWidth = 800;
      const contentLineHeight = 58;
      let currentY = 560;

      const paragraphs = post.content.split('\n');

      const wrapText = (text: string, x: number, startY: number, maxWidth: number, lineHeight: number) => {
        const chars = text.split('');
        let line = '';
        let y = startY;

        for (let i = 0; i < chars.length; i++) {
          const testLine = line + chars[i];
          const testWidth = ctx.measureText(testLine).width;
          
          if (testWidth > maxWidth && i > 0) {
            ctx.fillText(line, x, y);
            line = chars[i];
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, x, y);
        return y;
      };

      for (const para of paragraphs) {
        if (para.trim() === '') {
          currentY += contentLineHeight * 0.5;
        } else {
          currentY = wrapText(para, contentX, currentY, contentMaxWidth, contentLineHeight) + contentLineHeight;
        }
        if (currentY > 1150) break;
      }

      // 7. 投票比例 (極簡灰調)
      const voteY = 1260;
      
      // 挺他 (白 / 黑)
      ctx.fillStyle = isDark ? '#ffffff' : '#000000';
      ctx.font = '900 96px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${upPercent}%`, 280, voteY);
      ctx.font = '700 24px -apple-system, sans-serif';
      ctx.fillStyle = isDark ? '#777777' : '#888888';
      ctx.fillText('挺他', 280, voteY + 45);

      // VS
      ctx.fillStyle = isDark ? '#262626' : '#e5e5e5';
      ctx.font = '900 36px -apple-system, sans-serif';
      ctx.fillText('/', 540, voteY - 15);

      // 瞎爆 (灰)
      ctx.fillStyle = isDark ? '#aaaaaa' : '#555555';
      ctx.font = '900 96px -apple-system, sans-serif';
      ctx.fillText(`${downPercent}%`, 800, voteY);
      ctx.font = '700 24px -apple-system, sans-serif';
      ctx.fillStyle = isDark ? '#777777' : '#888888';
      ctx.fillText('瞎爆', 800, voteY + 45);

      // 8. 簡約實心投票條
      const barX = 140;
      const barY = 1380;
      const barW = 800;
      const barH = 12;
      
      // 背景底條 (深灰 / 淺灰)
      ctx.fillStyle = isDark ? '#262626' : '#e5e5e5';
      ctx.fillRect(barX, barY, barW, barH);

      // 挺他 (白 / 黑)
      const upW = Math.max(10, Math.round((upPercent / 100) * barW));
      ctx.fillStyle = isDark ? '#ffffff' : '#000000';
      ctx.fillRect(barX, barY, upW, barH);

      // 9. 底部 QR Code
      const qrSize = 160;
      const qrX = 540 - qrSize / 2;
      const qrY = 1490;
      
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      
      const shareUrl = getShareUrl();
      const qrColor = isDark ? 'ffffff' : '000000';
      const qrBg = isDark ? '000000' : 'ffffff';
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(shareUrl)}&color=${qrColor}&bgcolor=${qrBg}`;

      await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
          qrImg.onload = null;
          qrImg.onerror = null;
          drawFallback();
          resolve();
        }, 3000);

        const drawFallback = () => {
          ctx.fillStyle = isDark ? '#121212' : '#f5f5f5';
          ctx.fillRect(qrX, qrY, qrSize, qrSize);
          ctx.fillStyle = isDark ? '#777777' : '#888888';
          ctx.font = '700 18px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('搜尋 OPPER 參與本話題審判', 540, qrY + qrSize + 40);
        };

        qrImg.onload = () => {
          clearTimeout(timeoutId);
          try {
            ctx.fillStyle = isDark ? '#121212' : '#f5f5f5';
            ctx.strokeStyle = isDark ? '#262626' : '#e5e5e5';
            ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
            ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            ctx.fillStyle = isDark ? '#777777' : '#888888';
            ctx.font = '700 18px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('掃描參與本話題投票 ‧ OPPER.SOCIAL', 540, qrY + qrSize + 40);
          } catch (e) {
            console.error('QR draw error', e);
            drawFallback();
          }
          resolve();
        };
        qrImg.onerror = () => {
          clearTimeout(timeoutId);
          drawFallback();
          resolve();
        };
      });

      // 10. 下載
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Opper_Record_${post.topic.replace('#', '')}.png`;
      link.href = dataUrl;
      link.click();

      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <canvas ref={canvasRef} className="absolute pointer-events-none opacity-0 left-[-9999px]" />

      <div 
        id="story-generator-modal"
        className="w-full max-w-sm rounded-xl bg-[#121212] border border-[#262626] p-5 text-center shadow-2xl animate-scale-in flex flex-col max-h-[95vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#262626] flex-shrink-0">
          <span className="text-xs font-bold text-white">話題分享存檔預覽</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* 9:16 極簡風預覽區域 (模擬 IG Story 卡片樣式) */}
        <div className="flex-1 overflow-y-auto pr-1 mb-3.5 flex justify-center items-center scrollbar-thin">
          <div 
            id="story-preview-card"
            className={`relative w-full aspect-[9/16] rounded-lg p-6 flex flex-col justify-between overflow-hidden shadow-inner max-h-[50vh] transition-all duration-200 border ${
              cardTheme === 'dark'
                ? 'bg-black border-[#262626]'
                : 'bg-white border-neutral-200'
            }`}
          >
            {/* 頂部 */}
            <div className="flex flex-col items-center">
              <span className={`text-[12px] font-black tracking-widest transition-colors ${
                cardTheme === 'dark' ? 'text-white' : 'text-black'
              }`}>
                OPPER
              </span>
              <span className={`text-[6px] font-bold tracking-wider mt-0.5 transition-colors ${
                cardTheme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'
              }`}>
                ‧ 話 題 公 共 存 檔 ‧
              </span>
            </div>

            {/* 中間 */}
            <div className="my-auto space-y-3 text-left py-2">
              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${
                cardTheme === 'dark'
                  ? 'text-neutral-300 bg-neutral-900 border-[#262626]'
                  : 'text-neutral-700 bg-neutral-50 border-neutral-200'
              }`}>
                {post.topic}
              </span>
              <p className={`text-[10px] leading-relaxed font-medium line-clamp-[7] break-words whitespace-pre-wrap select-none transition-colors ${
                cardTheme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
              }`}>
                {post.content}
              </p>
            </div>

            {/* 底部 */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between items-end">
                  <div className="text-left">
                    <span className={`text-[14px] font-black transition-colors ${
                      cardTheme === 'dark' ? 'text-white' : 'text-black'
                    }`}>
                      {upPercent}%
                    </span>
                    <span className="text-[6px] text-neutral-500 block">挺他</span>
                  </div>
                  <span className="text-[7px] font-bold text-neutral-600">/</span>
                  <div className="text-right">
                    <span className={`text-[14px] font-black transition-colors ${
                      cardTheme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                    }`}>
                      {downPercent}%
                    </span>
                    <span className="text-[6px] text-neutral-500 block">瞎爆</span>
                  </div>
                </div>

                {/* 比例條 */}
                <div className={`h-1 w-full rounded-full flex overflow-hidden transition-colors ${
                  cardTheme === 'dark' ? 'bg-[#262626]' : 'bg-neutral-200'
                }`}>
                  <div className={cardTheme === 'dark' ? 'bg-white' : 'bg-black'} style={{ width: `${upPercent}%` }} />
                  <div className={cardTheme === 'dark' ? 'bg-neutral-600' : 'bg-neutral-450'} style={{ width: `${downPercent}%` }} />
                </div>
              </div>

              {/* 二維碼 */}
              <div className="flex flex-col items-center gap-1">
                <div className={`h-9 w-9 rounded p-1 flex items-center justify-center transition-colors ${
                  cardTheme === 'dark'
                    ? 'bg-neutral-950 border border-[#262626]'
                    : 'bg-neutral-50 border border-neutral-200'
                }`}>
                  <div className={`h-full w-full border border-dashed rounded flex flex-wrap p-0.5 justify-between ${
                    cardTheme === 'dark' ? 'border-neutral-700' : 'border-neutral-300'
                  }`}>
                    <div className={`h-1.5 w-1.5 ${cardTheme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                    <div className={`h-1.5 w-1.5 ${cardTheme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                    <div className={`h-1.5 w-1.5 ${cardTheme === 'dark' ? 'bg-white' : 'bg-black'}`} />
                    <div className={`h-1 w-1 self-end ${
                      cardTheme === 'dark' ? 'bg-neutral-600' : 'bg-neutral-400'
                    }`} />
                  </div>
                </div>
                <span className="text-[5px] text-neutral-500 font-bold tracking-wider">掃描參與話題投票</span>
              </div>
            </div>

          </div>
        </div>

        {/* 風格選擇分區 */}
        <div className="flex items-center justify-between bg-black p-2 rounded-lg border border-[#262626] mb-3 flex-shrink-0">
          <span className="text-[10px] font-bold text-neutral-400 pl-1.5">戰報圖卡風格</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setCardTheme('dark')}
              className={`rounded px-3 py-1 text-[9px] font-bold border transition-all cursor-pointer ${
                cardTheme === 'dark'
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 text-neutral-400 border-[#262626] hover:text-white'
              }`}
            >
              深邃暗黑
            </button>
            <button
              type="button"
              onClick={() => setCardTheme('light')}
              className={`rounded px-3 py-1 text-[9px] font-bold border transition-all cursor-pointer ${
                cardTheme === 'light'
                  ? 'bg-white text-black border-white'
                  : 'bg-neutral-900 text-neutral-400 border-[#262626] hover:text-white'
              }`}
            >
              極極曜白
            </button>
          </div>
        </div>

        {/* 下載 */}
        <div className="space-y-3 flex-shrink-0">
          <p className="text-[9px] text-neutral-500 leading-relaxed text-left bg-black p-2.5 rounded-lg border border-[#262626]">
            點擊下方按鈕可下載 1080x1920 高清純黑/冷白極簡存檔 PNG，發布至 IG/脆限時動態，吸引他人掃描 QR Code 參與真實對決投票。
          </p>
          
          <button
            id="btn-download-story"
            onClick={handleDownload}
            disabled={isGenerating}
            className={`w-full rounded-lg py-2.5 text-xs font-bold transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 shadow ${
              isDownloaded
                ? 'bg-neutral-800 text-white border border-neutral-750'
                : 'bg-white text-black hover:bg-neutral-200'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>正在生成高清圖卡...</span>
              </>
            ) : isDownloaded ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>已下載！可分享至限動</span>
              </>
            ) : (
              <>
                <span>下載高清分享圖卡 PNG</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
