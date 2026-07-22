// ============================================================
//  useMindmapTree —— 扁平文档树 → React Flow nodes/edges
//  用 d3-hierarchy 的 d3.tree() 计算从左到右的布局
// ============================================================
import { useMemo } from "react"
import { stratify, tree } from "d3-hierarchy"
import type { Node, Edge } from "@xyflow/react"
import type { XuanDocument } from "@/types/document"

export interface MindmapNodeData {
  name: string
  role: string
  nodeId: string
  collapsed: boolean
  childCount: number
  hasComponent: boolean
  /** 折叠切换回调（运行时注入，不参与布局计算） */
  onToggleCollapse?: (id: string) => void
  [key: string]: unknown
}

/** nodeSize：[高度, 兄弟间距]（从左到右布局，d3 的 x=纵向 y=横向） */
const NODE_HEIGHT = 104
const SIBLING_GAP = 284

export function useMindmapTree(doc: XuanDocument): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    // 收集可见节点（折叠的父节点的子树跳过）
    const visible = new Set<string>([doc.rootId])
    const queue = [doc.rootId]
    while (queue.length > 0) {
      const id = queue.shift()!
      const node = doc.nodes[id]
      const mm = doc.mindmap[id]
      if (!node) continue
      if (mm?.collapsed) continue // 折叠了，不展开子节点
      for (const cid of node.childrenIds) {
        visible.add(cid)
        queue.push(cid)
      }
    }

    // 过滤出可见节点
    const visibleNodes = Object.values(doc.nodes).filter((n) => visible.has(n.id))
    if (visibleNodes.length === 0) return { nodes: [], edges: [] }

    // d3 stratify 需要扁平数据带 id / parentId
    const stratifyFn = stratify<{ id: string; name: string }>()
      .id((d) => d.id)
      .parentId((d) => {
        const n = doc.nodes[d.id]
        return n?.parentId
      })

    const root = stratifyFn(visibleNodes.map((n) => ({ id: n.id, name: n.name })))

    // 从左到右树布局
    const treeLayout = tree<typeof root.data>().nodeSize([NODE_HEIGHT, SIBLING_GAP])
    const layoutRoot = treeLayout(root)

    // 转 React Flow 格式（注意 d3 x=纵向, y=横向；RF x=横向, y=纵向）
    const nodes: Node<MindmapNodeData>[] = []
    const edges: Edge[] = []

    layoutRoot.descendants().forEach((d) => {
      const id = d.data.id
      const node = doc.nodes[id]
      const mm = doc.mindmap[id]
      if (!node) return

      nodes.push({
        id,
        type: "mindmap",
        position: { x: d.y, y: d.x },
        data: {
          name: node.name,
          role: node.role,
          nodeId: id,
          collapsed: mm?.collapsed ?? false,
          childCount: node.childrenIds.length,
          hasComponent: !!node.component,
        },
        draggable: true,
      })

      d.children?.forEach((child) => {
        edges.push({
          id: `${id}->${child.data.id}`,
          source: id,
          target: child.data.id,
          type: "default",
        })
      })
    })

    return { nodes, edges }
  }, [doc])
}
