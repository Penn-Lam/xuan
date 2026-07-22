// ============================================================
//  deserialize —— 嵌套导出树（绝对坐标）→ 扁平内部模型（相对坐标）
//  导入 = 导出的逆运算；校验后重建 nodes/canvas/mindmap
//  纯函数，无 React 依赖（CLI 复用）
// ============================================================
import type {
  CanvasData,
  ExportDoc,
  FlatNode,
  MindmapData,
  Rect,
  XuanDocument,
} from "@/types/document"
import { ExportDocSchema } from "@/types/document"

/** 解析 + 校验 JSON 字符串为 ExportDoc */
export function parseExportJson(json: string): ExportDoc {
  const raw = JSON.parse(json)
  return ExportDocSchema.parse(raw)
}

/** 将校验后的 ExportDoc 重建为扁平内部模型（绝对坐标 → 相对父级） */
export function deserializeDocument(parsed: ExportDoc): XuanDocument {
  const nodes: Record<string, FlatNode> = {}
  const canvas: Record<string, CanvasData> = {}
  const mindmap: Record<string, MindmapData> = {}

  const walk = (
    exportNode: ExportDoc["tree"],
    parentId: string | null,
    parentAbs: Rect | null,
  ): void => {
    const abs = exportNode.rect
    // 转相对坐标：减去父级绝对偏移
    const rel: Rect = parentAbs
      ? { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y, w: abs.w, h: abs.h }
      : { x: abs.x, y: abs.y, w: abs.w, h: abs.h }

    nodes[exportNode.id] = {
      id: exportNode.id,
      parentId,
      childrenIds: exportNode.children.map((c) => c.id),
      name: exportNode.name,
      role: exportNode.role,
      component: exportNode.component,
      content: exportNode.content,
    }
    canvas[exportNode.id] = {
      rect: rel,
      shape: exportNode.shape,
      placed: true,
    }
    mindmap[exportNode.id] = { collapsed: false }

    exportNode.children.forEach((child) => walk(child, exportNode.id, abs))
  }

  walk(parsed.tree, null, null)

  return {
    version: "2.0",
    meta: parsed.meta,
    rootId: parsed.tree.id,
    nodes,
    canvas,
    mindmap,
  }
}

/** 一步到位：JSON 字符串 → 内部模型 */
export function importFromJson(json: string): XuanDocument {
  return deserializeDocument(parseExportJson(json))
}
