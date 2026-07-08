# 智采罗盘 · SmartProcureRadar

企业 IT 采购全流程管理仿真平台，基于 React + TypeScript + Vite + Tailwind CSS。

## 功能模块

- **PR 采购需求申请** — 提交和管理采购需求
- **审批流程中心** — 多级审批工作流
- **供应商管理中心** — 供应商信息与评估管理
- **RFQ 询价管理** — 询价单生成与追踪
- **比价评分** — 多供应商报价对比与自动评分
- **采购订单 PO 管理** — 订单全生命周期管理
- **合同管理** — 合同创建、审批与归档
- **IT 资产验收管理** — 资产到货验收流程
- **付款申请管理** — 付款审批与记录
- **采购档案中心** — 一站式档案检索
- **预算管理** — 预算规划与执行追踪
- **AI 采购助手** — 基于智谱 GLM 模型的智能采购助手，支持函数调用操作
- **天气主题系统** — 基于 OpenWeather 的动态天气背景与粒子动画

## 技术栈

| 类别           | 技术                          |
| -------------- | ----------------------------- |
| 框架           | React 19                      |
| 语言           | TypeScript                    |
| 构建工具       | Vite                          |
| 样式           | Tailwind CSS 4 + shadcn/ui    |
| 图表           | Recharts                      |
| AI             | 智谱 AI (GLM-4-Flash)         |
| 数据库 (可选)  | Supabase                      |
| 导出           | SheetJS (xlsx)                |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

然后编辑 `.env`，填入你自己的 API Key：

| 变量 | 说明 | 获取地址 |
| --- | --- | --- |
| `VITE_ZHIPU_API_KEY` | 智谱 AI API Key（必填，AI 助手功能需要） | [open.bigmodel.cn](https://open.bigmodel.cn/) |
| `VITE_OPENWEATHER_KEY` | OpenWeather API Key（必填，天气主题需要） | [openweathermap.org](https://openweathermap.org/api) |
| `VITE_SUPABASE_URL` | Supabase 项目 URL（可选） | [supabase.com](https://supabase.com/) |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名 Key（可选） | [supabase.com](https://supabase.com/) |

> **注意：** 如果不配置 Supabase，应用会自动使用 localStorage 演示模式，所有数据保存在浏览器本地。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 即可使用。

### 4. 构建生产版本

```bash
npm run build
npm run preview
```

## 项目结构

```text
src/
├── main.tsx                 # 入口文件
├── App.tsx                  # 主应用组件
├── index.css                # 全局样式 / Tailwind
├── components/
│   ├── WeatherWidget.tsx    # 天气挂件
│   └── ui/                  # shadcn/ui 基础组件
└── lib/
    ├── agent.ts             # AI Agent（函数调用）
    ├── ai.ts                # AI 对话模块
    ├── weather.ts           # 天气 API 封装
    ├── storage.ts           # 数据持久化
    ├── supabase.ts          # Supabase 客户端
    ├── export.ts            # Excel 导出
    └── utils.ts             # 工具函数
```

## License

MIT
