#!/bin/bash
# SessionStart Hook — 防止上下文丢失导致变傻
# 每次新会话/恢复会话时执行，注入当前进度状态

PLAN_FILE="D:/Python/Atoms笔试/PLAN/2026-05-30-atoms-demo.md"
PROGRESS_FILE="D:/Python/Atoms笔试/Atoms demo/PROGRESS.md"
REF_DOC="D:/Python/Atoms笔试/学习文档-参考项目分析.md"

echo "===== 防变傻注入：会话状态 ====="
echo ""

# 1. 进度概览
echo "## 进度追踪"
if [ -f "$PROGRESS_FILE" ]; then
    head -40 "$PROGRESS_FILE"
else
    echo "⚠️ PROGRESS.md 不存在！"
fi
echo ""

# 2. 最近提交
echo "## 最近 Git 提交"
git -C "D:/Python/Atoms笔试/Atoms demo" log --oneline -10 2>/dev/null || echo "（尚无提交）"
echo ""

# 3. 计划进度概览
echo "## 计划任务状态"
if [ -f "$PLAN_FILE" ]; then
    grep -E "^(### Task|Task \d+)" "$PLAN_FILE" | head -40
else
    echo "⚠️ 计划文件不存在！"
fi

echo ""
echo "===== 注入完毕 ====="
echo ""
echo "📋 你的任务：根据 PROGRESS.md 确定当前要执行的 Task #N"
echo "1. 打开计划文件找到该 Task 的章节"
echo "2. 只读那一部分（不要加载整个计划）"
echo "3. 执行步骤并提交"
echo "4. 更新 PROGRESS.md"
