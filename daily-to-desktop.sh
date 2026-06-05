#!/bin/bash
# 生成日报并复制到桌面
cd "$(dirname "$0")"

# 运行日报生成
npx tsx scripts/daily.ts

# 复制最新报告到桌面
TODAY=$(date +%Y-%m-%d)
SRC="daily_reports/${TODAY}/${TODAY}.html"
DEST="$HOME/Desktop/DailyBrief-${TODAY}.html"

if [ -f "$SRC" ]; then
  cp "$SRC" "$DEST"
  echo "已复制到桌面: $DEST"
  open "$DEST"
else
  echo "未找到今日报告: $SRC"
fi
