// ============================================================
//  文档工厂 —— 创建空白页面与默认示例文档
//  纯函数，无 React 依赖（CLI 复用）
//  默认文档 = 导出格式的 JSON 直接反序列化（导出格式 = 默认文档，闭环）
// ============================================================
import { genNodeId } from "@/lib/id"
import type {
  CanvasData,
  FlatNode,
  MindmapData,
  Viewport,
  XuanDocument,
} from "@/types/document"
import { deserializeDocument, parseExportJson } from "./deserialize"
// 默认模板（导出格式的 JSON，deserialize 后即内部扁平模型）
import defaultDocJson from "./default-document.json"

/** 创建一个未放置的扁平节点 */
function makeNode(
  partial: Partial<FlatNode> & Pick<FlatNode, "name" | "role">,
): { node: FlatNode; canvas: CanvasData; mindmap: MindmapData } {
  const id = partial.id ?? genNodeId()
  return {
    node: {
      id,
      parentId: partial.parentId ?? null,
      childrenIds: partial.childrenIds ?? [],
      name: partial.name,
      role: partial.role,
      component: partial.component ?? null,
      content: partial.content ?? null,
    },
    canvas: {
      rect: partial.id ? { x: 0, y: 0, w: 0, h: 0 } : { x: 16, y: 16, w: 80, h: 80 },
      shape: "rectangle",
      placed: false,
    },
    mindmap: { collapsed: false },
  }
}

/** 创建空白页面（仅根节点，尺寸 = viewport） */
export function createBlankPage(name: string, viewport: Viewport): XuanDocument {
  const rootId = "node_root"
  const root = makeNode({ id: rootId, name, role: "page" })
  root.canvas.rect = { x: 0, y: 0, w: viewport.width, h: viewport.height }
  root.canvas.placed = true

  return {
    version: "2.0",
    meta: { name, designSystem: "shadcn/ui@latest", viewport },
    rootId,
    nodes: { [rootId]: root.node },
    canvas: { [rootId]: root.canvas },
    mindmap: { [rootId]: root.mindmap },
  }
}

/**
 * 默认示例文档：Operations Dashboard
 * 直接反序列化导出格式的 JSON——坐标、组件绑定、内容都是精确的
 */
export function createDefaultDocument(): XuanDocument {
  const parsed = parseExportJson(JSON.stringify(defaultDocJson))
  return deserializeDocument(parsed)
}
