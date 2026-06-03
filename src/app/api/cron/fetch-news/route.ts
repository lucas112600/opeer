import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { supabase } from '@/lib/supabase'; // assuming this exists or I'll fix path
import { ANONYMOUS_OWL } from '@/lib/db';

const parser = new Parser();

import { OFFICIAL_FEEDS } from '@/lib/official_communities';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    let results = [];

    for (const feed of OFFICIAL_FEEDS) {
      // 1. 確保官方社群存在
      let { data: community } = await supabase
        .from('communities')
        .select('id')
        .eq('name', feed.name)
        .single();

      if (!community) {
        const { data: newCommunity, error: createError } = await supabase
          .from('communities')
          .insert([{
            name: feed.name,
            description: feed.description,
            logo_url: feed.logo_url,
            category: feed.category,
            is_official: true,
          }])
          .select('id')
          .single();

        if (createError) {
          console.error(`創建社群 ${feed.name} 失敗:`, createError);
          continue;
        }
        community = newCommunity;
      }

      // 2. 解析 RSS
      const feedData = await parser.parseURL(feed.url);
      const latestItems = feedData.items.slice(0, 3); // 每次取最新 3 篇

      let addedCount = 0;

      for (const item of latestItems) {
        // 檢查是否已存在相同的標題 (避免重複發文)
        const { data: existingPost } = await supabase
          .from('posts')
          .select('id')
          .eq('community_id', community.id)
          .eq('topic', item.title || '官方情報')
          .single();

        if (!existingPost) {
          const content = `${item.contentSnippet || item.content || ''}\n\n閱讀全文: ${item.link}`;
          const postData = {
            author_id: null,
            is_anonymous: true,
            author_username: 'official_bot',
            author_name: feed.name + ' 機器人',
            author_avatar: feed.logo_url,
            topic: item.title?.substring(0, 50) || '官方情報',
            content: content,
            has_sensitive_content: false,
            community_id: community.id,
          };

          const { error: postError } = await supabase
            .from('posts')
            .insert([postData]);

          if (!postError) addedCount++;
        }
      }
      
      results.push({ name: feed.name, added: addedCount });
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('Fetch News Cron Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
