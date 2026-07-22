// ============================================================
//  xuan 文档模型 —— 唯一契约
//  导出格式 = 文件格式 = Agent 操作格式，三者同构
// ============================================================
import { z } from "zod"

/* ----------------------------- 基础几何 ----------------------------- */

/** 矩形（x/y 为左上角坐标） */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 节点形状 */
export type NodeShape = "rectangle" | "ellipse" | "text"

/* ------------------------- 内部扁平模型（存储） ------------------------- */

/** 扁平节点 —— 内部存储形态，双模式共用 */
export interface FlatNode {
  id: string
  parentId: string | null
  childrenIds: string[]
  /** 人类可读标签 */
  name: string
  /** 语义角色：page / header / card / ...（见 catalog） */
  role: string
  /** shadcn 组件绑定 */
  component: { ref: string; props: Record<string, unknown> } | null
  /** 内容意图（任意 JSON） */
  content: Record<string, unknown> | null
}

/** 单节点在 Canvas 侧的几何与状态 */
export interface CanvasData {
  rect: Rect
  shape: NodeShape
  /** 是否已手动放置（false 时切到 Canvas 会自动布局） */
  placed: boolean
}

/** 单节点在 Mindmap 侧的状态 */
export interface MindmapData {
  collapsed: boolean
}

/** 页面尺寸预设 */
export interface Viewport {
  width: number
  height: number
}

/** 文档元信息 */
export interface DocMeta {
  name: string
  designSystem: string
  viewport: Viewport
}

/** xuan 文档 —— 单一真相源 */
export interface XuanDocument {
  version: "2.0"
  meta: DocMeta
  rootId: string
  /** 扁平节点 map */
  nodes: Record<string, FlatNode>
  /** 各节点的 Canvas 几何（正交侧表） */
  canvas: Record<string, CanvasData>
  /** 各节点的 Mindmap 状态（正交侧表） */
  mindmap: Record<string, MindmapData>
}

/* --------------------- 导出 / Agent 格式（嵌套树） --------------------- */

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
})

export const NodeShapeSchema = z.enum(["rectangle", "ellipse", "text"])

/** 递归节点 schema —— 导出格式（绝对坐标） */
export const ExportNodeSchema: z.ZodType<ExportNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    rect: RectSchema,
    shape: NodeShapeSchema,
    component: z
      .object({
        ref: z.string(),
        props: z.record(z.string(), z.unknown()),
      })
      .nullable(),
    content: z.record(z.string(), z.unknown()).nullable(),
    children: z.array(ExportNodeSchema),
  }),
)

export interface ExportNode {
  id: string
  name: string
  role: string
  rect: Rect
  shape: NodeShape
  component: { ref: string; props: Record<string, unknown> } | null
  content: Record<string, unknown> | null
  children: ExportNode[]
}

/** 文档 schema —— 导出格式 = Agent 工作格式 */
export const ExportDocSchema = z.object({
  version: z.literal("2.0"),
  meta: z.object({
    name: z.string(),
    designSystem: z.string(),
    viewport: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }),
  }),
  tree: ExportNodeSchema,
})

export type ExportDoc = z.infer<typeof ExportDocSchema>

/* --------------------------- 页面尺寸预设 --------------------------- */

export interface PagePreset {
  id: string
  label: string
  width: number
  height: number
}

export const PAGE_PRESETS: PagePreset[] = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
]
