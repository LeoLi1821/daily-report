#!/bin/bash
# DailyBrief 每日定时任务脚本
# 每天 08:00 运行，整合前日08:00到今日08:00的资讯

set -e
cd "$(dirname "$0")"

TODAY=$(TZ=Asia/Shanghai date +%Y-%m-%d)
LOG="logs/${TODAY}.log"
DESKTOP_DIR="$HOME/Desktop/daily brief"
mkdir -p logs "$DESKTOP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始生成日报..." | tee -a "$LOG"

# 1. 运行日报生成
npx tsx scripts/daily.ts 2>&1 | tee -a "$LOG"

# 2. 复制到桌面子目录
SRC="daily_reports/${TODAY}/${TODAY}.html"
DEST="${DESKTOP_DIR}/DailyBrief-${TODAY}.html"

if [ -f "$SRC" ]; then
  cp "$SRC" "$DEST"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已复制到: $DEST" | tee -a "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 错误: 未找到报告文件 $SRC" | tee -a "$LOG"
  exit 1
fi

# 3. 推送到飞书
if [ -f "push-wechat.sh" ]; then
  bash push-wechat.sh "$TODAY" 2>&1 | tee -a "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 跳过飞书推送: push-wechat.sh 未配置" | tee -a "$LOG"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 全部完成" | tee -a "$LOG"
