# LinQ 数据管线架构设计

> 数据模型到前端State的映射，以及浏览器与Solid Pod的同步机制
> 
> 创建时间：2025-11-08
> 状态：🚧 设计阶段

---

## 1. 核心架构原则

### 1.1 数据流向
```
Solid Pod (SPARQL/RDF) 
    ↓ drizzle-solid 
TypeScript Models (@linq/models)
    ↓ TanStack Query
Frontend State (React)
    ↓ User Actions
UI Components
```

### 1.2 设计目标
- **类型安全**：从 Solid Pod 到 React State 的全链路类型推导
- **实时同步**：浏览器与 Pod 的双向同步
- **智能缓存**：基于 TanStack Query 的缓存策略
- **离线优先**：支持离线操作和冲突解决

---

## 2. 数据映射策略

### 2.1 模型到State的直接映射

**原则**：每个 `@linq/models` 中的 Table Schema 直接映射为 React State

```typescript
// packages/models/src/chat/chat.schema.ts
export const chatTable = podTable("chat", {
  title: string("title").predicate(DCTerms.title).notNull(),
  conversationType: string("conversationType").predicate(LINQ.conversationType).notNull(),
  participants: uri("participants").array().predicate(LINQ.participants).notNull(),
  status: string("status").predicate(LINQ.status).notNull().default("active"),
  // ...
})

// apps/web/src/types/chat.ts (自动生成)
export type ChatState = ChatRow  // 直接使用模型类型
export type ChatListState = ChatState[]
export type ChatFormState = ChatInsert
```

### 2.2 嵌套关系的扁平化

**问题**：Solid Pod 中的关系数据需要在前端进行 JOIN 操作

```typescript
// 后端关系（通过 URI 引用）
interface ChatRow {
  id: string
  participants: string[]  // WebID 数组
  lastMessage: string     // Message URI
}

// 前端聚合状态（自动 JOIN）
interface ChatStateWithRelations {
  ...ChatRow,
  participantDetails: ContactRow[]  // 自动填充联系人详情
  lastMessageDetail: MessageRow    // 自动填充消息详情
}
```

### 2.3 UI状态的分层

```typescript
// 1. 数据层：直接映射模型
type ChatDataState = ChatRow[]

// 2. UI层：添加前端特有状态
type ChatUIState = {
  data: ChatDataState
  loading: boolean
  error: Error | null
  selectedId: string | null
  searchQuery: string
  filters: {
    status: 'active' | 'archived' | 'all'
    type: 'direct' | 'group' | 'ai' | 'all'
  }
  pagination: {
    page: number
    limit: number
    total: number
  }
}
```

---

## 3. 同步机制设计

### 3.1 TanStack Query + drizzle-solid 集成

```typescript
// 查询层：统一的数据获取接口
function useChatList() {
  return useQuery({
    queryKey: ['chats', 'list'],
    queryFn: async () => {
      // drizzle-solid 查询 Solid Pod
      const chats = await db.select().from(chatTable).execute()
      return chats
    },
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000,   // 10分钟
  })
}

// 变更层：统一的数据修改接口  
function useCreateChat() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: ChatInsert) => {
      // drizzle-solid 写入 Solid Pod
      return await db.insert(chatTable).values(data).execute()
    },
    onSuccess: () => {
      // 无效化相关缓存
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    }
  })
}
```

### 3.2 实时同步策略

**WebSocket + Server-Sent Events**

```typescript
// 实时更新监听
function useRealtimeSync() {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    // 监听 Solid Pod 变更通知
    const eventSource = new EventSource('/api/pod-changes')
    
    eventSource.onmessage = (event) => {
      const change = JSON.parse(event.data)
      
      // 根据变更类型无效化对应缓存
      if (change.resource.includes('/chats/')) {
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      }
      if (change.resource.includes('/contacts/')) {
        queryClient.invalidateQueries({ queryKey: ['contacts'] })
      }
    }
    
    return () => eventSource.close()
  }, [])
}
```

### 3.3 离线优先设计

```typescript
// 离线队列管理
class OfflineQueue {
  private queue: PendingMutation[] = []
  
  // 添加离线操作到队列
  enqueue(mutation: PendingMutation) {
    this.queue.push(mutation)
    localStorage.setItem('offline-queue', JSON.stringify(this.queue))
  }
  
  // 网络恢复时批量同步
  async syncOnline() {
    while (this.queue.length > 0) {
      const mutation = this.queue.shift()
      try {
        await this.executeMutation(mutation)
      } catch (error) {
        // 冲突解决策略
        await this.handleConflict(mutation, error)
      }
    }
  }
}
```

---

## 4. 缓存策略

### 4.1 State存储分层架构

```typescript
// ===== 三层存储架构 =====

// 1. React State (内存) - 当前页面的活跃数据
const ChatPageState = {
  data: ChatRow[],           // 当前聊天列表
  selectedChat: ChatRow,     // 当前选中的聊天
  ui: {                      // UI 状态（永远在内存）
    loading: boolean,
    searchQuery: string,
    selectedId: string
  }
}

// 2. TanStack Query Cache (内存) - 查询结果缓存
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5分钟后标记过期
      gcTime: 30 * 60 * 1000,      // 30分钟后垃圾回收
    }
  }
})

// 3. IndexedDB (持久化) - 离线数据存储
const persistentStorage = {
  // 完整的数据副本，支持离线访问
  chats: ChatRow[],
  contacts: ContactRow[],
  messages: MessageRow[],
  
  // 元数据
  lastSyncTime: timestamp,
  pendingMutations: PendingMutation[]
}
```

### 4.2 具体的存储策略

**内存存储 (React State + TanStack Query)**：
- 当前页面的活跃数据
- UI 状态（选中项、加载状态、表单数据）
- 查询结果的临时缓存

**IndexedDB 持久化存储**：
- 完整的业务数据副本（支持离线）
- 用户偏好设置
- 未同步的离线操作队列

```typescript
// 存储决策矩阵
const STORAGE_STRATEGY = {
  // UI状态：仅内存，页面刷新丢失（这是期望的）
  ui: 'memory-only',
  
  // 业务数据：内存 + IndexedDB 双重存储
  businessData: 'memory + indexeddb',
  
  // 用户设置：IndexedDB 持久化
  userSettings: 'indexeddb-primary',
  
  // 临时数据：仅内存
  formState: 'memory-only',
  
  // 离线队列：IndexedDB 持久化
  offlineQueue: 'indexeddb-primary'
}
```

### 4.3 数据流转示例

```typescript
// 用户打开聊天页面的数据流转过程

1. 页面初始化
   ↓
2. useChats() Hook 调用
   ↓  
3. TanStack Query 检查内存缓存
   ↓ (cache miss)
4. 检查 IndexedDB 持久化存储
   ↓ (如果有数据，先返回展示)
5. 查询 Solid Pod (drizzle-solid)
   ↓
6. 数据返回 → 存储到 IndexedDB → 更新内存 → 更新 UI

// 用户创建新聊天的数据流转过程

1. 用户点击"创建聊天"
   ↓
2. 乐观更新：立即更新内存中的 React State
   ↓
3. 后台执行：写入 IndexedDB + 添加到离线队列
   ↓
4. 网络请求：drizzle-solid 写入 Solid Pod
   ↓
5. 成功：清除离线队列 | 失败：保留在队列中等待重试
```

### 4.4 具体实现代码

```typescript
// apps/web/src/lib/storage-manager.ts
class StorageManager {
  constructor(
    private queryClient: QueryClient,
    private idbCache: IDBCache
  ) {}

  // 获取数据：内存 → IndexedDB → Network
  async getData<T>(key: string, networkFn: () => Promise<T>): Promise<T> {
    // 1. 先查内存缓存
    const memoryData = this.queryClient.getQueryData([key])
    if (memoryData && !this.isStale(key)) {
      return memoryData
    }

    // 2. 查 IndexedDB
    const cachedData = await this.idbCache.get(key)
    if (cachedData) {
      // 立即返回缓存数据，后台更新
      this.updateInBackground(key, networkFn)
      return cachedData
    }

    // 3. 网络请求
    const networkData = await networkFn()
    
    // 4. 存储到 IndexedDB
    await this.idbCache.set(key, networkData)
    
    return networkData
  }

  // 写入数据：内存 → IndexedDB → Network
  async setData<T>(key: string, data: T, networkFn: () => Promise<T>) {
    // 1. 立即更新内存（乐观更新）
    this.queryClient.setQueryData([key], data)

    // 2. 存储到 IndexedDB
    await this.idbCache.set(key, data)

    // 3. 添加到离线队列
    await this.addToOfflineQueue({ key, data, operation: 'set' })

    try {
      // 4. 后台网络同步
      const result = await networkFn()
      
      // 5. 同步成功，清除队列
      await this.removeFromOfflineQueue(key)
      
      return result
    } catch (error) {
      // 网络失败，数据保留在离线队列中
      console.warn('Network sync failed, kept in offline queue:', error)
      throw error
    }
  }
}
```

### 4.5 智能失效策略

```typescript
// 关系数据的联动失效
const INVALIDATION_RULES = {
  // 当聊天变更时，无效化相关消息缓存
  'chats': ['messages'],
  
  // 当联系人变更时，无效化相关聊天和消息缓存
  'contacts': ['chats', 'messages'],
  
  // 当设置变更时，无效化所有缓存
  'settings': ['chats', 'contacts', 'messages', 'files', 'favorites']
}
```

---

## 5. 数据管线实现

### 5.1 统一的数据访问层

```typescript
// apps/web/src/lib/data-access.ts
export class DataAccessLayer {
  constructor(
    private db: DrizzleSolidDatabase,
    private queryClient: QueryClient
  ) {}
  
  // 统一的查询接口
  async query<T>(tableName: string, options?: QueryOptions): Promise<T[]> {
    return this.queryClient.ensureQueryData({
      queryKey: [tableName, options],
      queryFn: () => this.db.select().from(getTable(tableName)).execute(),
      ...CACHE_CONFIG[tableName]
    })
  }
  
  // 统一的变更接口
  async mutate<T>(tableName: string, operation: MutationOperation<T>) {
    const result = await this.db.transaction(operation)
    
    // 自动无效化相关缓存
    this.invalidateRelatedCaches(tableName)
    
    return result
  }
  
  // 批量操作支持
  async batchMutate(operations: BatchOperation[]) {
    return this.db.transaction(async (tx) => {
      return Promise.all(operations.map(op => op.execute(tx)))
    })
  }
}
```

### 5.2 类型安全的 Hook 层

```typescript
// apps/web/src/hooks/data/useChat.ts
export function useChats() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['chats', 'list'],
    queryFn: () => dataAccess.query<ChatRow>('chats')
  })
  
  return {
    chats: data ?? [],
    loading: isLoading,
    error
  } satisfies ChatUIState['data']  // 类型检查
}

export function useCreateChat() {
  return useMutation({
    mutationFn: (data: ChatInsert) => 
      dataAccess.mutate('chats', (tx) => tx.insert(chatTable).values(data)),
    onSuccess: () => {
      // 触发乐观更新
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    }
  })
}
```

### 5.3 自动化的状态生成

```typescript
// 基于模型自动生成状态管理代码
// scripts/generate-states.ts
function generateStateFromModel(tableName: string) {
  const tableSchema = getTableSchema(tableName)
  
  return `
// Auto-generated from ${tableName}.schema.ts
export type ${capitalize(tableName)}State = {
  data: ${capitalize(tableName)}Row[]
  loading: boolean
  error: Error | null
  // UI state
  selectedId: string | null
  searchQuery: string
}

export function use${capitalize(tableName)}() {
  // 统一的查询逻辑
}

export function useCreate${capitalize(tableName)}() {
  // 统一的创建逻辑  
}
`
}
```

---

## 6. 下一步讨论

1. **冲突解决策略** - 多设备同时编辑时的冲突处理
2. **权限管理集成** - Solid ACL 与前端状态的结合
3. **性能优化** - 大数据量时的虚拟化和分页策略
4. **离线体验** - 完整的离线操作和同步机制
5. **实时协作** - WebRTC/WebSocket 的集成方案

---

## 7. IndexedDB vs 直接内存到Solid Pod

### 7.1 为什么需要IndexedDB？

**问题**：为什么不直接 `内存 ↔ Solid Pod`，而要加IndexedDB中间层？

**核心原因**：

#### 1. **页面刷新问题**
```typescript
// 没有IndexedDB的情况：
用户编辑聊天 → 内存状态更新 → 用户刷新页面 → 数据全部丢失
// 需要重新从Solid Pod加载，用户体验差

// 有IndexedDB的情况：
用户编辑聊天 → 内存+IndexedDB同时更新 → 用户刷新页面 → 从IndexedDB立即恢复状态
```

#### 2. **网络问题**
```typescript
// 网络不稳定场景：
用户离线操作 → 内存状态更新 → 网络恢复 → ？数据怎么同步到Pod？
                                 ↑
                           如果没有持久化存储，离线操作会丢失

// IndexedDB解决方案：
用户离线操作 → 内存+IndexedDB更新 → 添加到离线队列 → 网络恢复时批量同步
```

#### 3. **大数据量性能**
```typescript
// 假设用户有10000条聊天记录
// 没有本地缓存：每次打开都要从Pod查询10000条 → 慢
// 有IndexedDB：只查询增量变更，大部分数据从本地读取 → 快
```

### 7.2 简化方案：去掉IndexedDB？

如果你觉得IndexedDB增加了复杂度，我们可以简化：

**方案1：纯内存 + Solid Pod**
```typescript
// 简化的数据流
React State (内存) ↔ TanStack Query (内存) ↔ Solid Pod

// 优点：
- 架构简单
- 没有本地数据同步问题
- 代码量少

// 缺点：
- 页面刷新需要重新加载所有数据
- 无法离线操作
- 网络慢时用户体验差
```

**方案2：只在特定场景使用IndexedDB**
```typescript
const STORAGE_STRATEGY = {
  // 轻量数据：仅内存
  ui: 'memory-only',
  settings: 'memory-only',
  
  // 重要数据：内存 + IndexedDB
  chats: 'memory + indexeddb',    // 用户不想丢失聊天记录
  messages: 'memory + indexeddb', // 消息历史很重要
  
  // 可重新获取的数据：仅内存  
  contacts: 'memory-only',        // 可以重新从Pod获取
  files: 'memory-only'            // 文件列表可以重新查询
}
```

### 7.3 实际业务场景分析

**LinQ作为生产力工具的典型用户行为**：

```typescript
// 场景1：用户在编写重要消息时
用户输入一半 → 意外刷新页面 → 输入内容丢失 ❌
// IndexedDB可以保存草稿状态

// 场景2：移动设备网络不稳定
用户在地铁里回复消息 → 发送失败 → 到站后自动重发 ✅
// IndexedDB保存离线队列

// 场景3：大量历史数据
用户查看3个月前的聊天记录 → 每次都要从Pod查询 → 慢 ❌
// IndexedDB缓存历史数据，快速访问
```

### 7.4 推荐方案

**我的建议**：从简单开始，按需添加复杂度

**Phase 1：MVP - 纯内存方案**
```typescript
React State ↔ TanStack Query ↔ Solid Pod
// 快速验证核心功能，暂时忽略刷新和离线问题
```

**Phase 2：添加关键数据持久化**
```typescript
// 只对核心数据使用IndexedDB
chats + messages: 内存 + IndexedDB + Solid Pod
其他数据: 内存 + Solid Pod
```

**Phase 3：完整离线支持**
```typescript
// 全面的离线优先架构
所有数据: 内存 + IndexedDB + 离线队列 + Solid Pod
```

---

## 8. 简化后的数据管线

如果我们去掉IndexedDB，数据管线会是这样：

```typescript
// 1. 读取数据
function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: () => db.select().from(chatTable).execute(), // 直接查询Solid Pod
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据新鲜
  })
}

// 2. 写入数据  
function useCreateChat() {
  return useMutation({
    mutationFn: (data) => db.insert(chatTable).values(data).execute(), // 直接写入Solid Pod
    onSuccess: () => {
      queryClient.invalidateQueries(['chats']) // 无效化内存缓存，重新获取
    }
  })
}

// 3. 离线处理
// 简单方案：网络断开时禁用写操作，显示提示"请检查网络连接"
```

---

## 9. 统一数据管线架构（重新设计）

### 9.1 问题分析

**原设计问题**：分平台的数据策略导致：
- 代码复杂度高：每个平台不同的存储逻辑
- 维护成本大：同一功能要写多套实现
- 调试困难：不同平台表现不一致
- 团队负担重：需要理解多套架构

### 9.2 统一架构设计

**核心原则**：**一套代码，所有平台**

```typescript
// 统一的数据架构
React State ↔ TanStack Query ↔ drizzle-solid ↔ Solid Pod

// 所有平台使用相同的数据流
// 差异只在于配置参数，不在于架构层面
```

### 9.3 平台差异通过配置解决

```typescript
// apps/web/src/lib/query-config.ts
export const getQueryConfig = () => {
  // 检测环境，但不改变架构
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  const isCapacitor = typeof window !== 'undefined' && window.capacitorAPI
  
  return {
    // 根据平台调整缓存参数，但架构保持一致
    defaultOptions: {
      queries: {
        staleTime: isElectron ? 10 * 60 * 1000 : 5 * 60 * 1000, // 桌面缓存更久
        gcTime: isElectron ? 30 * 60 * 1000 : 10 * 60 * 1000,   // 桌面保留更久  
        retry: isCapacitor ? 3 : 1,                              // 移动端多重试
        refetchOnWindowFocus: !isElectron,                       // 桌面不需要焦点刷新
        networkMode: 'online',                                   // 都是在线模式
      },
    },
  }
}
```

### 9.4 简化的实现策略

```typescript
// 1. 统一的数据访问 Hook
export function useChats() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: () => db.select().from(chatTable).execute(),
    // 配置是平台相关的，但逻辑是统一的
  })
}

// 2. 统一的变更 Hook  
export function useCreateChat() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: ChatInsert) => 
      db.insert(chatTable).values(data).execute(),
    onSuccess: () => {
      // 所有平台都使用相同的缓存失效逻辑
      queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
  })
}

// 3. 网络状态处理（所有平台统一）
export function useNetworkAwareness() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  return isOnline
}
```

### 9.5 离线处理的统一方案

```typescript
// 所有平台统一的离线处理
export function useOfflineAwareMutation<T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options?: UseMutationOptions<T, Error, V>
) {
  const isOnline = useNetworkAwareness()
  const queryClient = useQueryClient()
  
  return useMutation({
    ...options,
    mutationFn: async (variables) => {
      if (!isOnline) {
        // 简单粗暴：离线时直接报错，让用户知道
        throw new Error('网络连接断开，请检查网络后重试')
      }
      return mutationFn(variables)
    },
    retry: (failureCount, error) => {
      // 网络错误时自动重试
      if (error.message.includes('network') && failureCount < 3) {
        return true
      }
      return false
    },
  })
}
```

### 9.6 数据模型到前端状态的直接映射

```typescript
// packages/models 的 schema 直接映射到前端类型
// 不需要平台特定的转换

// 1. 自动生成的状态类型
export type ChatState = {
  data: ChatRow[]           // 直接使用模型类型
  loading: boolean
  error: Error | null
  // UI 状态
  selectedId: string | null
  searchQuery: string
}

// 2. 自动生成的 Hook
export function useChatState(): ChatState {
  const { data = [], isLoading, error } = useChats()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  return {
    data,
    loading: isLoading,
    error,
    selectedId,
    searchQuery,
  }
}

// 3. 在组件中直接使用
function ChatList() {
  const { data: chats, loading, selectedId } = useChatState()
  
  if (loading) return <div>加载中...</div>
  return (
    <div>
      {chats.map(chat => (
        <ChatItem 
          key={chat.id} 
          chat={chat} 
          selected={chat.id === selectedId}
        />
      ))}
    </div>
  )
}
```

### 9.7 统一架构的优势

**开发体验**：
- 一套代码，所有平台
- 学习成本低，只需要理解一种架构
- 调试简单，行为一致

**维护成本**：
- 减少重复代码
- 统一的bug修复和功能更新
- 更容易测试和验证

**性能表现**：
- TanStack Query的缓存机制已经足够好
- 不需要复杂的多层存储
- 网络优先，失败时用户能明确知道原因

### 9.8 实际实现步骤

**Phase 1：建立统一基础**
```typescript
// 1. 统一的查询配置
// 2. 统一的错误处理  
// 3. 统一的网络状态管理
```

**Phase 2：自动化状态生成**
```typescript
// 1. 基于 @linq/models 自动生成前端状态类型
// 2. 自动生成标准的 CRUD Hooks
// 3. 自动生成 UI 状态管理
```

**Phase 3：平台特定优化**
```typescript
// 1. 仅通过配置参数优化不同平台
// 2. 保持架构和代码的统一性
```

---

## 10. 简化后的最终架构

### 10.1 核心数据流

```
@linq/models (drizzle-solid schemas)
    ↓ 类型推导
React State Types (自动生成)
    ↓ TanStack Query
UI Components (统一使用)
```

### 10.2 平台差异只在配置层面

```typescript
// 配置差异（不是架构差异）
const config = {
  desktop: { staleTime: 600000, gcTime: 1800000 },    // 缓存更激进
  mobile:  { staleTime: 300000, gcTime: 600000 },     // 缓存保守
  web:     { staleTime: 300000, gcTime: 900000 },     // 中等配置
}
```

### 10.3 开发者体验

```typescript
// 开发者只需要关心业务逻辑，不用关心平台差异
function ChatPage() {
  const { data: chats, loading } = useChats()        // 统一API
  const createChat = useCreateChat()                 // 统一API
  
  // 业务逻辑，所有平台一致
}
```

### 10.4 ~~IndexedDB 数据迁移和退场策略~~ **已废弃**

**问题**：如果之前使用了 IndexedDB 存储本地数据，现在切换到纯内存+Pod 架构，旧数据怎么处理？

> ⚠️ **重要决策更新**：我们已经决定完全不使用 IndexedDB，采用纯内存+Solid Pod 的简化架构。
> 
> **原因**：
> - 避免在 IndexedDB 中复刻整套数据结构的复杂性
> - TanStack Query 的内存缓存已经足够好用
> - 统一架构，降低维护成本
> 
> **结论**：以下迁移策略仅用于清理可能存在的历史 IndexedDB 数据

#### 方案1：逐步迁移（推荐）

```typescript
// apps/web/src/lib/migration.ts
class DataMigration {
  async migrateFromIndexedDB() {
    const hasLegacyData = await this.checkIndexedDBData()
    
    if (hasLegacyData) {
      console.log('发现本地数据，开始迁移到 Solid Pod...')
      
      try {
        // 1. 读取 IndexedDB 中的数据
        const localChats = await this.readFromIndexedDB('chats')
        const localContacts = await this.readFromIndexedDB('contacts')
        
        // 2. 上传到 Solid Pod（如果Pod中不存在）
        await this.syncToSolidPod(localChats, localContacts)
        
        // 3. 验证同步成功
        const podData = await this.verifyPodData()
        
        // 4. 清理本地数据
        await this.cleanupIndexedDB()
        
        console.log('数据迁移完成')
      } catch (error) {
        console.warn('迁移失败，保留本地数据:', error)
        // 迁移失败时保留 IndexedDB 数据，下次启动再试
      }
    }
  }
  
  private async checkIndexedDBData(): Promise<boolean> {
    try {
      const db = await openIndexedDB()
      const transaction = db.transaction(['chats'], 'readonly')
      const store = transaction.objectStore('chats')
      const count = await store.count()
      return count > 0
    } catch {
      return false // IndexedDB 不存在或无法访问
    }
  }
  
  private async syncToSolidPod(localChats: any[], localContacts: any[]) {
    // 只同步 Pod 中不存在的数据，避免覆盖
    for (const chat of localChats) {
      const existsInPod = await this.checkPodExists('chats', chat.id)
      if (!existsInPod) {
        await db.insert(chatTable).values(chat).execute()
      }
    }
  }
  
  private async cleanupIndexedDB() {
    // 删除 IndexedDB 数据库
    indexedDB.deleteDatabase('linq-local-cache')
  }
}

// 在应用启动时调用
export async function initializeDataMigration() {
  const migration = new DataMigration()
  await migration.migrateFromIndexedDB()
}
```

#### 方案2：用户选择迁移

```typescript
// 给用户一个迁移向导
function DataMigrationDialog() {
  const [hasLocalData, setHasLocalData] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'migrating' | 'success' | 'failed'>('pending')
  
  useEffect(() => {
    checkLocalData().then(setHasLocalData)
  }, [])
  
  const handleMigrate = async () => {
    setMigrationStatus('migrating')
    try {
      await migrateToSolidPod()
      setMigrationStatus('success')
    } catch (error) {
      setMigrationStatus('failed')
    }
  }
  
  const handleSkip = async () => {
    // 用户选择不迁移，直接清除本地数据
    await clearLocalData()
  }
  
  if (!hasLocalData) return null
  
  return (
    <Dialog open>
      <DialogContent>
        <h2>发现本地数据</h2>
        <p>我们发现您之前存储了一些本地数据。您希望：</p>
        
        <div className="space-y-2">
          <Button onClick={handleMigrate} disabled={migrationStatus === 'migrating'}>
            {migrationStatus === 'migrating' ? '迁移中...' : '迁移到 Solid Pod'}
          </Button>
          
          <Button variant="outline" onClick={handleSkip}>
            删除本地数据（重新开始）
          </Button>
        </div>
        
        {migrationStatus === 'failed' && (
          <p className="text-red-500">迁移失败，请检查网络连接后重试</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

#### 方案3：直接清理（最简单）

```typescript
// apps/web/src/lib/cleanup.ts
export async function cleanupLegacyStorage() {
  try {
    // 清理 IndexedDB
    const databases = await indexedDB.databases()
    
    for (const db of databases) {
      if (db.name?.startsWith('linq-')) {
        console.log(`清理旧数据库: ${db.name}`)
        indexedDB.deleteDatabase(db.name)
      }
    }
    
    // 清理 localStorage
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('linq-cache-')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    console.log('本地缓存清理完成')
  } catch (error) {
    console.warn('清理本地缓存失败:', error)
  }
}

// 在应用启动时调用
useEffect(() => {
  cleanupLegacyStorage()
}, [])
```

#### 推荐策略

**Phase 1: 检测和通知**
```typescript
// 启动时检测是否有旧数据
if (await hasLegacyData()) {
  // 显示迁移对话框，让用户选择
  showMigrationDialog()
}
```

**Phase 2: 自动迁移（对于新版本）**
```typescript
// 版本检查，如果是从旧版本升级
const lastVersion = localStorage.getItem('linq-version')
if (lastVersion && compareVersions(lastVersion, CURRENT_VERSION) < 0) {
  await autoMigrate()
}
localStorage.setItem('linq-version', CURRENT_VERSION)
```

**Phase 3: 清理（几个版本后）**
```typescript
// 几个版本后，直接清理所有 IndexedDB 数据
// 因为大部分用户应该已经迁移完成
await forceCleanupLegacyData()
```

#### 最佳实践

1. **渐进式清理**：不要一次性删除所有本地数据
2. **用户控制**：让用户决定是否迁移
3. **降级支持**：如果 Solid Pod 不可用，临时保留本地数据
4. **版本标记**：用版本号标记数据格式，方便未来迁移

---

## 11. 最终确认的架构

### 11.1 核心决策

**完全不使用 IndexedDB**，原因：

1. **复杂性问题**：如果要在 IndexedDB 中复刻整套数据结构，就需要：
   - 维护与 `@linq/models` 完全一致的 schema
   - 处理关系型数据的存储和查询
   - 同步 drizzle-solid 的变更到本地存储
   - 解决数据一致性问题

2. **收益不明显**：
   - TanStack Query 已经提供了很好的内存缓存
   - 用户刷新页面重新加载数据是可以接受的
   - Solid Pod 的查询性能随着 SPARQL 优化会越来越好

3. **维护负担**：
   - 两套存储系统意味着双倍的bug和维护工作
   - 数据同步逻辑容易出错
   - 增加了整体架构的复杂度

### 11.2 简化后的最终架构

```typescript
// ===== 统一的数据流 =====
@linq/models (drizzle-solid)
    ↓ 直接查询 Solid Pod
TanStack Query (内存缓存)
    ↓ 类型安全的数据
React Components (UI展示)

// ===== 不再需要 =====
❌ IndexedDB 复杂存储层
❌ 数据同步逻辑  
❌ 离线队列
❌ 本地schema维护
```

### 11.3 具体的一致性程度

**数据类型一致性**：100% 一致
```typescript
// packages/models/src/chat/chat.schema.ts
export type ChatRow = typeof chatTable.$inferSelect

// apps/web/src/hooks/useChat.ts  
export function useChats(): { data: ChatRow[], loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: () => db.select().from(chatTable).execute() // 直接返回 ChatRow[]
  })
  
  return { data: data ?? [], loading: isLoading }
}

// apps/web/src/components/ChatList.tsx
function ChatList() {
  const { data: chats } = useChats() // chats: ChatRow[]，类型完全一致
  return <div>{chats.map(chat => ...)}</div>
}
```

**缓存层一致性**：平台配置不同，但数据结构一致
```typescript
// 所有平台都缓存相同的数据结构
// 只是缓存时间不同：
desktop: staleTime = 10分钟  // 缓存更久
mobile:  staleTime = 5分钟   // 缓存时间短
web:     staleTime = 5分钟   // 默认配置

// 但缓存的数据类型完全一样：ChatRow[], ContactRow[], MessageRow[]
```

**API 一致性**：所有平台使用相同的 Hooks
```typescript
// 这些 Hooks 在所有平台都一模一样
const { data: chats } = useChats()           // 获取聊天列表
const { data: contacts } = useContacts()     // 获取联系人
const createChat = useCreateChat()           // 创建聊天

// 平台差异完全隐藏在配置层
```

### 11.4 答案总结

**做到什么程度的一致性**：**完全一致**

- **类型一致性**：100%，直接使用 drizzle-solid 推导的类型
- **API一致性**：100%，所有平台使用相同的 Hooks
- **数据结构一致性**：100%，都是直接从 Solid Pod 获取的原始数据
- **缓存策略一致性**：架构一致，只有参数配置不同

**不需要在 IndexedDB 复刻数据结构**，因为：
- 我们选择了更简单的纯内存+Pod架构  
- TanStack Query 的缓存层就足够了
- 避免了双重存储的复杂性