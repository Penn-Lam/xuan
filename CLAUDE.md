# xuan（宣）

> Schema-first UI 设计工具。从 PCB CAD 的 "schema first, then layout" 获取灵感。
> IA（信息架构思维导图）+ Canvas（布局画布）双模式，编辑同一棵文档树，导出结构化 JSON 供 AI 生成页面。

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS v4 + React Flow v12 + Zustand + Immer + Zod。
图标用 Phosphor（`@phosphor-icons/react`，全局 `weight: "light"`），字体用 Geist（Fontsource variable 包）。
组件库 shadcn/ui，primitive 用 **Base UI**（`@base-ui/react`，非 Radix），style 为 base-nova。

## 核心哲学

**导出格式 = 文件格式 = Agent 操作格式，三者同构。** infourier 的导出 JSON 本身就是天然的 focused format（tldraw 概念）——扁平、语义清晰、Zod 校验。xuan 把它提升为一切的契约：人用 Web UI 编辑、Agent 用 CLI 操纵 .json、AI 用同一份 JSON 生成代码。

**扁平内部模型 + 双模式免费同步：** 两模式共享一个 `nodes` map，`canvas[id]` 和 `mindmap[id]` 是正交侧表。改一边另一边立即可见，无需同步逻辑。桥梁是 `materialize()`——切到 Canvas 时把未放置节点自动竖向堆入父容器。

## 目录结构（一文件一句话）

```
src/
├── main.tsx                    # 入口：Geist 字体 + Phosphor IconContext + TooltipProvider
├── App.tsx                     # 三栏布局：Header + 编辑区 + Inspector
├── index.css                   # Tailwind v4 @import + Geist Light/Dark CSS 变量
├── types/document.ts           # ★ 文档模型类型 + Zod schema（唯一契约）
├── lib/
│   ├── utils.ts                # cn() shadcn 标准工具
│   ├── id.ts                   # nanoid 包装（genNodeId/genPageId）
│   └── geometry.ts             # clampRect/absoluteRect/isDescendant/collectDescendants
├── model/                      # 纯函数层，无 React 依赖（CLI 也复用）
│   ├── factories.ts            # createBlankPage/createDefaultDocument（默认文档=JSON 反序列化）
│   ├── default-document.json   # 默认模板（Operations Dashboard，导出格式）
│   ├── materialize.ts          # ★ IA→Canvas 桥梁：自动放置未定位节点
│   ├── serialize.ts            # 扁平→嵌套导出树（相对坐标→绝对坐标）
│   └── deserialize.ts          # 嵌套→扁平导入（绝对→相对）
├── store/
│   ├── useEditorStore.ts       # ★ Zustand store：document+pages+undo/redo+persist
│   ├── undo.ts                 # immer patch-based undo/redo（past/future 栈）
│   └── catalog.ts              # role 语义角色 + shadcn 组件目录
├── components/
│   ├── ui/                     # shadcn 组件
│   ├── shell/                  # Header（页面名/模式/导入导出）+ Inspector + PageMenu
│   ├── mindmap/                # IA 模式：React Flow + d3.tree + 自定义节点
│   ├── canvas/                 # Canvas 模式：手写嵌套绝对定位 + 拖拽/resize
│   └── inspector/              # Basics/Component/Content/NodePreview 四个区块
└── prompts/generation.ts       # AI 生成 prompt 模板
```

## 模块设计

### 文档模型（types/document.ts）
唯一真相源。内部用扁平树（`nodes` map + parentId/childrenIds），导出用嵌套树（绝对坐标）。Zod schema 校验导出格式。

### model 层
纯函数，无 React 依赖。`materialize/serialize/deserialize/factories` 都是 CLI 可直接复用的。这是「导出格式 = Agent 格式」的技术基础。

### store
Zustand + Immer + 手写 patch undo/redo + persist。persist 只存 `pages + activePageId`（会话态不持久化）。`History<T>` 类管理 past/future 栈，上限 100。

### IA 模式
React Flow v12 + `d3-hierarchy` 的 `d3.tree().nodeSize([104, 284])`。从扁平树生成 RF nodes/edges，自定义 mindmap 节点（白卡片 + role badge + 折叠开关）。

### Canvas 模式
手写嵌套绝对定位 div。`CanvasNode` 递归渲染子节点，选中时显示 8 方向 resize 手柄。拖拽移动和 resize 都通过 pointer 事件 + `updateCanvasRect` 写回 store。

## 设计系统

遵循 `design.md`（Light）/ `design.dark.md`（Dark）的 Geist token。`--primary` 用 Geist 原色 `#171717`/`#ededed`（非 infourier 的 `#0900ff`）。`--ring` 用 `#006bff`/`#47a8ff`，`--radius: 0.375rem`。

## 当前进度

- [x] **Phase 1**：基础骨架 + 最小可运行闭环（IA/Canvas 双模式 + 导入导出 + Inspector）
- [ ] **Phase 2**：交互完善（键盘快捷键 + 吸附辅助线 + 绘制工具 + 多页管理）
- [ ] **Phase 3**：i18n 中英文 + Inspector shadcn 预览增强 + xuan CLI（Agent 接口）
