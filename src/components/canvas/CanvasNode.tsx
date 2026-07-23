// ============================================================
//  CanvasNode —— 嵌套绝对定位节点
//  仅负责内容渲染 + 拖移；resize 由 SelectionOverlay 统一处理
//  吸附：tldraw BoundsSnaps；Shift 锁轴
// ============================================================
import { memo, useCallback, useRef } from "react"
import { Cube } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { absoluteRect, topLevelSelectedIds } from "@/lib/geometry"
import { cn } from "@/lib/utils"
import type { Rect } from "@/types/document"
import {
  buildSnapTargets,
  createSnapSession,
  unionRects,
  useSnapStore,
  type SnapSession,
} from "./useCanvasSnap"
import {
  applyAxisLock,
  lockedAxisFromDelta,
} from "./selectionHandles"

interface CanvasNodeProps {
  nodeId: string
  zoom?: number
  snapToComponents?: boolean
  snapToPixelGrid?: boolean
  showPixelGrid?: boolean
}

interface DragItem {
  id: string
  origRect: Rect
  origAbs: Rect
  parentRect: Rect
}

function CanvasNodeBase({
  nodeId,
  zoom = 1,
  snapToComponents = true,
  showPixelGrid = false,
}: CanvasNodeProps) {
  const document = useEditorStore((s) => s.document)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectNode = useEditorStore((s) => s.selectNode)
  const toggleNodeSelection = useEditorStore((s) => s.toggleNodeSelection)
  const updateCanvasRects = useEditorStore((s) => s.updateCanvasRects)
  const sealHistoryBatch = useEditorStore((s) => s.sealHistoryBatch)
  const setIndicators = useSnapStore((s) => s.setIndicators)
  const clearGuides = useSnapStore((s) => s.clearGuides)

  const node = document.nodes[nodeId]
  const canvas = document.canvas[nodeId]
  const isSelected = selectedIds.includes(nodeId)

  const dragRef = useRef<{
    startX: number
    startY: number
    items: DragItem[]
    targets: ReturnType<typeof buildSnapTargets>
    dirty: boolean
    session: SnapSession
    groupOrigAbs: Rect
  } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const state = useEditorStore.getState()
      const doc = state.document
      const currentNode = doc.nodes[nodeId]
      if (!currentNode || !doc.canvas[nodeId]) return

      // root 本体留给框选
      if (!currentNode.parentId) {
        if (e.altKey) {
          e.stopPropagation()
          e.preventDefault()
          toggleNodeSelection(nodeId)
        }
        return
      }

      e.stopPropagation()
      e.preventDefault()
      if (e.altKey) {
        toggleNodeSelection(nodeId)
        return
      }

      let activeIds = state.selectedIds
      if (!activeIds.includes(nodeId)) {
        selectNode(nodeId)
        activeIds = [nodeId]
      }

      const ids = topLevelSelectedIds(doc, activeIds)
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
            origAbs: absoluteRect(doc, id),
            parentRect,
          }
        })
        .filter((item): item is DragItem => item !== null)

      if (items.length === 0) return

      const siblingRects: { id: string; bounds: Rect }[] = []
      if (currentNode.parentId) {
        for (const cid of doc.nodes[currentNode.parentId].childrenIds) {
          if (movingSet.has(cid)) continue
          siblingRects.push({ id: cid, bounds: absoluteRect(doc, cid) })
        }
      }

      const parentRect = absoluteRect(doc, currentNode.parentId)
      const canvasRect = absoluteRect(doc, doc.rootId)
      const targets = buildSnapTargets({
        siblingRects,
        parentRect,
        parentId: currentNode.parentId,
        canvasRect,
        canvasId: doc.rootId,
      })
      const groupOrigAbs =
        unionRects(items.map((i) => i.origAbs)) ?? items[0].origAbs

      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        items,
        targets,
        dirty: false,
        session: createSnapSession(),
        groupOrigAbs,
      }

      const handleMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const rawDx = (ev.clientX - drag.startX) / zoom
        const rawDy = (ev.clientY - drag.startY) / zoom
        if (!drag.dirty && Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return

        // Shift：锁轴
        const locked = lockedAxisFromDelta(rawDx, rawDy, ev.shiftKey)
        const lockedDelta = applyAxisLock(rawDx, rawDy, locked)
        let dx = lockedDelta.dx
        let dy = lockedDelta.dy

        const snapOn = snapToComponents && !ev.altKey
        if (snapOn) {
          const result = drag.session.resolveTranslate({
            initialSelectionBounds: drag.groupOrigAbs,
            dragDelta: { x: dx, y: dy },
            targets: drag.targets,
            zoom,
            lockedAxis: locked,
          })
          dx = dx + result.nudgeX
          dy = dy + result.nudgeY
          // 锁轴后再清一次被锁方向的 nudge（防止吸附拉偏）
          if (locked === "x") dx = 0
          if (locked === "y") dy = 0
          setIndicators(result.indicators)
        } else {
          clearGuides()
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
      }

      const handleUp = () => {
        const drag = dragRef.current
        dragRef.current = null
        drag?.session.reset()
        clearGuides()
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
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
      setIndicators,
      clearGuides,
      zoom,
      snapToComponents,
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
        // 选中时淡化边框（选区框由 SelectionOverlay 画）
        isSelected ? "border-ring/40" : "border-border",
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      data-canvas-root={!node.parentId ? "true" : undefined}
      onPointerDown={handlePointerDown}
    >
      <div className="pointer-events-none absolute left-1.5 top-1 flex items-center gap-1">
        {node.component && (
          <Cube className="text-primary" width={12} height={12} />
        )}
        <span className="text-xs font-semibold text-foreground drop-shadow-sm">
          {node.name}
        </span>
      </div>

      {node.childrenIds.length > 0 && (
        <div className="relative h-full w-full overflow-visible">
          {node.childrenIds.map((cid) => (
            <CanvasNode
              key={cid}
              nodeId={cid}
              zoom={zoom}
              snapToComponents={snapToComponents}
              showPixelGrid={showPixelGrid}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const CanvasNode = memo(CanvasNodeBase)
