import type { SourceDef } from "./types";

/**
 * 数据源中心配置。
 *
 * 增加源：在数组里追加一项即可。
 * - 普通 RSS / Atom 源直接走 lib/sources/rss.ts；如果该源被 Cloudflare
 *   或同类反爬 TLS-fingerprint 拦了 Node 的 undici（症状：Just a moment…），
 *   加上 `useCurl: true` 让 fetcher 走 curl 子进程。
 * - 特殊源（HN / V2EX / GitHub Trending / LinuxDo）在
 *   lib/sources/dispatch.ts 里加分支。
 *
 * `enabled: false` 的源会被跳过。
 *
 * subcategory 在 tech / finance 下决定 L2 分组：
 *   tech    → github-trending / ai-news / x-viral    （cn-community 升级到 L1）
 *   finance → news
 *   politics 当前不分二级（subcategory 不设）
 *
 * cn-community 在 registry 里仍挂在 category=tech 下，但渲染时被
 * 拆到独立 L1 panel "community" 显示（lib/output/render.ts）。
 *
 * 2026-05-15 复核可达性：见各源注释。
 */
export const sources: SourceDef[] = [
  // ============================================================
  // 技术动态 — 二级：GitHub Trending
  // ============================================================
  {
    id: "github-trending",
    name: "GitHub Trending",
    type: "scrape",
    url: "https://github.com/trending",
    category: "tech",
    subcategory: "github-trending",
    enabled: true,
  },

  // ============================================================
  // 技术动态 — 二级：中文社区（V2EX / LinuxDo）
  // ============================================================
  {
    id: "v2ex-hot",
    name: "V2EX",
    type: "api",
    url: "https://www.v2ex.com/feed/programmer.xml", // 实际抓 7 个技术节点 atom 合并
    category: "tech",
    subcategory: "cn-community",
    enabled: true,
  },
  {
    id: "linuxdo",
    name: "LinuxDo",
    type: "api",
    url: "https://linux.do/top.json?period=daily",
    category: "tech",
    subcategory: "cn-community",
    enabled: false, // 暂停 — 当前 IP 被 Cloudflare 持续 challenge，等几天再试
  },
  {
    id: "juejin",
    name: "掘金",
    type: "rss",
    url: "https://juejin.cn/rss",
    category: "tech",
    subcategory: "cn-community",
    enabled: false, // 内容质量与 V2EX/LinuxDo 重合度低，剔除以提升信噪比
  },

  // ============================================================
  // 技术动态 — 二级：海外社区（已禁用 — 用户偏好换成 AI 资讯）
  // ============================================================
  {
    id: "hackernews",
    name: "Hacker News",
    type: "api",
    url: "https://hacker-news.firebaseio.com/v0",
    category: "tech",
    subcategory: "overseas-community",
    enabled: false,
  },
  {
    id: "lobsters",
    name: "Lobsters",
    type: "rss",
    url: "https://lobste.rs/rss",
    category: "tech",
    subcategory: "overseas-community",
    enabled: false,
  },

  // ============================================================
  // 技术动态 — 二级：AI 资讯（全英文，统一加中文摘要）
  // ============================================================
  {
    id: "qbitai",
    name: "量子位",
    type: "rss",
    url: "https://www.qbitai.com/feed",
    category: "tech",
    subcategory: "ai-news",
    lang: "zh",
    enabled: false, // 单一中文源在英文 timeline 里太抢位
  },
  {
    id: "openai-news",
    name: "OpenAI News",
    type: "rss",
    url: "https://openai.com/news/rss.xml",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },
  {
    id: "deepmind-blog",
    name: "DeepMind Blog",
    type: "rss",
    url: "https://deepmind.google/blog/rss.xml",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },
  {
    id: "huggingface-blog",
    name: "Hugging Face Blog",
    type: "rss",
    url: "https://huggingface.co/blog/feed.xml",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },
  {
    id: "tldr-ai",
    name: "TLDR AI",
    type: "rss",
    url: "https://tldr.tech/api/rss/ai",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },
  {
    id: "smol-ai-news",
    name: "Smol AI News",
    type: "rss",
    url: "https://news.smol.ai/rss.xml",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },
  {
    id: "latent-space",
    name: "Latent Space",
    type: "rss",
    url: "https://www.latent.space/feed",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },
  {
    id: "mit-tech-review-ai",
    name: "MIT Tech Review AI",
    type: "rss",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    category: "tech",
    subcategory: "ai-news",
    enabled: true,
  },

  // ============================================================
  // 技术动态 — 二级：X 推文（AI 类 viral 推文，按热度排序）
  // 数据来自 attentionvc.ai 公开 REST API。
  // ============================================================
  {
    id: "attentionvc-ai",
    name: "X 推文 (AttentionVC)",
    type: "api",
    url: "https://reply-vc-90459984647.us-central1.run.app/v1/articles/leaderboard?window=7d&category=ai&lang=en",
    category: "tech",
    subcategory: "x-viral",
    enabled: true,
  },

  // ============================================================
  // 技术动态 — 二级：海外科技（已禁用 — 用户偏好仅看社区讨论）
  // ============================================================
  {
    id: "solidot",
    name: "Solidot 奇客",
    type: "rss",
    url: "https://www.solidot.org/index.rss",
    category: "tech",
    subcategory: "overseas-news",
    enabled: false,
  },
  {
    id: "ars-technica",
    name: "Ars Technica",
    type: "rss",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "tech",
    subcategory: "overseas-news",
    enabled: false,
  },

  // ============================================================
  // 技术动态 — 二级：博客周刊（已全部禁用 — 用户偏好聚焦 AI 资讯）
  // ============================================================
  {
    id: "ruanyf-blog",
    name: "阮一峰的网络日志",
    type: "rss",
    url: "https://www.ruanyifeng.com/blog/atom.xml",
    category: "tech",
    subcategory: "blog-weekly",
    enabled: false,
  },
  {
    id: "hellogithub",
    name: "HelloGitHub 月刊",
    type: "rss",
    url: "https://hellogithub.com/rss/all",
    category: "tech",
    subcategory: "blog-weekly",
    enabled: false,
  },
  {
    id: "martinfowler",
    name: "Martin Fowler",
    type: "rss",
    url: "https://martinfowler.com/feed.atom",
    category: "tech",
    subcategory: "blog-weekly",
    enabled: false,
  },
  {
    id: "simonwillison",
    name: "Simon Willison",
    type: "rss",
    url: "https://simonwillison.net/atom/everything/",
    category: "tech",
    subcategory: "blog-weekly",
    enabled: false,
  },
  {
    id: "cloudflare-blog",
    name: "Cloudflare Blog",
    type: "rss",
    url: "https://blog.cloudflare.com/rss/",
    category: "tech",
    subcategory: "blog-weekly",
    enabled: false,
  },
  {
    id: "github-engineering",
    name: "GitHub Engineering",
    type: "rss",
    url: "https://github.blog/engineering/feed/",
    category: "tech",
    subcategory: "blog-weekly",
    enabled: false,
  },

  // ============================================================
  // 技术动态 — 备用池
  // ============================================================
  {
    id: "techcrunch",
    name: "TechCrunch",
    type: "rss",
    url: "https://techcrunch.com/feed/",
    category: "tech",
    subcategory: "overseas",
    enabled: false,
  },
  {
    id: "theverge",
    name: "The Verge",
    type: "rss",
    url: "https://www.theverge.com/rss/index.xml",
    category: "tech",
    subcategory: "overseas",
    enabled: false,
  },
  {
    id: "bbc-tech",
    name: "BBC Technology",
    type: "rss",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    category: "tech",
    subcategory: "overseas",
    enabled: false,
  },

  // ============================================================
  // 财经 — 二级：财经新闻
  // ============================================================
  {
    id: "bloomberg-markets",
    name: "Bloomberg Markets",
    type: "rss",
    url: "https://feeds.bloomberg.com/markets/news.rss",
    category: "finance",
    subcategory: "news",
    enabled: true,
  },
  {
    id: "wsj-markets",
    name: "WSJ Markets",
    type: "rss",
    url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    category: "finance",
    subcategory: "news",
    enabled: true,
  },
  {
    id: "cnbc-topnews",
    name: "CNBC",
    type: "rss",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    category: "finance",
    subcategory: "news",
    enabled: false, // 编辑深度低于 BBG/WSJ/FT，剔除以提升信噪比
  },
  {
    id: "ft-companies",
    name: "Financial Times",
    type: "rss",
    url: "https://www.ft.com/companies?format=rss",
    category: "finance",
    subcategory: "news",
    enabled: true,
  },
  {
    id: "ftchinese-news",
    name: "FT中文网",
    type: "rss",
    url: "https://www.ftchinese.com/rss/news",
    category: "finance",
    subcategory: "news",
    enabled: false, // 走全英文顶级方案；需要中文视角时再开
  },
  {
    id: "yahoo-finance",
    name: "Yahoo Finance",
    type: "rss",
    url: "https://finance.yahoo.com/news/rssindex",
    category: "finance",
    subcategory: "news",
    enabled: false, // 聚合站，原创编辑薄
  },
  {
    id: "marketwatch-top",
    name: "MarketWatch",
    type: "rss",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    category: "finance",
    subcategory: "news",
    enabled: false, // Dow Jones 聚合，重要内容已在 WSJ 覆盖
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    type: "rss",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    category: "finance",
    subcategory: "news",
    enabled: true,
  },
  {
    id: "economist-finance",
    name: "The Economist Finance",
    type: "rss",
    url: "https://www.economist.com/finance-and-economics/rss.xml",
    category: "finance",
    subcategory: "news",
    enabled: true,
  },

  // ============================================================
  // 财经 — 二级：社区讨论（已全部禁用 — Reddit 信噪比过低）
  // ============================================================
  {
    id: "reddit-wallstreetbets",
    name: "r/wallstreetbets",
    type: "rss",
    url: "https://www.reddit.com/r/wallstreetbets/.rss",
    category: "finance",
    subcategory: "community",
    useCurl: true,
    enabled: false,
  },
  {
    id: "reddit-investing",
    name: "r/investing",
    type: "rss",
    url: "https://www.reddit.com/r/investing/.rss",
    category: "finance",
    subcategory: "community",
    useCurl: true,
    enabled: false,
  },
  {
    id: "reddit-stocks",
    name: "r/stocks",
    type: "rss",
    url: "https://www.reddit.com/r/stocks/.rss",
    category: "finance",
    subcategory: "community",
    useCurl: true,
    enabled: false,
  },
  {
    id: "reddit-chinastocks",
    name: "r/ChinaStocks",
    type: "rss",
    url: "https://www.reddit.com/r/ChinaStocks/.rss",
    category: "finance",
    subcategory: "community",
    useCurl: true,
    enabled: false,
  },

  // ============================================================
  // 财经 — 备用池
  // ============================================================
  {
    id: "people-finance",
    name: "人民网财经",
    type: "rss",
    url: "http://www.people.com.cn/rss/finance.xml",
    category: "finance",
    subcategory: "news",
    enabled: false, // feed 死，pubDate 锁 2025-06-05
  },
  {
    id: "wallstreetcn",
    name: "华尔街见闻",
    type: "rss",
    url: "https://rsshub.app/wallstreetcn/news/global",
    category: "finance",
    subcategory: "news",
    enabled: false, // 公共 RSSHub 限流
  },

  // ============================================================
  // 时政 — 合并为一个时间线（subcategory: world）
  // ============================================================
  {
    id: "bbc-world",
    name: "BBC World",
    type: "rss",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },
  {
    id: "guardian-world",
    name: "The Guardian",
    type: "rss",
    url: "https://www.theguardian.com/world/rss",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },
  {
    id: "nyt-world",
    name: "NYT World",
    type: "rss",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },
  {
    id: "npr-world",
    name: "NPR World",
    type: "rss",
    url: "https://feeds.npr.org/1004/rss.xml",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },
  {
    id: "dw-chinese",
    name: "DW 中文",
    type: "rss",
    url: "https://rss.dw.com/rdf/rss-chi-all",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    type: "rss",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },
  {
    id: "the-diplomat",
    name: "The Diplomat",
    type: "rss",
    url: "https://thediplomat.com/feed/",
    category: "politics",
    subcategory: "world",
    enabled: true,
  },

  // ============================================================
  // 时政 — 备用池
  // ============================================================
  {
    id: "peoples-daily",
    name: "人民网时政",
    type: "rss",
    url: "http://www.people.com.cn/rss/politics.xml",
    category: "politics",
    enabled: false,
  },
  {
    id: "people-world",
    name: "人民网国际",
    type: "rss",
    url: "http://www.people.com.cn/rss/world.xml",
    category: "politics",
    enabled: false,
  },
  {
    id: "xinhua-politics",
    name: "新华网时政",
    type: "rss",
    url: "http://www.xinhuanet.com/politics/news_politics.xml",
    category: "politics",
    enabled: false,
  },
  {
    id: "rfa-chinese",
    name: "RFA 中文",
    type: "rss",
    url: "https://www.rfa.org/mandarin/RSS",
    category: "politics",
    enabled: false,
  },
];
