// ============================================================
//  CanvasNode —— 嵌套绝对定位节点
//  拖移 + Shift 锁轴 + Alt-拖复制 + 边缘滚动
//  resize 由 SelectionOverlay 统一处理
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
import { useCanvasViewport } from "./CanvasViewportContext"
import { TextRenderer } from "./TextRenderer"

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

function buildDragItems(doc: ReturnType<typeof useEditorStore.getState>["document"], ids: string[]): DragItem[] {
  return ids
    .map((id) => {
      const n = doc.nodes[id]
      const c = doc.canvas[id]
      if (!n?.parentId || !c) return null
      return {
        id,
        origRect: { ...c.rect },
        origAbs: absoluteRect(doc, id),
        parentRect: absoluteRect(doc, n.parentId),
      }
    })
    .filter((item): item is DragItem => item !== null)
}

function CanvasNodeBase({
  nodeId,
  zoom: zoomProp = 1,
  snapToComponents = true,
  showPixelGrid = false,
}: CanvasNodeProps) {
  const viewport = useCanvasViewport()
  const zoom = viewport.zoom || zoomProp

  const document = useEditorStore((s) => s.document)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectNode = useEditorStore((s) => s.selectNode)
  const selectNodes = useEditorStore((s) => s.selectNodes)
  const toggleNodeSelection = useEditorStore((s) => s.toggleNodeSelection)
  const updateCanvasRects = useEditorStore((s) => s.updateCanvasRects)
  const sealHistoryBatch = useEditorStore((s) => s.sealHistoryBatch)
  const duplicateNodesInPlace = useEditorStore((s) => s.duplicateNodesInPlace)
  const setIndicators = useSnapStore((s) => s.setIndicators)
  const clearGuides = useSnapStore((s) => s.clearGuides)

  const node = document.nodes[nodeId]
  const canvas = document.canvas[nodeId]
  const isSelected = selectedIds.includes(nodeId)

  const dragRef = useRef<{
    startX: number
    startY: number
    startPanX: number
    startPanY: number
    items: DragItem[]
    targets: ReturnType<typeof buildSnapTargets>
    dirty: boolean
    session: SnapSession
    groupOrigAbs: Rect
    altAtDown: boolean
    wasInSelection: boolean
    duplicated: boolean
    sourceIds: string[]
  } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const state = useEditorStore.getState()
      const doc = state.document
      const currentNode = doc.nodes[nodeId]
      if (!currentNode || !doc.canvas[nodeId]) return

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

      const altAtDown = e.altKey
      const wasInSelection = state.selectedIds.includes(nodeId)

      // 普通点击：单选；Alt：加入选区（纯点击 up 时再决定 toggle off）
      if (!altAtDown) {
        if (!wasInSelection) selectNode(nodeId)
      } else if (!wasInSelection) {
        selectNodes([...state.selectedIds, nodeId])
      }

      const activeIds = useEditorStore.getState().selectedIds
      const ids = topLevelSelectedIds(
        useEditorStore.getState().document,
        activeIds,
      ).filter((id) => useEditorStore.getState().document.nodes[id]?.parentId != null)
      if (ids.length === 0) return

      const liveDoc = useEditorStore.getState().document
      const items = buildDragItems(liveDoc, ids)
      if (items.length === 0) return
      const movingSet = new Set(ids)

      const siblingRects: { id: string; bounds: Rect }[] = []
      if (currentNode.parentId) {
        for (const cid of liveDoc.nodes[currentNode.parentId].childrenIds) {
          if (movingSet.has(cid)) continue
          siblingRects.push({ id: cid, bounds: absoluteRect(liveDoc, cid) })
        }
      }

      const parentRect = absoluteRect(liveDoc, currentNode.parentId)
      const canvasRect = absoluteRect(liveDoc, liveDoc.rootId)
      const targets = buildSnapTargets({
        siblingRects,
        parentRect,
        parentId: currentNode.parentId,
        canvasRect,
        canvasId: liveDoc.rootId,
      })
      const groupOrigAbs =
        unionRects(items.map((i) => i.origAbs)) ?? items[0].origAbs

      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      // 只记录起始 pan；真正拖拽越过阈值后再 enable 边缘滚动
      const startPan = viewport.edgeScroll.begin(e.clientX, e.clientY)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: startPan.panX,
        startPanY: startPan.panY,
        items,
        targets,
        dirty: false,
        session: createSnapSession(),
        groupOrigAbs,
        altAtDown,
        wasInSelection,
        duplicated: false,
        sourceIds: ids,
      }

      const handleMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return

        viewport.edgeScroll.tick(ev.clientX, ev.clientY)
        const { dx: rawDx0, dy: rawDy0 } = viewport.clientDeltaToDoc(
          ev.clientX,
          ev.clientY,
          drag.startX,
          drag.startY,
          drag.startPanX,
          drag.startPanY,
        )
        if (!drag.dirty && Math.abs(rawDx0) < 0.5 && Math.abs(rawDy0) < 0.5) return

        // 确认拖拽后才开边缘滚动（防止 click 误推 pan）
        if (!drag.dirty) viewport.edgeScroll.enable()

        // Alt-拖：越过阈值后复制并改拖副本
        if (drag.altAtDown && !drag.duplicated) {
          const newIds = duplicateNodesInPlace(drag.sourceIds)
          if (newIds.length > 0) {
            const fresh = useEditorStore.getState().document
            drag.items = buildDragItems(fresh, newIds)
            drag.groupOrigAbs =
              unionRects(drag.items.map((i) => i.origAbs)) ??
              drag.items[0].origAbs
            drag.duplicated = true
          }
        }

        const locked = lockedAxisFromDelta(rawDx0, rawDy0, ev.shiftKey)
        const lockedDelta = applyAxisLock(rawDx0, rawDy0, locked)
        let dx = lockedDelta.dx
        let dy = lockedDelta.dy

        // 非 Alt-拖 时 Alt 关闭吸附；Alt-拖复制过程中保持吸附
        const allowSnap =
          snapToComponents && (!ev.altKey || drag.altAtDown || drag.duplicated)

        if (allowSnap) {
          const result = drag.session.resolveTranslate({
            initialSelectionBounds: drag.groupOrigAbs,
            dragDelta: { x: dx, y: dy },
            targets: drag.targets,
            zoom,
            lockedAxis: locked,
          })
          dx += result.nudgeX
          dy += result.nudgeY
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
        viewport.edgeScroll.end()
        drag?.session.reset()
        clearGuides()
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)

        // Alt 纯点击：若按下前已在选区 → 取消选中
        if (drag && !drag.dirty && drag.altAtDown && drag.wasInSelection) {
          toggleNodeSelection(nodeId)
        }

        if (drag?.dirty) sealHistoryBatch()
      }

      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", handleUp)
    },
    [
      nodeId,
      selectNode,
      selectNodes,
      toggleNodeSelection,
      updateCanvasRects,
      sealHistoryBatch,
      duplicateNodesInPlace,
      setIndicators,
      clearGuides,
      zoom,
      snapToComponents,
      viewport,
    ],
  )

  if (!node || !canvas) return null

  const { rect, shape } = canvas
  const shapeClass =
    shape === "ellipse"
      ? "rounded-full"
      : shape === "text"
        ? "bg-background"
        : "rounded-md"

  return (
    <div
      className={cn(
        "canvas-node absolute select-none bg-secondary/70 transition-colors",
        !node.parentId && showPixelGrid && "canvas-grid-bg",
        shapeClass,
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      data-canvas-root={!node.parentId ? "true" : undefined}
      onPointerDown={handlePointerDown}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 border",
          shape === "ellipse"
            ? "rounded-full"
            : shape === "text"
              ? "border-dashed"
              : "rounded-md",
          isSelected ? "border-ring/40" : "border-border",
        )}
      />
      <TextRenderer
        role={node.role}
        height={rect.h}
        isEditing={isSelected && shape === "text"}
        leading={node.component ? (
          <Cube className="shrink-0 text-primary" width={12} height={12} />
        ) : undefined}
      >
        {node.name}
      </TextRenderer>

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
