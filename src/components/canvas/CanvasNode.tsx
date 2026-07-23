// ============================================================
//  CanvasNode —— 嵌套绝对定位节点
//  递归渲染子节点；选中时显示 8 方向 resize 手柄
//  多选整组同移；拖中 live 写 rect，松手一条 undo
//  root 本体不拖移（留给框选）；resize 手柄仍可改页面尺寸
// ============================================================
import { memo, useCallback, useRef } from "react"
import { Cube } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { MIN_SIZE, absoluteRect, topLevelSelectedIds } from "@/lib/geometry"
import { cn } from "@/lib/utils"
import type { Rect } from "@/types/document"
import { computeSnap, snapToGrid, useSnapStore } from "./useCanvasSnap"

type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

const HANDLES: ResizeDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

interface CanvasNodeProps {
  nodeId: string
  /** 当前 zoom（网格吸附用） */
  zoom?: number
  snapToComponents?: boolean
  snapToPixelGrid?: boolean
  showPixelGrid?: boolean
}

interface DragItem {
  id: string
  origRect: Rect
  parentRect: Rect
}

function CanvasNodeBase({
  nodeId,
  zoom = 1,
  snapToComponents = true,
  snapToPixelGrid = true,
  showPixelGrid = false,
}: CanvasNodeProps) {
  const document = useEditorStore((s) => s.document)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectNode = useEditorStore((s) => s.selectNode)
  const toggleNodeSelection = useEditorStore((s) => s.toggleNodeSelection)
  const updateCanvasRects = useEditorStore((s) => s.updateCanvasRects)
  const sealHistoryBatch = useEditorStore((s) => s.sealHistoryBatch)
  const setGuides = useSnapStore((s) => s.setGuides)
  const clearGuides = useSnapStore((s) => s.clearGuides)

  const node = document.nodes[nodeId]
  const canvas = document.canvas[nodeId]
  const isSelected = selectedIds.includes(nodeId)

  // 拖拽起点引用（松手 sealHistoryBatch → 一条 undo）
  const dragRef = useRef<{
    startX: number
    startY: number
    mode: "move" | ResizeDir
    /** 参与本次位移的节点（move 可为多选顶层；resize 仅当前节点） */
    items: DragItem[]
    /** 吸附参照：主拖拽节点的兄弟绝对 rect */
    siblingRects: Rect[]
    primaryId: string
    dirty: boolean
  } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: "move" | ResizeDir) => {
      const state = useEditorStore.getState()
      const doc = state.document
      const currentNode = doc.nodes[nodeId]
      if (!currentNode || !doc.canvas[nodeId]) return

      // root 本体移动交给上层框选；resize 手柄仍可改页面尺寸
      if (!currentNode.parentId && mode === "move") {
        if (e.altKey) {
          e.stopPropagation()
          e.preventDefault()
          toggleNodeSelection(nodeId)
        }
        return
      }

      e.stopPropagation()
      e.preventDefault()
      if (e.altKey && mode === "move") {
        toggleNodeSelection(nodeId)
        return
      }

      // 选择策略：已在选区则保持多选；否则单选
      let activeIds = state.selectedIds
      if (!activeIds.includes(nodeId)) {
        selectNode(nodeId)
        activeIds = [nodeId]
      }

      // move：整组顶层选中项（祖先已选的子节点不重复位移）；resize：仅当前节点
      const ids =
        mode === "move" ? topLevelSelectedIds(doc, activeIds) : [nodeId]
      if (ids.length === 0) return
      const movingSet = new Set(ids)

      const items: DragItem[] = ids
        .map((id) => {
          const n = doc.nodes[id]
          const c = doc.canvas[id]
          if (!n || !c) return null
          const parentRect = n.parentId
            ? absoluteRect(doc, n.parentId)
            : { ...c.rect }
          return {
            id,
            origRect: { ...c.rect },
            parentRect,
          }
        })
        .filter((item): item is DragItem => item !== null)

      if (items.length === 0) return

      // 吸附目标：主节点父级下的兄弟，排除本次一起移动的节点
      const siblingRects: Rect[] = []
      if (currentNode.parentId) {
        for (const cid of doc.nodes[currentNode.parentId].childrenIds) {
          if (movingSet.has(cid)) continue
          siblingRects.push(absoluteRect(doc, cid))
        }
      }

      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        mode,
        items,
        siblingRects,
        primaryId: nodeId,
        dirty: false,
      }

      const handleMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const rawDx = (ev.clientX - drag.startX) / zoom
        const rawDy = (ev.clientY - drag.startY) / zoom
        // 亚像素抖动忽略，避免空 commit
        if (!drag.dirty && Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return

        if (drag.mode === "move") {
          const primary = drag.items.find((item) => item.id === drag.primaryId)
          if (!primary) return

          let dx = rawDx
          let dy = rawDy
          let x = primary.origRect.x + dx
          let y = primary.origRect.y + dy

          // 网格吸附（Alt 关闭）——以主节点为准
          if (snapToPixelGrid && !ev.altKey) {
            x = snapToGrid(x, zoom)
            y = snapToGrid(y, zoom)
            dx = x - primary.origRect.x
            dy = y - primary.origRect.y
          }

          // 智能吸附（Alt 关闭）——以主节点为准，delta 广播给整组
          if (
            snapToComponents &&
            !ev.altKey &&
            useEditorStore.getState().document.nodes[drag.primaryId]?.parentId
          ) {
            const absDragRect = {
              x: primary.parentRect.x + x,
              y: primary.parentRect.y + y,
              w: primary.origRect.w,
              h: primary.origRect.h,
            }
            const { adjustedRect, guides } = computeSnap(
              absDragRect,
              drag.siblingRects,
              primary.parentRect,
            )
            x = adjustedRect.x - primary.parentRect.x
            y = adjustedRect.y - primary.parentRect.y
            dx = x - primary.origRect.x
            dy = y - primary.origRect.y
            setGuides(guides)
          }

          drag.dirty = true
          updateCanvasRects(
            drag.items.map((item) => ({
              id: item.id,
              rect: {
                x: item.origRect.x + dx,
                y: item.origRect.y + dy,
                w: item.origRect.w,
                h: item.origRect.h,
              },
            })),
            { history: false },
          )
          return
        }

        // resize：仅主节点
        const primary = drag.items.find((item) => item.id === drag.primaryId)
        if (!primary) return
        let { x, y, w, h } = primary.origRect
        if (drag.mode.includes("e")) w = Math.max(MIN_SIZE, primary.origRect.w + rawDx)
        if (drag.mode.includes("s")) h = Math.max(MIN_SIZE, primary.origRect.h + rawDy)
        if (drag.mode.includes("w")) {
          w = Math.max(MIN_SIZE, primary.origRect.w - rawDx)
          x = primary.origRect.x + (primary.origRect.w - w)
        }
        if (drag.mode.includes("n")) {
          h = Math.max(MIN_SIZE, primary.origRect.h - rawDy)
          y = primary.origRect.y + (primary.origRect.h - h)
        }
        drag.dirty = true
        updateCanvasRects([{ id: drag.primaryId, rect: { x, y, w, h } }], {
          history: false,
        })
      }

      const handleUp = () => {
        const drag = dragRef.current
        dragRef.current = null
        clearGuides()
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
        // 整段拖拽 = 一条 undo
        if (drag?.dirty) sealHistoryBatch()
      }

      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", handleUp)
    },
    [
      nodeId,
      selectNode,
      toggleNodeSelection,
      updateCanvasRects,
      sealHistoryBatch,
      setGuides,
      clearGuides,
      zoom,
      snapToComponents,
      snapToPixelGrid,
    ],
  )

  if (!node || !canvas) return null

  const { rect, shape } = canvas
  const shapeClass =
    shape === "ellipse"
      ? "rounded-full"
      : shape === "text"
        ? "border-dashed bg-background"
        : "rounded-md"

  return (
    <div
      className={cn(
        "canvas-node absolute select-none border bg-secondary/70 transition-colors",
        !node.parentId && showPixelGrid && "canvas-grid-bg",
        shapeClass,
        isSelected ? "border-primary ring-2 ring-ring/50" : "border-border",
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      data-canvas-root={!node.parentId ? "true" : undefined}
      onPointerDown={(e) => handlePointerDown(e, "move")}
    >
      {/* 节点标签 */}
      <div className="pointer-events-none absolute left-1.5 top-1 flex items-center gap-1">
        {node.component && (
          <Cube className="text-primary" width={12} height={12} />
        )}
        <span className="text-xs font-semibold text-foreground drop-shadow-sm">
          {node.name}
        </span>
      </div>

      {/* 递归渲染子节点 */}
      {node.childrenIds.length > 0 && (
        <div className="relative h-full w-full overflow-visible">
          {node.childrenIds.map((cid) => (
            <CanvasNode
              key={cid}
              nodeId={cid}
              zoom={zoom}
              snapToComponents={snapToComponents}
              snapToPixelGrid={snapToPixelGrid}
            />
          ))}
        </div>
      )}

      {/* 选中时显示 resize 手柄 */}
      {isSelected &&
        HANDLES.map((dir) => (
          <div
            key={dir}
            className={cn(
              "absolute size-2 rounded-full border border-primary bg-background",
              handlePositionClass(dir),
            )}
            onPointerDown={(e) => handlePointerDown(e, dir)}
            style={{ cursor: handleCursor(dir) }}
          />
        ))}
    </div>
  )
}

/** resize 手柄位置 class */
function handlePositionClass(dir: ResizeDir): string {
  const map: Record<ResizeDir, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  }
  return map[dir]
}

/** resize 手柄鼠标样式 */
function handleCursor(dir: ResizeDir): string {
  const map: Record<ResizeDir, string> = {
    nw: "nwse-resize",
    n: "ns-resize",
    ne: "nesw-resize",
    e: "ew-resize",
    se: "nwse-resize",
    s: "ns-resize",
    sw: "nesw-resize",
    w: "ew-resize",
  }
  return map[dir]
}

export const CanvasNode = memo(CanvasNodeBase)
