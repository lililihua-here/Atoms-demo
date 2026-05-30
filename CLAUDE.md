# Atoms Demo — CLAUDE.md

## 防变傻规则（最高优先级，每次执行任务前必读）

### 核心原则

**你每完成 2-3 个任务会变傻。** 上下文窗口有限，你必须依赖磁盘而非记忆。

### 强制执行规则

1. **每个任务完成后必须 `git commit`**。commit message 格式：`feat: <task-name> (Task #N done)`。`git log --oneline` 就是你的真实进度条，不要相信你的记忆。

2. **开始新任务前必须读计划**。使用 Read 工具打开 `D:\Python\Atoms笔试\PLAN\2026-05-30-atoms-demo.md`，找到当前 Task #N 的章节，只读那一部分。

3. **不要一口气做多个任务**。做完一个、提交、再读计划、再做下一个。

4. **遇到阻碍立即写入 PROGRESS.md**。不要靠记忆记住"刚才出了什么错"。

5. **不要过度设计**。计划的 Task 让你写什么就写什么。不要"顺便"重构、加功能、修计划里没提到的 bug。

6. **复用优先**。先检查参考项目（`D:\Python\Atoms参考\参考项目\V9 - 项目计划和MVP(1)\`）是否有可抄的代码，再看学习文档（`D:\Python\Atoms笔试\学习文档-参考项目分析.md`）的抄袭路径。

7. **上下文压缩后必须恢复**。当你看到 `<system-reminder>` 说上下文被压缩了，PostCompact hook 会注入检盘点。你必须立刻：
   - Read `D:\Python\Atoms笔试\Atoms demo\.claude\checkpoint.md`（PreCompact 保存的状态快照）
   - Read `D:\Python\Atoms笔试\Atoms demo\PROGRESS.md`（确认当前 Task）
   - `git status` + `git log --oneline -3`（确认文件状态）
   - **绝对不要**凭记忆重新开始已完成的任务，相信检盘点而不是你的记忆

---

## 项目基本信息

- **项目名**：Atoms Demo
- **目标**：AI Agent 驱动的应用生成器（PM → Architect → Engineer 生成 React 应用 + 实时预览）
- **技术栈**：Next.js 14 / TypeScript / Tailwind CSS / shadcn/ui / Supabase / Anthropic SDK
- **部署目标**：Vercel + Supabase（$0/月）

## 关键文件

| 文件 | 用途 |
|------|------|
| `../PRD/PRD.md` | 产品需求文档 v4.0 |
| `../PLAN/2026-05-30-atoms-demo.md` | 英文实施计划（19 任务 + 代码） |
| `../PLAN/2026-05-30-atoms-demo-zh.md` | 中文实施计划（设计描述） |
| `../学习文档-参考项目分析.md` | 参考项目学习文档（抄袭路径） |
| `PROGRESS.md` | 当前进度追踪 |
