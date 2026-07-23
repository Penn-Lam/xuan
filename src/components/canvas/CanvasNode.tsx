// ============================================================
//  CanvasNode —— 嵌套绝对定位节点
//  递归渲染子节点；选中时显示 8 方向 resize 手柄
//  多选整组同移；拖中 live 写 rect，松手一条 undo
//  root 本体不拖移（留给框选）；智能吸附走 SnapSession
// ============================================================
import { memo, useCallback, useRef } from "react"
import { Cube } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { MIN_SIZE, absoluteRect, topLevelSelectedIds } from "@/lib/geometry"
import { cn } from "@/lib/utils"
import type { Rect } from "@/types/document"
import {
  createSnapSession,
  unionRects,
  useSnapStore,
  type SnapSession,
} from "./useCanvasSnap"

type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

const HANDLES: ResizeDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

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
  /** 拖拽开始时该节点的绝对 rect */
  origAbs: Rect
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
  const setFeedback = useSnapStore((s) => s.setFeedback)
  const clearGuides = useSnapStore((s) => s.clearGuides)

  const node = document.nodes[nodeId]
  const canvas = document.canvas[nodeId]
  const isSelected = selectedIds.includes(nodeId)

  const dragRef = useRef<{
    startX: number
    startY: number
    mode: "move" | ResizeDir
    items: DragItem[]
    targetRects: Rect[]
    parentRect: Rect
    canvasRect: Rect
    primaryId: string
    dirty: boolean
    session: SnapSession
    /** 多选时组外接矩形（相对 orig） */
    groupOrigAbs: Rect
  } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: "move" | ResizeDir) => {
      const state = useEditorStore.getState()
      const doc = state.document
      const currentNode = doc.nodes[nodeId]
      if (!currentNode || !doc.canvas[nodeId]) return

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

      let activeIds = state.selectedIds
      if (!activeIds.includes(nodeId)) {
        selectNode(nodeId)
        activeIds = [nodeId]
      }

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
          const origAbs = absoluteRect(doc, id)
          return {
            id,
            origRect: { ...c.rect },
            origAbs,
            parentRect,
          }
        })
        .filter((item): item is DragItem => item !== null)

      if (items.length === 0) return

      const targetRects: Rect[] = []
      if (currentNode.parentId) {
        for (const cid of doc.nodes[currentNode.parentId].childrenIds) {
          if (movingSet.has(cid)) continue
          targetRects.push(absoluteRect(doc, cid))
        }
      }

      const parentRect = currentNode.parentId
        ? absoluteRect(doc, currentNode.parentId)
        : absoluteRect(doc, doc.rootId)
      const canvasRect = absoluteRect(doc, doc.rootId)
      const groupOrigAbs =
        unionRects(items.map((i) => i.origAbs)) ?? items[0].origAbs

      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        mode,
        items,
        targetRects,
        parentRect,
        canvasRect,
        primaryId: nodeId,
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

        const snapOn = snapToComponents && !ev.altKey

        if (drag.mode === "move") {
          let dx = rawDx
          let dy = rawDy

          const rawGroup: Rect = {
            x: drag.groupOrigAbs.x + dx,
            y: drag.groupOrigAbs.y + dy,
            w: drag.groupOrigAbs.w,
            h: drag.groupOrigAbs.h,
          }

          if (snapOn) {
            const result = drag.session.resolve({
              rawRect: rawGroup,
              targets: drag.targetRects,
              parentRect: drag.parentRect,
              canvasRect: drag.canvasRect,
              zoom,
              mode: "move",
              enableLayoutGrid: true,
              enablePixelGrid: snapToPixelGrid,
            })
            dx += result.deltaX
            dy += result.deltaY
            setFeedback(result.guides, result.measurements)
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
          return
        }

        // resize
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

        // 相对 → 绝对 raw
        let absRect: Rect = {
          x: primary.parentRect.x + x,
          y: primary.parentRect.y + y,
          w,
          h,
        }

        if (snapOn) {
          const edges = {
            n: drag.mode.includes("n"),
            s: drag.mode.includes("s"),
            e: drag.mode.includes("e"),
            w: drag.mode.includes("w"),
          }
          const result = drag.session.resolve({
            rawRect: absRect,
            targets: drag.targetRects,
            parentRect: drag.parentRect,
            canvasRect: drag.canvasRect,
            zoom,
            mode: "resize",
            resizeEdges: edges,
            enableLayoutGrid: false,
            enablePixelGrid: false,
          })
          // resize 候选统一走 sizeDelta / adjustedRect
          absRect = result.adjustedRect
          x = absRect.x - primary.parentRect.x
          y = absRect.y - primary.parentRect.y
          w = Math.max(MIN_SIZE, absRect.w)
          h = Math.max(MIN_SIZE, absRect.h)
          setFeedback(result.guides, result.measurements)
        } else {
          clearGuides()
        }

        drag.dirty = true
        updateCanvasRects([{ id: drag.primaryId, rect: { x, y, w, h } }], {
          history: false,
        })
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
      setFeedback,
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
              snapToPixelGrid={snapToPixelGrid}
            />
          ))}
        </div>
      )}

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
