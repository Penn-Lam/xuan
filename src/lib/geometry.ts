// ============================================================
//  几何工具 —— Canvas 嵌套定位的数学基础
//  坐标系：Canvas 节点存「相对父级」的 rect，渲染时需累加祖先偏移
// ============================================================
import type { FlatNode, Rect, XuanDocument } from "@/types/document"

/** 节点最小尺寸 */
export const MIN_SIZE = 24

/** 将 rect 钳制到父级边界内（保证最小尺寸 + 不超出父框） */
export function clampRect(rect: Rect, parent: Rect): Rect {
  const w = Math.max(MIN_SIZE, Math.min(rect.w, parent.w))
  const h = Math.max(MIN_SIZE, Math.min(rect.h, parent.h))
  const x = Math.max(0, Math.min(rect.x, parent.w - w))
  const y = Math.max(0, Math.min(rect.y, parent.h - h))
  return { x, y, w, h }
}

/** 计算节点的绝对 rect（递归累加祖先偏移） */
export function absoluteRect(doc: XuanDocument, id: string): Rect {
  const canvas = doc.canvas[id]
  if (!canvas) return { x: 0, y: 0, w: 0, h: 0 }

  const node = doc.nodes[id]
  if (!node || node.parentId === null) return { ...canvas.rect }

  const parentAbs = absoluteRect(doc, node.parentId)
  return {
    x: parentAbs.x + canvas.rect.x,
    y: parentAbs.y + canvas.rect.y,
    w: canvas.rect.w,
    h: canvas.rect.h,
  }
}

/** 判断 descendantId 是否 ancestorId 的后代（防止把节点拖进自己的子树） */
export function isDescendant(doc: XuanDocument, ancestorId: string, descendantId: string): boolean {
  let cur: string | null = descendantId
  while (cur !== null) {
    if (cur === ancestorId) return true
    const n: FlatNode | undefined = doc.nodes[cur]
    cur = n?.parentId ?? null
  }
  return false
}

/** 收集某节点的所有后代 ID（含自身可选） */
export function collectDescendants(doc: XuanDocument, id: string, includeSelf = false): string[] {
  const result: string[] = []
  const walk = (nid: string) => {
    if (includeSelf || nid !== id) result.push(nid)
    const n: FlatNode | undefined = doc.nodes[nid]
    n?.childrenIds.forEach(walk)
  }
  walk(id)
  return result
}

/** 计算子树大小（用于删除确认） */
export function subtreeSize(doc: XuanDocument, id: string): number {
  return collectDescendants(doc, id, true).length
}

/** 获取节点的兄弟（同 parent），含自身 */
export function siblings(doc: XuanDocument, id: string): string[] {
  const node = doc.nodes[id]
  if (!node?.parentId) return [id]
  return doc.nodes[node.parentId].childrenIds
}

/* ----------------------- 树形导航（方向键） ----------------------- */

/** 导航目标 ID（不修改文档） */
export function navigateUp(doc: XuanDocument, id: string): string | null {
  const node = doc.nodes[id]
  if (!node) return null
  // 有上一兄弟且未折叠 → 进入其最后一个后代
  const sibs = siblings(doc, id)
  const idx = sibs.indexOf(id)
  if (idx > 0) {
    let cur = sibs[idx - 1]
    // 往下钻到最深的可见后代
    while (true) {
      const c = doc.nodes[cur]
      const mm = doc.mindmap[cur]
      if (!c || c.childrenIds.length === 0 || mm?.collapsed) break
      cur = c.childrenIds[c.childrenIds.length - 1]
    }
    return cur
  }
  // 无上一兄弟 → 返回父级
  return node.parentId
}

export function navigateDown(doc: XuanDocument, id: string): string | null {
  const node = doc.nodes[id]
  if (!node) return null
  const mm = doc.mindmap[id]
  // 有可见子节点 → 第一个子节点
  if (node.childrenIds.length > 0 && !mm?.collapsed) {
    return node.childrenIds[0]
  }
  // 否则 → 下一个兄弟（可能要向上找父级的兄弟）
  let cur: string | null = id
  while (cur) {
    const sibs = siblings(doc, cur)
    const idx = sibs.indexOf(cur)
    if (idx < sibs.length - 1) return sibs[idx + 1]
    const parent: string | null = doc.nodes[cur]?.parentId ?? null
    cur = parent
  }
  return null
}

export function navigateLeft(doc: XuanDocument, id: string): string | null {
  // 左 = 返回父级
  return doc.nodes[id]?.parentId ?? null
}

export function navigateRight(doc: XuanDocument, id: string): string | null {
  // 右 = 第一个子节点（展开）
  const node = doc.nodes[id]
  const mm = doc.mindmap[id]
  if (!node || node.childrenIds.length === 0) return null
  if (mm?.collapsed) return null
  return node.childrenIds[0]
}
