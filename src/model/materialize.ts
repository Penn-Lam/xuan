// ============================================================
//  materialize —— IA→Canvas 桥梁
//  切到 Canvas 时，把所有 placed=false 的节点自动竖向堆入父容器
//  纯函数（produce 包装），无 React 依赖（CLI 复用）
// ============================================================
import { produce } from "immer"
import type { XuanDocument } from "@/types/document"

const GAP = 16 // 兄弟间距 & 父容器内边距
const MIN_H = 80 // 默认块高

/** 对整个文档执行自动布局（仅放置未放置的节点） */
export function materializeDocument(doc: XuanDocument): XuanDocument {
  return produce(doc, (draft) => {
    draft.canvas[draft.rootId].placed = true
    walkMaterialize(draft, draft.rootId)
  })
}

/** 对单个子树重新自动布局（强制重新放置该分支） */
export function materializeSubtree(doc: XuanDocument, rootId: string): XuanDocument {
  return produce(doc, (draft) => {
    walkMaterialize(draft, rootId)
  })
}

/** 递归放置某容器的未放置子节点 */
function walkMaterialize(doc: XuanDocument, containerId: string): void {
  const container = doc.nodes[containerId]
  const frame = doc.canvas[containerId]
  if (!container || !frame) return

  const kids = container.childrenIds.map((id) => ({ id, canvas: doc.canvas[id] }))
  const placed = kids.filter((k) => k.canvas.placed)
  const unplaced = kids.filter((k) => !k.canvas.placed)

  if (unplaced.length > 0) {
    if (placed.length === 0) {
      // 无已放置兄弟：竖向铺满父容器
      const availH = frame.rect.h - GAP * 2 - Math.max(0, unplaced.length - 1) * GAP
      const each = Math.max(MIN_H, availH / unplaced.length)
      unplaced.forEach(({ canvas }, i) => {
        canvas.rect = {
          x: GAP,
          y: GAP + i * (each + GAP),
          w: Math.max(80, frame.rect.w - GAP * 2),
          h: each,
        }
        canvas.placed = true
      })
    } else {
      // 有已放置兄弟：追加到最下方
      let y = Math.max(...placed.map((k) => k.canvas.rect.y + k.canvas.rect.h)) + GAP
      unplaced.forEach(({ canvas }) => {
        canvas.rect = {
          x: GAP,
          y,
          w: Math.max(80, frame.rect.w - GAP * 2),
          h: MIN_H,
        }
        canvas.placed = true
        y += MIN_H + GAP
      })
    }
  }

  // 递归子节点
  container.childrenIds.forEach((cid) => walkMaterialize(doc, cid))
}
