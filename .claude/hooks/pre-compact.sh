#!/bin/bash
# PreCompact Hook — 上下文压缩前把关键状态写入磁盘
# 压缩后这些状态会丢失，必须在此刻保存

CHECKPOINT="D:/Python/Atoms笔试/Atoms demo/.claude/checkpoint.md"
PROGRESS="D:/Python/Atoms笔试/Atoms demo/PROGRESS.md"

cat > "$CHECKPOINT" << 'CHECKPOINT_EOF'
# 上下文压缩检盘点

> 自动生成于压缩前。压缩后立即读取此文件恢复状态。

## 当前进度
CHECKPOINT_EOF

# 提取 PROGRESS.md 中"当前任务"那一节
if [ -f "$PROGRESS" ]; then
    awk '/^## 当前任务$/,/^## 已提交记录$/' "$PROGRESS" | head -20 >> "$CHECKPOINT"
fi

# 最近 5 条提交
echo "" >> "$CHECKPOINT"
echo "## 最近提交" >> "$CHECKPOINT"
git -C "D:/Python/Atoms笔试/Atoms demo" log --oneline -5 2>/dev/null >> "$CHECKPOINT"

# 未提交的变更
echo "" >> "$CHECKPOINT"
echo "## 未保存变更" >> "$CHECKPOINT"
if [ -n "$(git -C "D:/Python/Atoms笔试/Atoms demo" status --porcelain 2>/dev/null)" ]; then
    git -C "D:/Python/Atoms笔试/Atoms demo" status --short 2>/dev/null >> "$CHECKPOINT"
else
    echo "（无）" >> "$CHECKPOINT"
fi

echo "pre-compact: 检盘点已写入 $CHECKPOINT"
