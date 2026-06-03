import re

STEAM_GAMES = {
  'Apex 英雄 Apex Legends': 1172470,
  '鬥陣特攻 Overwatch 2': 2356940,
  '暗黑破壞神 Diablo IV': 2344520,
  '決勝時刻 Call of Duty': 1938090,
  '魔物獵人 Monster Hunter': 582010,
  'Final Fantasy XIV': 39210,
  'Terraria 泰拉瑞亞': 105600,
  '星露谷物語 Stardew Valley': 413150,
  '黎明死線 Dead by Daylight': 381210,
  '虹彩六號 Rainbow Six': 359550,
  '天命2 Destiny 2': 1085660,
  'Warframe 戰甲神兵': 230410,
  '流亡黯道 Path of Exile': 238960,
  '快打旋風 Street Fighter': 1364780,
  '鐵拳 Tekken': 1778820,
  '柏德之門 Baldur\'s Gate': 1086940,
  '絕地戰兵 Helldivers': 2054970,
  '幻獸帕魯 Palworld': 1623730,
  '霧鎖王國 Enshrouded': 1203620,
  '方舟 ARK': 346110,
  'Rust 腐蝕': 252490,
  '碧藍幻想 Granblue Fantasy': 1228500,
  '絕地求生 PUBG': 578080,
  '絕對武力 CS2': 730,
  '巫師 The Witcher': 292030,
  '電馭叛客 Cyberpunk 2077': 1091500,
  '碧血狂殺 Red Dead Redemption': 1174180
}

CUSTOM_IMAGES = {
  'Minecraft 麥塊': 'https://www.minecraft.net/etc.clientlibs/minecraft/clientlibs/main/resources/img/minecraft-creeper-face.png',
  '英雄聯盟 League of Legends': 'https://brand.riotgames.com/static/a91000434ed683358004b85c95d43ce0/8a20a/lol-logo.png',
  '特戰英豪 VALORANT': 'https://brand.riotgames.com/static/a81f087265a9ea8eb29e3aab1553c613/8a20a/valorant-logo.png',
  '聯盟戰棋 TFT': 'https://brand.riotgames.com/static/b1bcbb07a4efce6cb388e2528751dc33/8a20a/tft-logo.png',
  '原神 Genshin Impact': 'https://upload-os-bbs.hoyolab.com/upload/2021/08/17/2330760/4c376184a4a589cf8b1a8d1326c51888_3807537380126749035.png',
  '崩壞：星穹鐵道': 'https://upload-os-bbs.hoyolab.com/upload/2023/03/24/11559828/7054a169b56f8f55331f414f52631525_361245781447029519.png',
  '絕區零 Zenless Zone Zero': 'https://upload-os-bbs.hoyolab.com/upload/2022/05/13/11559828/f49b1e7c53d16b110fa9560dc400490b_1880451457190367201.png',
  '斯普拉遁 Splatoon 3': 'https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_1.0/c_scale,w_400/ncom/software/switch/70010000046396/desc/15f10b7ba43343fc163ce4a8fcce4d3f0099411dc828972b9044ebffda1a0808',
  '任天堂明星大亂鬥': 'https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_1.0/c_scale,w_400/ncom/software/switch/70010000012332/desc/5b7365fdd222f7fb7eef7cfd21c97a8ec210ed3ee42a5a0f58cd2e71d3dcc809',
  '薩爾達傳說 曠野/王國': 'https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_1.0/c_scale,w_400/ncom/software/switch/70010000063714/desc/e7d70bf0f785474f8c9285dc36b4461bb3c3c7e7b68ed6f784d16d1a93822180',
  '魔獸世界 World of Warcraft': 'https://blz-contentstack-images.akamaized.net/v3/assets/blt9c12f249ac15c7ec/bltc2fd1e60f089e9d6/62b6183362fc4856fdbba18f/logo.png',
  '逃離塔科夫 Escape from Tarkov': 'https://www.escapefromtarkov.com/themes/eft/images/main_logo.png',
  '鳴潮 Wuthering Waves': 'https://wutheringwaves.kurogames.com/images/logo.png',
}

with open('src/lib/official_communities.ts', 'r', encoding='utf-8') as f:
    content = f.read()

for name, app_id in STEAM_GAMES.items():
    pattern = rf"(name: '{name}',.*?logo_url: ')(.*?)(')"
    replacement = rf"\g<1>https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/header.jpg\g<3>"
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

for name, url in CUSTOM_IMAGES.items():
    pattern = rf"(name: '{name}',.*?logo_url: ')(.*?)(')"
    replacement = rf"\g<1>{url}\g<3>"
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/lib/official_communities.ts', 'w', encoding='utf-8') as f:
    f.write(content)
