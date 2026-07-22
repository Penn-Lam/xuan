# xuan（宣）实现方案

> 目标：参考 infourier 思路做一个 React + TypeScript 项目——IA 思维导图 ↔ Canvas 布局双模式双向同步，导出结构化 JSON 喂 AI 生成页面，并通过 MCP server 让 Agent 直接操控画布。

---

## 一、技术栈与关键决策

| 维度 | 选择 | 理由 |
|---|---|---|
| 包管理 | **bun workspace**（package.json `workspaces`） | 用户指定；快、原生 workspace |
| Canvas | `@xyflow/react@12` + `@dagrejs/dagre` | 自带 zustand，React 19 兼容，无 license |
| 组件库 | **Fluid Functionalism · Base UI flavor** | 用户指定；所有组件名带 `-base` 后缀，依赖 `@base-ui/react` |
| 设计 token | **Fluid 自带**（design.md 的 Geist 暂留作未来参考层） | MVP 不做 token 双层叠加 |
| Icons | **@phosphor-icons/react**（IconProvider 全局覆盖 48 slot） | 用户指定；Fluid 原生支持替换 |
| 状态 | zustand + `persist` + `partialize` | RF 官方推荐 |
| 持久化 | localStorage（web 真相源） | side project 够用 |
| 构建 | Vite + Tailwind v4 + CSS variables | Fluid 推荐 v4 |
| Motion | framer-motion（Fluid 依赖） | spring presets fast/moderate/slow |
| i18n | 简易 `Record<locale, Record<key, string>>` + `useI18n` hook | 不引入 i18next |
| Agent 接口 | **MCP server（stdio）+ 本地 WS 桥** | 见 §五 |

---

## 二、Monorepo 结构（bun workspace）

```
xuan/
├── package.json                 # { "workspaces": ["packages/*"] }
├── tsconfig.base.json
├── design.md / design.dark.md   # 已存在（Geist 参考层，MVP 不启用）
├── CLAUDE.md                    # 架构文档（铁律要求）
├── README.md
└── packages/
    ├── shared/                  # web + mcp 共享契约
    │   ├── src/
    │   │   ├── types/doc.ts     # XuanDoc / DocNode
    │   │   ├── types/actions.ts # AgentAction union
    │   │   ├── types/format.ts  # FocusedNode / BlurryNode
    │   │   ├── schema/doc.ts    # zod
    │   │   ├── schema/actions.ts
    │   │   ├── format/
    │   │   │   ├── focused.ts   # doc → FocusedNode
    │   │   │   ├── blurry.ts
    │   │   │   └── offset.ts    # chat-origin offset + round-trip rounding
    │   │   ├── icon-slots.ts    # phosphor → Fluid slot 完整映射表
    │   │   └── registry/components.ts
    ├── web/                     # 前端 + WS bridge
    └── mcp/                     # stdio MCP server
```

---

## 三、IconProvider：phosphor 全覆盖

Fluid 文档站预览时用的就是 phosphor，但**安装的组件默认只装 lucide-react**。我们要做的是用 IconProvider 全局覆盖所有 48 个 slot。

**`packages/shared/src/icon-slots.ts`**——一次性映射表：

```ts
import {
  CaretRight, CaretDown, X, Copy, List, Dot,
  Monitor, Sun, Moon, Square, Circle, SquaresFour,
  Clock, Star, Gear, Plus, ArrowLeft, ArrowRight, ArrowUp,
  MagnifyingGlass, Spinner, Users, Lock, Envelope,
  Bell, Shield, PaintBrush, Lightbulb, Rocket,
  Heart, PaintRoller, Brain, Globe, User, Image,
  Link, Check, ArrowCounterClockwise, Play, Pause,
  Eyedropper, House, ChatCircle, Inbox, Pencil,
  SkipForward, ArrowBendDownRight,
} from '@phosphor-icons/react';

// Fluid 48 个 slot → phosphor 组件
export const phosphorIcons = {
  'chevron-right': CaretRight,
  'chevron-down': CaretDown,
  'x': X,
  'copy': Copy,
  'menu': List,
  'dot': Dot,
  'monitor': Monitor,
  'sun': Sun,
  'moon': Moon,
  'rectangle-horizontal': Square,
  'circle': Circle,
  'square-library': SquaresFour,
  'clock': Clock,
  'star': Star,
  'settings': Gear,
  'plus': Plus,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'search': MagnifyingGlass,
  'loader': Spinner,
  'users': Users,
  'lock': Lock,
  'mail': Envelope,
  'bell': Bell,
  'shield': Shield,
  'palette': PaintBrush,
  'lightbulb': Lightbulb,
  'rocket': Rocket,
  'heart': Heart,
  'paintbrush': PaintRoller,
  'brain': Brain,
  'globe': Globe,
  'user': User,
  'image': Image,
  'link': Link,
  'check': Check,
  'rotate-ccw': ArrowCounterClockwise,
  'play': Play,
  'pause': Pause,
  'pipette': Eyedropper,
  'home': House,
  'message-circle': ChatCircle,
  'inbox': Inbox,
  'pencil': Pencil,
  'skip-forward': SkipForward,
  'corner-down-right': ArrowBendDownRight,
} as const;
```

**`packages/web/src/App.tsx`** 顶层包裹：
```tsx
import { IconProvider } from '@/lib/icon-context';
import { phosphorIcons } from '@xuan/shared/icon-slots';

<IconProvider icons={phosphorIcons}>
  <App />
</IconProvider>
```

装 Fluid 时会自动拉 lucide-react 作为 dep（保留但不使用），我们额外装 `@phosphor-icons/react`。

---

## 四、Fluid Base UI flavor 接入

**registry 注册**：
```bash
bunx shadcn@latest registry add @fluid
```

**安装清单（全 Base UI flavor）**：
```bash
bunx shadcn@latest add @fluid/button-base \
  @fluid/input-group @fluid/input-message @fluid/input-copy \
  @fluid/card @fluid/badge \
  @fluid/dialog-base @fluid/dropdown-base \
  @fluid/tabs-base @fluid/tabs-subtle-base \
  @fluid/select-base @fluid/switch-base \
  @fluid/checkbox-group-base @fluid/radio-group-base \
  @fluid/accordion-base @fluid/tooltip-base \
  @fluid/table @fluid/scroll-area-base \
  @fluid/mobile-drawer-base \
  @fluid/surfaces @fluid/springs @fluid/font-weight \
  @fluid/surface-context @fluid/surface-classes \
  @fluid/elevated @fluid/shape-context @fluid/icon-context \
  @fluid/utils @fluid/use-proximity-hover @fluid/use-touch-primary
```

每个 `-base` 组件会自动拉取它声明的 `registryDependencies`（系统项自动解析）。

**peer deps 预装**：
```bash
bun add @base-ui/react framer-motion class-variance-authority clsx tailwind-merge lucide-react @phosphor-icons/react @fontsource-variable/inter
```

> Fluid 文档明确：Base UI 包名是 `@base-ui/react`（前身 `@base-ui-components/react`）。

**`components.json`**：
```json
{
  "style": "default",
  "tailwind": "",
  "tailwindConfig": "",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils"
  },
  "iconLibrary": "lucide"
}
```

---

## 五、数据模型（单一真相源）

**核心原则**：`DocNode[]` 是唯一真相，IA 和 Canvas 是它的两个投影视图。`parentId` 表达父子树。

```ts
// packages/shared/src/types/doc.ts
export type Role = 'root' | 'page' | 'section' | 'component' | 'slot';

// 与 Fluid Base UI flavor 组件名一一对应
export type ComponentName =
  | 'button' | 'input-group' | 'card' | 'badge'
  | 'dialog' | 'dropdown' | 'tabs' | 'tabs-subtle'
  | 'select' | 'switch' | 'checkbox-group' | 'radio-group'
  | 'accordion' | 'tooltip' | 'table' | 'mobile-drawer';

export interface DocNode {
  id: string;
  parentId: string | null;
  role: Role;
  label: { zh: string; en: string };
  component?: {
    name: ComponentName;
    intent: string;              // 内容意图，给 AI 的核心字段
    props?: Record<string, unknown>;
  };
  position?: { x: number; y: number };  // Canvas 几何，IA 忽略
  size?: { width: number; height: number };
  note?: string;                 // 给 AI 的自述
}

export interface XuanDoc {
  version: 1;
  locale: 'zh' | 'en';
  nodes: DocNode[];
  metadata: { name: string; createdAt: number; updatedAt: number };
}
```

**投影函数**（纯函数 + `useMemo`）：
- `toIANodes(doc)`：dagre 算 position，输出 RF Node[]（`type: 'iaNode'`, `draggable: false`）
- `toCanvasNodes(doc)`：用 `node.position`，新节点默认视口中心（`type: 'canvasNode'`, `draggable: true`）
- `toEdges(doc)`：从 `parentId` 派生

**双向同步**：所有用户操作 → 写 `docStore`；两视图 `useDocStore(s => s.doc)` 自动重投影。

---

## 六、web 包结构

```
packages/web/
├── vite.config.ts               # 含 vite-plugin-xuan-bridge（dev WS server @ :4321）
├── components.json              # shadcn/Fluid Base UI 配置
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx                  # IconProvider(phosphor) > I18nProvider > ReactFlowProvider
    ├── theme/globals.css        # Fluid surface token + spring + Inter variable
    ├── lib/
    │   ├── utils.ts             # cn()
    │   ├── icon-context.tsx     # Fluid 安装
    │   └── surface-context.tsx
    ├── i18n/
    │   ├── index.tsx            # I18nProvider + useI18n
    │   ├── zh.ts
    │   └── en.ts
    ├── store/
    │   ├── docStore.ts          # zustand + persist + partialize
    │   └── viewStore.ts         # mode / theme / sidebarOpen
    ├── projections/
    │   ├── toIANodes.ts         # dagre layout
    │   ├── toCanvasNodes.ts
    │   └── toEdges.ts
    ├── components/
    │   ├── ui/                  # shadcn/Fluid `-base` 组件
    │   ├── layout/
    │   │   ├── AppShell.tsx
    │   │   ├── TopBar.tsx       # mode / locale / theme / export
    │   │   └── Sidebar.tsx
    │   ├── flow/
    │   │   ├── IAFlow.tsx
    │   │   ├── CanvasFlow.tsx
    │   │   └── nodes/
    │   │       ├── IANode.tsx   # role badge + label + useOutgoers 子节点数
    │   │       └── CanvasNode.tsx  # component name + intent + 真实 Fluid preview
    │   ├── preview/ComponentPreview.tsx
    │   ├── export/ExportPanel.tsx
    │   └── bridge/WsBridge.ts
    └── types/doc.ts             # re-export from @xuan/shared
```

---

## 七、MCP server + WS 桥架构

**真相源**：web 的 `docStore`（localStorage）。浏览器开着就能用。

**数据流**：
```
Claude/Cursor
    ↕ (stdio)
packages/mcp (McpServer)
    ↕ (WS client @ ws://localhost:4321)
vite-plugin-xuan-bridge (WS server，纯转发，按 sessionId 路由)
    ↕ (WS)
packages/web (操作 docStore → 回包)
```

**vite plugin 职责**：dev 模式启动 WS server @ :4321，纯转发 `{type:'request', id, tool, args}` / `{type:'response', id, result}`，**不存真相**。

**MCP tools**（借鉴 tldraw ActionUtil 注册表 + zod discriminated union + 强制 `intent` 字段）：

| tool | 描述 |
|---|---|
| `list_nodes` | 返回 BlurryNode 列表（id + role + label + 组件名） |
| `get_node` | 返回 FocusedNode（完整字段 + note） |
| `create_node` | role + label + parentId + 可选 component/intent |
| `update_node` | 改 role/label/component/intent/note/props |
| `delete_node` | 删节点 + 递归删子节点 |
| `move_node` | 改 parentId（IA 结构）或 position（Canvas 几何） |
| `bind_component` | 绑 ComponentName + 填 intent |
| `auto_layout` | 触发 dagre 重排 IA |
| `export_json` | 返回完整 XuanDoc JSON（供 AI 生成页面） |
| `import_json` | 从 JSON 重建（AI 反向写入） |

**sanitize 层**（移植 tldraw 思路）：`ensureParentExists` / `ensureIdUnique` / 坐标 offset rounding。

---

## 八、导出 JSON schema（喂 AI 用）

```json
{
  "version": 1,
  "locale": "zh",
  "metadata": { "name": "Landing Page", "updatedAt": 0 },
  "tree": {
    "id": "root", "role": "root", "label": "App",
    "children": [
      { "id": "p1", "role": "page", "label": "首页",
        "children": [
          { "id": "c1", "role": "component", "label": "Hero",
            "component": { "name": "card", "intent": "展示产品核心卖点" } }
        ] }
    ]
  },
  "layout": { "p1": { "x": 100, "y": 200 }, "c1": { "x": 50, "y": 100 } }
}
```

**Why JSON not image/ASCII**（写入 ExportPanel 帮助文字）：图像识别模糊、ASCII 复杂页面乱、token 占用大；JSON 信息密度高 + 结构精确 + AI 反推零噪声。

---

## 九、实施阶段

### Phase 0 · 脚手架（半天）
- bun workspace + 三包骨架 + tsconfig（`bun init`）
- web: Vite + React 19 + TS + Tailwind v4 + `@xyflow/react`
- shared: zod + 类型
- CLAUDE.md 初始版

### Phase 1 · Fluid Base UI 接入 + phosphor + 主题 + i18n（半天）
- `bunx shadcn@latest registry add @fluid`
- 按 §四 装所有 `-base` 组件
- globals.css 接 surface token + spring + Inter variable
- IconProvider 包裹磷or 48 slot 全覆盖（§三）
- I18nProvider（zh/en）+ theme（light/dark）+ AppShell

### Phase 2 · docStore + IA 模式（1 天）
- `docStore` + persist + partialize
- `toIANodes` + `toEdges` + dagre
- `IANode`（role badge + label + `useOutgoers` 子节点数）
- `IAFlow` + Background/Controls/MiniMap
- 顶栏「加节点 / 加子节点 / 删除」

### Phase 3 · Canvas 模式 + 双向同步（1 天）
- `toCanvasNodes`（用 node.position）
- `CanvasNode`（component name + intent + 真实 Fluid preview）
- `CanvasFlow` + 拖拽回写 position
- mode switch（IA / Canvas / Preview），同一 docStore

### Phase 4 · Sidebar 组件库 + Preview（半天）
- `ComponentPreview`（role + component + 真实组件 + props 编辑）
- 拖拽到 Canvas 创建节点（HTML5 DnD）
- example 库（3-5 个预设：表单 / 卡片网格 / 列表项）

### Phase 5 · 导出 JSON（半天）
- `ExportPanel`：树形 JSON 预览 + 复制 + 下载 + AI prompt 模板
- 「Send to AI」按钮：复制 JSON + 引导 prompt 到剪贴板

### Phase 6 · MCP server + WS 桥（1.5 天）
- `vite-plugin-xuan-bridge`：dev WS server @ :4321
- `packages/mcp`：`@modelcontextprotocol/sdk` stdio + WS client
- 10 个 tools（zod schema + 注册表 + sanitize）
- web 端 `WsBridge` 订阅 → 操作 docStore → 回包
- README 写 Claude Desktop / Cursor 配置示例

### Phase 7 · 文档（半天）
- CLAUDE.md（架构总览 + 文件地图）
- README.md（启动 / MCP 配置 / 使用流程）
- AGENTS.md（给 Agent 操作 xuan 的 quick guide）

**预估总工时：5.5 天**（一人 fulltime）

---

## 十、风险与对策

| 风险 | 对策 |
|---|---|
| RF bug #4516（onlyRenderVisibleElements + 固定宽高导致边不渲染） | Canvas 节点不设固定 width/height，用 CSS 自适应 |
| IA 和 Canvas 共用 position 字段冲突 | position 只属 Canvas，IA 由 dagre 实时算 |
| MCP 桥必须开浏览器 + dev server | MVP 接受；README 注明，未来可加 headless node 真相源 |
| Fluid Base UI + Tailwind v4 + Vite 配置坑 | 预留半天调试 |
| phosphor slot 名称对不上 Fluid 内部期望 | 装好后跑一遍每个组件，目检图标； Fluid slot 是命名映射，缺失会 fallback lucide |
| AI 生成 JSON 不规范 | shared zod schema 严校验 + sanitize 层修正 |

---

## 十一、CLAUDE.md 与文档铁律

按 `~/.zcode/AGENTS.md`：
- 架构文档「一文件一句话说清本质，一模块一段话讲透设计」
- 中文 + ASCII 风格分块注释
- 文件架构变更立即更新 CLAUDE.md
- 每次回复以「哥」开头

---

## 十二、MVP 完成标准

- [ ] IA 模式画 3 层思维导图（root → page → component），role/label 正确
- [ ] Canvas 模式看到同样节点用自由坐标摆放，可拖动
- [ ] 任一模式改 role/component/intent，另一模式同步可见
- [ ] 给 component 节点绑 Fluid Base UI 组件 + 填 intent，Canvas 上看到真实 preview
- [ ] 所有图标显示为 phosphor（无 lucide 残留）
- [ ] 导出 JSON 结构清晰可读
- [ ] 把 JSON 喂给 Claude，能生成符合描述的 React 页面（手动验证一次）
- [ ] MCP server 在 Claude Desktop 配置后，能调 `create_node` / `export_json`
- [ ] 中英文切换生效
- [ ] 暗色模式生效
- [ ] 浏览器刷新后 doc 不丢