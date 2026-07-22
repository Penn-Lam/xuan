# Radix → Base UI 全项目迁移

2026-07-22 · golden pair via CLI（whole-project）· 完成，0 wrapper 残留 Radix

## 策略

所有 12 个 shadcn wrapper 都是 pristine（`npx shadcn add` 刚装，无定制）。
因此走 golden-pair via CLI：
1. `npx shadcn@latest init --base base --defaults --force` — flip config，
   CLI 自动检测 "switching from radix to base"，重新生成 button + utils + index.css。
   style 从 `new-york` 自动切到 `base-nova`（base 要求 nova style）。
2. `npx shadcn@latest add <全部组件> --overwrite` — 重新生成 card/input/label/
   textarea/tabs/tooltip/dropdown-menu/separator/badge/select/sonner。
3. 手动 sweep 消费者代码（5 处 call-site break）。

## Changed

### Wrapper（全部 CLI 重新生成，pristine overwrite）

- `src/components/ui/button.tsx` — `radix-ui Slot` → `@base-ui/react/button`
- `src/components/ui/card.tsx` — 纯 div 组件，无 primitive
- `src/components/ui/input.tsx` — 原生 input → `@base-ui/react/input`
- `src/components/ui/label.tsx` — `radix-ui Label` → 原生 `<label>`
- `src/components/ui/textarea.tsx` — 原生 textarea
- `src/components/ui/tabs.tsx` — `radix-ui Tabs` → `@base-ui/react/tabs`
- `src/components/ui/tooltip.tsx` — `radix-ui Tooltip` → `@base-ui/react/tooltip`
- `src/components/ui/dropdown-menu.tsx` — `radix-ui DropdownMenu` → `@base-ui/react/menu`
- `src/components/ui/separator.tsx` — `radix-ui Separator` → `@base-ui/react/separator`
- `src/components/ui/badge.tsx` — `radix-ui Slot` → `useRender` + `mergeProps`
- `src/components/ui/select.tsx` — `radix-ui Select` → `@base-ui/react/select`
- `src/components/ui/sonner.tsx` — sonner 不是 radix，未触碰（hard rule）

确认：`grep -rn "radix-ui\|@radix-ui" src/components/ui/` → 无残留。

### 消费者 call-site sweep

| 文件 | 改动 | 原因 |
|---|---|---|
| `src/main.tsx:21` | `delayDuration={300}` → `delay={300}` | TooltipProvider prop 改名 |
| `src/components/shell/Header.tsx:148` | `DropdownMenuTrigger asChild><Button` → `DropdownMenuTrigger className={buttonVariants(...)}` | asChild→render 嵌套 base-ui Button 失效；改用 className 直接样式化 trigger |
| `src/components/shell/PageMenu.tsx:27` | 同上 | 同上 |
| `src/components/inspector/BasicsSection.tsx:49` | `onValueChange={(v) => setRole(v)}` → `if (v) setRole(v)` | Select value 现在是 `string \| null` |
| `src/components/inspector/ComponentSection.tsx:80` | 同上 | 同上 |

### 依赖

- 移除 `radix-ui`（package.json + node_modules）
- 新增 `@base-ui/react@^1.6.0`
- style 从 `new-york` 切到 `base-nova`（CSS 变量 + 默认文档随之变化）

## Left alone

- `sonner.tsx` — sonner 是独立库，非 radix，hard rule 不触碰
- `src/lib/utils.ts` — CLI 重新生成，内容无实质变化（cn 函数不变）

## Behavior changes（flagged，未 patch）

1. **DropdownMenu items 不自动关闭**：base-ui Menu 的 CheckboxItem/RadioItem
   `closeOnClick` 默认 false。当前只用 DropdownMenuItem（普通项），不受影响。
2. **DropdownMenuTrigger render 嵌套失效**：`render={<Button/>}` 时 base-ui Button
   自身也是 render 机制，嵌套后点击事件不冒泡，Menu 不打开。改用
   `className={buttonVariants(...)}` 直接样式化原生 button trigger。
   这是 base-ui 已知的 render 嵌套限制，记录供后续参考。
3. **Select value 可能为 null**：`onValueChange` 的 value 类型从 `string` 变成
   `string | null`，消费者需 null guard。
4. **Style 变化**：从 new-york 切到 base-nova，视觉风格（圆角、间距、默认文档内容）
   有变化。base-nova 的默认文档更语义化（Dashboard Page / Main Menu 等）。

## Verify by hand

- [x] IA 模式思维导图完整渲染（20 节点 20 边）
- [x] Canvas 模式布局 + 工具栏（Select/Rectangle/Ellipse/Text/Grid/Pixels）
- [x] DropdownMenu 点击弹出（Pages、Export 均正常）
- [x] Inspector Select 下拉切换 role/shape/component
- [x] Tooltip hover 延迟（delay=300ms）
- [x] Console 零错误
- [x] `tsc --noEmit` 通过
- [x] `npm run build` 产出 dist

## 最终状态

`grep -rn "radix" src/ package.json` → 0 匹配。**0 wrapper 残留 Radix。**
