# Atoms Studio

AI Agent 驱动的应用生成器。与**团队领导**对话，四位 AI 专家（团队领导 → 产品经理 → 架构师 → 工程师）协作生成可运行的单页 React 应用，实时预览，一键导出。

---

## 项目亮点

- **团队领导智能调度** — 不是固定流水线。Team Lead 理解意图后自动判断需要哪些专家：修 bug 只调工程师，改架构调架构师+工程师，新功能全调
- **流式多 Agent 对话** — 每个 Agent 输出实时打字机展示，进度条可视化，过程透明
- **迭代修改不重写** — 第二轮起 Engineer 看到上一版完整代码 + "最小改动原则"，不会自由发挥
- **断点续跑** — 浏览器关闭、网络断开都不丢进度。重开项目自动检测，横幅提示继续
- **并行组件生成** — 架构师拆解独立组件后，多个子 Agent 并行生成再合并，加速 40-60%
- **一键导出 ZIP** — 生成的应用打包为单个 HTML 文件，浏览器打开即用
- **Ink & Parchment 视觉风格** — 硬阴影、衬线字体、暖色纸张色调，有辨识度
- **21 个单元测试** — 核心函数（代码提取、意图分类、契约解析）有测试覆盖

---

## 使用教程

### 1. 注册/登录

打开应用后首先进入登录页。输入邮箱和密码，点击"登录"或"立即注册"。

### 2. 创建项目

登录后进入项目列表。点击右上角"新建项目"，输入项目名称（如"番茄钟"），点击"创建并进入"。

### 3. 描述需求

进入工作区后，在底部输入框用自然语言描述你想要的应用。例如：

> 帮我做一个番茄钟应用，有 25 分钟倒计时、开始/暂停/重置按钮，到时间播放提示音

按 Enter 发送。

### 4. 观察 Agent 协作

发送后你会看到：

1. **团队领导**（紫色头像）先回复，表示已理解需求，并决定调度哪些专家
2. 顶部进度条依次亮起——产品经理 → 架构师 → 工程师
3. 每个 Agent 的输出实时显示在左侧聊天区（打字机效果）
4. 工程师完成后，**团队领导**再次出场，汇报本轮成果
5. 右侧预览面板自动渲染生成的应用

### 5. 预览和调试

- **预览**标签：查看生成的应用效果
- **源码**标签：查看生成的完整代码
- **刷新**按钮：重新加载预览
- **导出**按钮：下载 ZIP 文件（包含 index.html，可直接浏览器打开）

如果代码有运行错误，预览区会显示红色错误框，同时错误信息会同步到聊天区。

### 6. 迭代修改

在聊天框继续输入修改要求：

> 把背景色改成浅蓝色

> 计时器字体再大一点

Team Lead 会判断这只是样式修改，只调工程师处理。工程师在原代码基础上做最小改动，不会重写整个应用。

### 7. 断点续跑

如果不小心关闭了浏览器或网络断开，重新进入项目时会看到横幅提示"上次生成中断，可从 XX 阶段继续"，点击即可恢复。

---

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| 后端服务 | Supabase (Auth + PostgreSQL) |
| LLM | DeepSeek API（OpenAI 兼容格式） |
| 沙箱 | Babel Standalone + React 18 CDN + Tailwind CDN |
| 测试 | Vitest（21 个单元测试） |
| 部署 | Vercel + Supabase（$0/月） |

---

## 快速开始

### 前置条件

- Node.js 20+
- Supabase 账号（免费计划即可）
- DeepSeek API Key

### 安装

```bash
git clone https://github.com/lililihua-here/Atoms-demo.git
cd Atoms-demo
npm install
```

### 环境变量

创建 `.env.local`：

```env
DEEPSEEK_API_KEY=sk-...
LLM_BASE_URL=https://api.deepseek.com/v1   # 可选，默认值
LLM_MODEL=deepseek-chat                     # 可选，默认值
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 数据库

在 Supabase SQL Editor 中执行 `supabase/migrations/001_schema.sql`。

### 开发

```bash
npm run dev        # 启动开发服务器
npm run build      # 生产构建
npm test           # 运行单元测试（21 个）
```

打开 http://localhost:3000。

### 部署

推荐部署到 Vercel（免费 Hobby 计划）。在 Vercel 项目 Settings → Environment Variables 中配置上述环境变量，推送代码后自动部署。

---

## 项目结构

```
├── app/
│   ├── api/chat/              # SSE 流式聊天端点
│   ├── api/chat/classify/     # LLM 意图分类端点
│   ├── api/projects/          # 项目 CRUD
│   ├── api/mcp/               # MCP 工具代理
│   ├── login/                 # 登录注册页
│   ├── projects/              # 项目列表页
│   └── workspace/[id]/        # 工作区（聊天 + 预览）
├── components/
│   ├── chat/                  # ChatPanel, MessageBubble, ChatInput
│   ├── pipeline/              # PipelineProgress（4 节点进度条）
│   ├── preview/               # PreviewPanel（iframe 沙箱 + 导出）
│   ├── MemoryPanel.tsx        # 语义记忆侧边栏
│   ├── McpSettings.tsx        # MCP 服务器管理弹窗
│   └── ui/                    # shadcn/ui 组件
├── lib/
│   ├── agent/
│   │   ├── pipeline.ts        # 流水线编排入口
│   │   ├── constants.ts       # Agent 角色常量
│   │   ├── prompts.ts         # 7 个 Agent 系统提示词
│   │   ├── classify.ts        # 意图分类 + dispatch 解析
│   │   ├── contract.ts        # 组件契约解析 + 修复
│   │   ├── merge.ts           # 并行组件代码合并
│   │   ├── build-context.ts   # 上下文组装
│   │   ├── stream-agent.ts    # 流式 Agent + 并发池
│   │   ├── run-parallel.ts    # 并行工程师编排
│   │   ├── extract-code.ts    # 代码提取 + 校验
│   │   ├── embedding.ts       # LLM 向量生成（备用）
│   │   ├── retrieval.ts       # 文本匹配语义检索
│   │   ├── mcp.ts             # MCP 客户端
│   │   └── __tests__/         # 单元测试（21 个）
│   ├── llm/                   # DeepSeek SDK 封装
│   ├── supabase/              # 浏览器端 + 服务端客户端
│   └── models/                # TypeScript 类型定义
└── supabase/migrations/       # 数据库迁移
```

---

## License

MIT
