# LinQ 前端架构设计

> LinQ 前端技术架构与组件库策略设计文档
> 
> 创建时间：2025-11-07
> 状态：✅ 架构规范已确定

---

## 📋 目录

- [1. 架构概述](#1-架构概述)
- [2. 技术栈选择](#2-技术栈选择)
- [3. 组件库策略](#3-组件库策略)
- [4. 状态管理](#4-状态管理)
- [5. 路由系统](#5-路由系统)
- [6. 构建与部署](#6-构建与部署)
- [7. 性能优化](#7-性能优化)
- [8. 开发工具链](#8-开发工具链)

---

## 1. 架构概述

### 1.1 设计原则

LinQ 前端架构遵循以下核心原则：

- **🎯 去中心化优先**：符合 Solid Pod 理念，避免 vendor lock-in
- **🧩 组件化架构**：模块化设计，便于维护和扩展
- **⚡ 性能优先**：快速加载，流畅交互
- **🔒 类型安全**：TypeScript 全覆盖
- **🎨 一致体验**：统一的设计系统和交互模式

### 1.2 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    LinQ Frontend Architecture               │
├─────────────────────────────────────────────────────────────┤
│  🎨 UI Layer                                               │
│  ├── shadcn/ui (基础框架)                                   │
│  ├── OpenAI ChatKit (聊天专用)                             │
│  └── Custom Components (业务组件)                          │
├─────────────────────────────────────────────────────────────┤
│  🧠 Logic Layer                                            │
│  ├── TanStack Router (路由管理)                            │
│  ├── TanStack Query (状态管理)                             │
│  └── React Context (全局状态)                              │
├─────────────────────────────────────────────────────────────┤
│  🔌 Data Layer                                             │
│  ├── @linq/models (Solid Pod ORM)                          │
│  ├── drizzle-solid (数据访问)                              │
│  └── @inrupt/solid-client (Solid 集成)                     │
├─────────────────────────────────────────────────────────────┤
│  ⚡ Runtime Layer                                           │
│  ├── Vite (构建工具)                                       │
│  ├── React 18.3 (UI 框架)                                  │
│  └── TypeScript (类型系统)                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈选择

### 2.1 核心技术栈

| 分类 | 技术选择 | 版本 | 说明 |
|------|----------|------|------|
| **UI 框架** | React | 18.3.1 | 稳定版本，等待 Next.js 支持 React 19 |
| **构建工具** | Vite | 5.4+ | 快速开发体验，HMR 支持 |
| **类型系统** | TypeScript | 5.0+ | 全面类型安全 |
| **路由管理** | TanStack Router | latest | 类型安全的路由系统 |
| **状态管理** | TanStack Query | latest | 服务端状态管理 |
| **样式方案** | Tailwind CSS | 3.4+ | 实用优先的 CSS 框架 |

### 2.2 Solid Pod 集成

| 分类 | 技术选择 | 说明 |
|------|----------|------|
| **Solid 客户端** | @inrupt/solid-client | 官方 Solid 客户端 |
| **UI 集成** | @inrupt/solid-ui-react | Solid React 组件 |
| **数据 ORM** | drizzle-solid (本地版) | 自定义 SPARQL ORM |
| **数据模型** | @linq/models | 统一数据模型定义 |

---

## 3. 组件库策略

### 3.1 混合组件库架构 ⭐

**设计理念**: "各司其职，最佳实践"

- **shadcn/ui**: 主框架 + 基础组件生态
- **OpenAI ChatKit**: 专业聊天界面 + 流式响应
- **自定义组件**: 业务特定逻辑

### 3.2 组件分工明细

#### shadcn/ui 负责 (📦 基础建设)

```tsx
// 布局框架
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

// 导航组件  
import { Button, Avatar, Separator } from '@/components/ui/'

// 表单控件
import { Input, Textarea, Select, Switch } from '@/components/ui/'

// 数据展示
import { Card, Badge, ScrollArea, Table } from '@/components/ui/'

// 反馈组件
import { Dialog, Alert, Toast, Skeleton } from '@/components/ui/'

// 图标系统 - 统一使用 Lucide React
import { MessageSquare, Users, FolderOpen, Star, Key, Settings, Sun, Moon, Bot } from 'lucide-react'
```

**图标规范**:
- ✅ **统一生态**: 全部使用 Lucide React 图标库
- ✅ **禁用 Emoji**: 不使用任何 emoji 图标 (💬👤📁等)
- ✅ **一致性**: 保持图标风格统一，大小规格统一
- ✅ **语义化**: 图标含义清晰，符合用户预期

**优势**:
- ✅ **完全开源**: MIT 许可，无 vendor lock-in
- ✅ **源码可控**: 直接复制到项目，可任意修改
- ✅ **类型安全**: TypeScript 原生支持
- ✅ **主题系统**: 完美支持 CSS 变量

#### ChatKit 负责 (💬 专业聊天)

```tsx
import { ChatKit } from '@openai/chatkit-react'

// 专业聊天功能
<ChatKit 
  baseURL={customEndpoint}     // 支持自定义端点
  apiKey={userApiKey}
  theme={solidTheme}           // 应用 Solid 主题
/>
```

**功能**:
- ✅ **对话界面**: 完整的聊天组件
- ✅ **流式响应**: 实时消息流处理  
- ✅ **ChatKit Widgets**: 结构化信息展示
- ✅ **多轮对话**: 会话状态管理
- ✅ **错误处理**: 优雅的 API 失败降级

### 3.3 技术集成策略

```tsx
// 主布局: shadcn/ui
<MainLayout>
  <ResizablePanelGroup>
    <Sidebar>              {/* shadcn: Button + Avatar */}
    <ListPanel>            {/* shadcn: Input + ScrollArea */}
    <ContentArea>
      {/* 条件渲染 */}
      {activeView === 'chat' ? (
        <ChatKit              // OpenAI ChatKit
          baseURL={customEndpoint}
          apiKey={userApiKey}
          theme={{
            primaryColor: '#764FF6',     // Solid 官方紫色
            backgroundColor: '#0D1520',  // 深蓝背景
            borderRadius: '12px'         // 统一圆角
          }}
        />
      ) : (
        <OtherModules>        // shadcn 组件组合
          <Card />
          <Form />
        </OtherModules>
      )}
    </ContentArea>
  </ResizablePanelGroup>
</MainLayout>
```

### 3.4 Solid Pod 兼容性

**去中心化支持**:
- ✅ **自定义端点**: ChatKit 支持 `CHATKIT_API_BASE` 配置
- ✅ **本地模型**: 支持 Ollama, LM Studio 等本地 AI
- ✅ **数据主权**: 聊天记录可存储在用户的 Solid Pod
- ✅ **隐私保护**: 完全本地化的 AI 对话

**配置示例**:
```bash
# 本地 Ollama 配置
CHATKIT_API_BASE=http://localhost:11434/v1
OPENAI_API_KEY=ollama

# 或自定义 Solid Pod AI 服务
CHATKIT_API_BASE=https://my-pod.example.com/ai/v1
```

---

## 4. 状态管理

### 4.1 状态分层架构

```
📊 状态管理层级
├── 🌐 全局状态 (React Context)
│   ├── solidSession (Solid Pod 会话)
│   ├── currentUser (当前用户信息)  
│   └── appSettings (应用设置)
├── 🗂️ 路由状态 (TanStack Router)
│   ├── currentView (当前功能视图)
│   ├── selectedItem (选中的列表项)
│   └── navigationHistory (导航历史)
├── 📡 服务端状态 (TanStack Query)
│   ├── chatMessages (聊天消息)
│   ├── contactList (联系人列表)
│   ├── fileList (文件列表)
│   └── favoriteList (收藏列表)
└── 🔄 本地状态 (useState/useReducer)
    ├── formData (表单数据)
    ├── uiState (UI 交互状态)
    └── cacheData (临时缓存)
```

### 4.2 TanStack Query 集成

```tsx
// 查询配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5分钟缓存
      cacheTime: 1000 * 60 * 30,     // 30分钟保留
      retry: 3,                      // 自动重试
      refetchOnWindowFocus: false,   // 避免过度刷新
    },
  },
})

// 使用示例
const { data: chatMessages, isLoading } = useQuery({
  queryKey: ['chat', conversationId],
  queryFn: () => fetchChatMessages(conversationId),
  enabled: !!conversationId,
})
```

---

## 5. 路由系统

### 5.1 TanStack Router 配置

```tsx
// 路由定义
const routeTree = rootRoute.addChildren([
  indexRoute,                 // / → 重定向到 /chat
  chatRoute,                  // /chat
  chatDetailRoute,            // /chat/:conversationId  
  contactsRoute,              // /contacts
  contactDetailRoute,         // /contacts/:contactId
  filesRoute,                 // /files
  favoritesRoute,             // /favorites
  credentialsRoute,           // /credentials
  settingsRoute,              // /settings
  authCallbackRoute,          // /auth/callback
])
```

### 5.2 类型安全路由

```tsx
// 类型安全的导航
function navigate() {
  router.navigate({ 
    to: '/chat/$conversationId', 
    params: { conversationId: 'ai-assistant' }
  })
}

// 路由参数验证
const chatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat/$conversationId',
  validateSearch: z.object({
    message: z.string().optional(),
  }),
})
```

---

## 6. 构建与部署

### 6.1 构建配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          solid: ['@inrupt/solid-client'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-avatar'],
        },
      },
    },
  },
})
```

### 6.2 部署策略

**开发环境**:
```bash
yarn workspace @linq/web dev    # 本地开发
```

**生产构建**:
```bash
yarn workspace @linq/web build  # 静态构建
yarn workspace @linq/web preview # 预览构建结果
```

**部署目标**:
- ✅ **静态托管**: Vercel, Netlify, GitHub Pages
- ✅ **IPFS**: 去中心化托管
- ✅ **自托管**: Docker + Nginx

---

## 7. 性能优化

### 7.1 代码分割

```tsx
// 路由级别懒加载
const ChatInterface = lazy(() => import('@/components/ChatInterface'))
const ContactList = lazy(() => import('@/components/ContactList'))

// 组件级别懒加载
const ChatKit = lazy(() => import('@openai/chatkit-react'))
```

### 7.2 缓存策略

```typescript
// Service Worker 缓存
const CACHE_NAME = 'linq-v1'
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
]

// TanStack Query 智能缓存
const queries = {
  chatMessages: { staleTime: 5 * 60 * 1000 },    // 5分钟
  contactList: { staleTime: 30 * 60 * 1000 },    // 30分钟  
  fileList: { staleTime: 10 * 60 * 1000 },       // 10分钟
}
```

### 7.3 包体积优化

- **Tree Shaking**: 自动移除未使用代码
- **动态导入**: 按需加载大型依赖
- **CDN 加载**: 第三方库使用 CDN
- **压缩优化**: Brotli + Gzip 双重压缩

---

## 8. 开发工具链

### 8.1 代码质量

```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0",
    "type-check": "tsc --noEmit",
    "format": "prettier --write src",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

### 8.2 开发体验

- **HMR**: Vite 快速热更新
- **TypeScript**: 编译时类型检查  
- **ESLint**: 代码规范检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks 自动化

### 8.3 调试工具

- **React DevTools**: 组件调试
- **TanStack Query DevTools**: 查询状态调试
- **TanStack Router DevTools**: 路由调试
- **Browser DevTools**: 性能分析

---

## 9. 架构决策记录 (ADR)

### 9.1 为什么选择混合组件库策略？

**问题**: 使用单一组件库还是多个专业组件库？

**决策**: 采用 shadcn/ui + ChatKit 混合策略

**理由**:
- shadcn/ui 提供完整的基础组件生态
- ChatKit 提供专业的聊天体验
- 避免重复造轮子，聚焦核心业务
- 保持架构灵活性，符合去中心化理念

### 9.2 为什么选择 TanStack 生态？

**问题**: 状态管理和路由方案选择

**决策**: TanStack Router + TanStack Query

**理由**:
- 类型安全的现代化方案
- 专业的服务端状态管理
- 与 React 生态深度整合
- 性能优化和开发体验并重

---

## 10. 下一步规划

### 10.1 短期目标 (1-2周)
- [ ] ChatKit 集成和主题定制
- [ ] 其他模块的 shadcn 组件实现
- [ ] 性能基准测试和优化

### 10.2 中期目标 (1-2月)  
- [ ] PWA 支持和离线功能
- [ ] 国际化 (i18n) 支持
- [ ] 无障碍 (a11y) 改进

### 10.3 长期目标 (3-6月)
- [ ] 移动端适配 (React Native)
- [ ] 桌面端增强 (Electron)
- [ ] 插件系统设计

---

## 11. 参考资料

### 技术文档
- **[shadcn/ui 官方文档](https://ui.shadcn.com/)**
- **[OpenAI ChatKit 文档](https://openai.github.io/chatkit-js/)**
- **[TanStack Router](https://tanstack.com/router)**
- **[TanStack Query](https://tanstack.com/query)**

### 相关设计文档
- **[主布局设计](./main-layout-design.md)** - 三栏布局具体实现
- **[聊天界面设计](./chat-interface-design.md)** - ChatKit 集成详情
- **[主题设计](./theme-design.md)** - Solid Protocol 品牌系统

### LinQ 项目文档
- **[产品定位文档](./product-definition.md)** - LinQ 核心理念
- **[Solid Pod 集成](../specs/001-linq-hub/contracts/solid-pod-interactions.md)**
- **[数据模型设计](../specs/001-linq-hub/data-model.md)**

---

*本文档随架构演进持续更新，最后更新：2025-11-07*