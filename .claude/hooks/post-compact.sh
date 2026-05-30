#!/bin/bash
# PostCompact Hook — 上下文压缩后立即恢复状态
# 这是防止"压缩后变傻"的关键防线

CHECKPOINT="D:/Python/Atoms笔试/Atoms demo/.claude/checkpoint.md"
PROGRESS="D:/Python/Atoms笔试/Atoms demo/PROGRESS.md"

echo "===== ⚠️ 上下文刚刚被压缩！恢复状态中... ====="
echo ""
echo "## 📍 你在做的事"
echo ""

# 1. 检盘点（压缩前保存的精确状态）
if [ -f "$CHECKPOINT" ]; then
    cat "$CHECKPOINT"
else
    echo "⚠️ 检盘点不存在，回退到 PROGRESS.md："
    head -50 "$PROGRESS" 2>/dev/null
fi

echo ""
echo "## 📋 必做动作清单"
echo "1. Read PROGRESS.md 确认当前任务号"
echo "2. Read 计划文件中当前 Task 的章节（只读那几行）"
echo "3. 检查 git status 确认有没有未提交变更"
echo "4. 继续执行，不要重新开始已完成的任务"
echo ""
echo "===== 恢复注入完毕 ====="
