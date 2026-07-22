// ============================================================
//  serialize —— 扁平内部模型 → 嵌套导出树（绝对坐标）
//  导出格式 = Agent 工作格式 = AI 输入
//  纯函数，无 React 依赖（CLI 复用）
// ============================================================
import type {
  ExportDoc,
  ExportNode,
  Rect,
  XuanDocument,
} from "@/types/document"
import { ExportDocSchema } from "@/types/document"
import { materializeDocument } from "./materialize"

/** 序列化单个子树（origin 为父级绝对偏移） */
function serializeNode(doc: XuanDocument, id: string, origin: { x: number; y: number }): ExportNode {
  const node = doc.nodes[id]
  const canvas = doc.canvas[id]
  const local = canvas.rect

  // 转绝对坐标
  const absRect: Rect = {
    x: origin.x + local.x,
    y: origin.y + local.y,
    w: local.w,
    h: local.h,
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    rect: absRect,
    shape: canvas.shape,
    component: node.component,
    content: node.content,
    children: node.childrenIds.map((cid) =>
      serializeNode(doc, cid, { x: absRect.x, y: absRect.y }),
    ),
  }
}

/** 导出整个文档（若有未放置节点，先自动布局） */
export function serializeDocument(doc: XuanDocument): ExportDoc {
  const materialized = materializeDocument(doc)
  const tree = serializeNode(materialized, materialized.rootId, { x: 0, y: 0 })
  const result = {
    version: "2.0" as const,
    meta: materialized.meta,
    tree,
  }
  return ExportDocSchema.parse(result)
}
