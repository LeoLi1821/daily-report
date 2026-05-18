import Parser from "rss-parser";
import type { RawArticle } from "./types";

/**
 * V2EX 的 /api/topics/hot.json 是全站热议，里面充斥生活/感情/吃喝板块。
 * 我们改抓 V2EX 每个**技术节点**的 Atom feed 并合并去重，把内容收敛到
 * 编程语言、平台、运维等真正的技术讨论。
 *
 * "share"（分享创造）节点之前包含在内，但实测会混入大量个人生活帖；
 * "apple" 节点保留是因为 macOS 开发场景刚需，但靠下面的标题黑名单兜底。
 */
const TECH_NODES = [
  "programmer", // 程序员（最活跃的综合技术节点）
  "dev", // 开发
  "python",
  "golang",
  "linux",
  "apple", // macOS 开发
];

/**
 * 即使来自技术节点（V2EX）或综合论坛（LinuxDo），部分帖子标题也明显
 * 是生活/感情/广告/职场吐槽类。这个正则是兜底层 — 命中即丢弃。
 * 规则保持窄而准，宁可漏过几个也不要误伤。
 *
 * 同时被 lib/sources/linuxdo.ts 和 lib/output/render.ts 引用：
 * - linuxdo: fetch 时直接过滤（next daily run 生效）
 * - render: 兜底过滤旧 sidecar 中已写入的非技术帖（立即生效）
 *
 * 命名保留 V2EX_ 前缀仅出于历史原因 — 实际是中文社区通用过滤规则。
 */
export const V2EX_OFF_TOPIC_RE =
  /(足浴|按摩|捏\s*jio|相亲|对象|男友|女友|分手|婆|岳|家暴|出轨|彩礼|9\.9\s*元|抽奖|薅羊毛|代理\s*IP|住宅\s*IP|跨境\s*(卖家|IP|电商)|辣椒\s*HTTP|买房|买车|装修|房贷|养老|退休|结婚|生娃|带娃|养娃|减肥|健身|租房|搬家|签证|移民|岛主|离职|裸辞|老赖|存款|新人报道|无聊|发小|废了|工资|加班吐槽|找工作|失业|找对象)/i;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; DailyBriefBot/1.0)",
  Accept: "application/atom+xml, application/xml, text/xml",
} as const;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function fetchV2ex(
  sourceId: string,
  limit = 25,
): Promise<RawArticle[]> {
  const parser = new Parser({ timeout: 15000, headers: HEADERS });

  const feeds = await Promise.all(
    TECH_NODES.map(async (node) => {
      try {
        const feed = await parser.parseURL(
          `https://www.v2ex.com/feed/${node}.xml`,
        );
        return feed.items ?? [];
      } catch {
        return [];
      }
    }),
  );

  const seen = new Set<string>();
  const items: RawArticle[] = [];
  for (const list of feeds) {
    for (const item of list) {
      const url = (item.link ?? "").trim();
      if (!url || seen.has(url)) continue;
      const title = (item.title ?? "").trim();
      if (V2EX_OFF_TOPIC_RE.test(title)) continue;
      seen.add(url);
      items.push({
        sourceId,
        title,
        url,
        excerpt: stripHtml(item.contentSnippet ?? item.content ?? "").slice(
          0,
          300,
        ),
        publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
        category: "tech",
      });
    }
  }

  items.sort(
    (a, b) =>
      (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
  return items.slice(0, limit);
}
