#!/bin/bash
# DailyBrief -> 飞书群机器人推送（自动拆分长消息）
# 用法: bash push-wechat.sh <日期 YYYY-MM-DD>

set -e

cd "$(dirname "$0")"

# ========== 配置区 ==========
FEISHU_WEBHOOK="${FEISHU_WEBHOOK:-https://open.feishu.cn/open-apis/bot/v2/hook/13897b87-b4fc-4b00-b76c-6aa03d848488}"
FEISHU_MAX_CHARS=3500  # 飞书单条消息上限约4096，留余量
# ============================

TODAY="${1:-$(TZ=Asia/Shanghai date +%Y-%m-%d)}"
JSON_FILE="daily_reports/${TODAY}/${TODAY}.json"

if [ ! -f "$JSON_FILE" ]; then
  echo "[push] 错误: 未找到报告数据 $JSON_FILE"
  exit 1
fi

echo "[push] 正在准备推送内容..."

# 生成所有消息段（JSON 数组，每个元素是一条飞书消息的 content 数组）
MESSAGES=$(node -e "
const data = require('./${JSON_FILE}');
const today = '${TODAY}';
const MAX_CHARS = ${FEISHU_MAX_CHARS};

// 收集所有内容行
const allLines = [];

// 头条
if (data.hero_headline) {
  allLines.push([{ tag: 'text', text: '📌 ' + data.hero_headline.trim() }]);
}
if (data.daily_overview) {
  allLines.push([{ tag: 'text', text: data.daily_overview.replace(/\n/g, ' ') }]);
}
allLines.push([{ tag: 'text', text: '' }]);

// 科技
if (data.tech_briefs && data.tech_briefs.length > 0) {
  allLines.push([{ tag: 'text', text: '🤖 科技动态' }]);
  data.tech_briefs.slice(0, 3).forEach((item, i) => {
    const title = item.title || '';
    const summary = (item.summary || '').replace(/\n/g, ' ');
    allLines.push([{ tag: 'text', text: (i+1) + '. ' + title + '：' + summary }]);
  });
  allLines.push([{ tag: 'text', text: '' }]);
}

// 财经
if (data.finance_briefs && data.finance_briefs.length > 0) {
  allLines.push([{ tag: 'text', text: '💰 财经要闻' }]);
  data.finance_briefs.slice(0, 3).forEach((item, i) => {
    const title = item.title || '';
    const summary = (item.summary || '').replace(/\n/g, ' ');
    allLines.push([{ tag: 'text', text: (i+1) + '. ' + title + '：' + summary }]);
  });
  allLines.push([{ tag: 'text', text: '' }]);
}

// 行情
if (data.trading && data.trading.market_overview) {
  allLines.push([{ tag: 'text', text: '📊 行情概览' }]);
  allLines.push([{ tag: 'text', text: data.trading.market_overview.replace(/\n/g, ' ') }]);
  allLines.push([{ tag: 'text', text: '' }]);
}

// 关键词
if (data.keywords && data.keywords.length > 0) {
  allLines.push([{ tag: 'text', text: '🏷 ' + data.keywords.join(' · ') }]);
  allLines.push([{ tag: 'text', text: '' }]);
}

// 底部
allLines.push([{ tag: 'text', text: '——————' }]);
allLines.push([{ tag: 'text', text: '✅ 完整报告已保存至桌面「daily brief」文件夹' }]);

// 计算总字符数
function contentChars(lines) {
  return lines.reduce((sum, line) => sum + line.reduce((s, el) => s + (el.text || '').length, 0), 0);
}

// 拆分消息
const messages = [];
let current = [];
let currentLen = 0;

for (const line of allLines) {
  const lineLen = line.reduce((s, el) => s + (el.text || '').length, 0);
  if (currentLen + lineLen > MAX_CHARS && current.length > 0) {
    messages.push(current);
    current = [];
    currentLen = 0;
  }
  current.push(line);
  currentLen += lineLen;
}
if (current.length > 0) messages.push(current);

// 如果只有一条消息，把标题放进去；多条则第一条带标题，后续不带
const result = messages.map((content, idx) => ({
  msg_type: 'post',
  content: {
    post: {
      zh_cn: {
        title: idx === 0 ? '📰 每日简报 - ' + today : '📰 每日简报（续）',
        content: content
      }
    }
  }
}));

console.log(JSON.stringify(result));
" 2>&1)

if [ $? -ne 0 ]; then
  echo "[push] 生成消息失败: $MESSAGES"
  exit 1
fi

# 统计消息条数
COUNT=$(echo "$MESSAGES" | jq 'length')
echo "[push] 拆分为 ${COUNT} 条消息发送..."

# 逐条发送
for i in $(seq 0 $((COUNT - 1))); do
  PAYLOAD=$(echo "$MESSAGES" | jq ".[$i]")
  
  RESP=$(curl -s -X POST "$FEISHU_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  CODE=$(echo "$RESP" | jq -r '.code // 1')
  if [ "$CODE" = "0" ]; then
    echo "[push] 第 $((i+1))/${COUNT} 条发送成功"
  else
    echo "[push] 第 $((i+1))/${COUNT} 条发送失败: $RESP"
  fi

  # 多条之间间隔 0.5 秒，避免频率限制
  if [ "$i" -lt $((COUNT - 1)) ]; then
    sleep 0.5
  fi
done

echo "[push] 推送完成"
