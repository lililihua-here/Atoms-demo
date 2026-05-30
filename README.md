# Atoms Studio

AI Agent 驱动的应用生成器——用自然语言描述需求，三位 AI 专家（产品经理 → 架构师 → 工程师）协作生成可运行的单页 React 应用，实时预览。

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| 后端服务 | Supabase (Auth + PostgreSQL) |
| AI | Anthropic Claude API |
| 部署 | Vercel + Supabase |

## 功能

- **自然语言需求输入** — 用一句话描述你想要的应用
- **三 Agent 流水线** — PM 生成 PRD → 架构师输出技术方案 + 组件契约 → 工程师并行生成代码
- **断点续跑** — 中断后自动检测未完成的阶段并恢复
- **语义记忆检索** — 64 维 LLM 向量存储历史协作记录，后续轮次自动关联
- **组件级并行生成** — 架构师拆解独立组件后，多个工程师子 Agent 并行生成再合并
- **MCP 工具扩展** — 支持内置工具（echo/now/calc）及远程 MCP 服务器
- **实时预览** — iframe 沙箱内 Babel 转译 JSX + Tailwind CDN 渲染

## 快速开始

### 前置条件

- Node.js 20+
- Supabase 账号
- Anthropic API Key

### 安装

```bash
git clone https://github.com/lililihua-here/Atoms-demo.git
cd Atoms-demo
npm install
```

### 环境变量

创建 `.env.local`：

```env
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 数据库

在 Supabase SQL Editor 中执行 `supabase/migrations/001_schema.sql`。

### 开发

```bash
npm run dev
```

打开 http://localhost:3000。

### 部署

```bash
npm run build
```

推荐部署到 Vercel（免费），在项目设置中配置相同的环境变量。

## 项目结构

```
├── app/
│   ├── api/chat/          # SSE 流式聊天端点
│   ├── api/projects/      # 项目 CRUD
│   ├── api/mcp/           # MCP 工具代理
│   ├── login/             # 登录注册页
│   ├── projects/          # 项目列表页
│   └── workspace/[id]/    # 工作区（聊天 + 预览）
├── components/
│   ├── chat/              # ChatPanel, MessageBubble, ChatInput
│   ├── pipeline/          # PipelineProgress
│   ├── preview/           # PreviewPanel (iframe 沙箱)
│   └── ui/                # shadcn/ui 组件
├── lib/
│   ├── agent/             # pipeline, prompts, contract, merge, mcp, embedding, retrieval
│   ├── llm/               # Anthropic SDK 封装（流式/非流式/摘要）
│   ├── supabase/          # 浏览器端 + 服务端客户端
│   └── models/            # TypeScript 类型定义
└── supabase/migrations/   # 数据库迁移
```

## License

MIT
