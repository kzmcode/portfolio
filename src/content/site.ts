// 差し替え前提の文言・リンクはすべてここに集約する（角括弧はプレースホルダー）
export const site = {
  lang: 'ja',
  title: 'kzm\'s portfolio',
  // 検索結果・SNS 共有に出るトップのタイトルと説明文（フッターは title のまま）
  seoTitle: 'kzm — Developer / Educator | Portfolio',
  description: 'kzm（Developer / Educator）のポートフォリオ。AI・ソフトウェア・ハードウェアを横断し、Web アプリ・モバイルアプリ・デスクトップアプリをつくっています。From Insight to Reality.',
  name: 'kzm',
  logo: 'kzm.',
  year: '2026',
  email: 'kzm.suzuki@gmail.com',
  sns: [
    { label: 'X', icon: 'x', href: 'https://x.com/SuzukiKzm' },
    { label: 'GitHub', icon: 'github', href: 'https://github.com/kzmcode/' },
    { label: 'Zenn', icon: 'zenn', href: 'https://zenn.dev/szkkzm' },
  ],
  privacyHref: '/privacy',
  about: {
    name: 'kzm.',
    role: 'Developer / Educator',
    concept: ' ― From Insight to Reality',
    messageEn: 'I turn ideas into thoughtfully designed, functional products. Combining AI, software, and hardware, I bridge engineering and design to bring concepts to life.',
    messageJa: 'アイデアを、使いやすく価値あるプロダクトへ。AI・ソフトウェア・ハードウェアを横断し、技術とデザインの両面から構想を形にしています。',
    portrait: '/images/portrait.webp',
    portraitAlt: 'kzm のイラスト（メガネにパーカー姿の似顔絵）',
  },
  contact: {
    lead: 'Questions, ideas, or just hello —',
    note: 'お仕事のご相談はもちろん、作品の感想や質問、ちょっとした雑談も大歓迎です。なんでもお気軽にどうぞ。',
  },
} as const;
