// ============================================================
//  CanvasNode —— 嵌套绝对定位节点
//  递归渲染子节点；选中时显示 8 方向 resize 手柄
//  拖拽移动 + resize 写回 store.updateCanvasRect
//  拖拽时智能吸附（兄弟边缘/中心对齐）+ 网格吸附
// ============================================================
import { memo, useCallback, useRef } from "react"
import { Cube } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { MIN_SIZE, absoluteRect } from "@/lib/geometry"
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
  const updateCanvasRect = useEditorStore((s) => s.updateCanvasRect)
  const setGuides = useSnapStore((s) => s.setGuides)
  const clearGuides = useSnapStore((s) => s.clearGuides)

  const node = document.nodes[nodeId]
  const canvas = document.canvas[nodeId]
  const isSelected = selectedIds.includes(nodeId)

  // 拖拽起点引用
  const dragRef = useRef<{
    startX: number
    startY: number
    origRect: Rect
    mode: "move" | ResizeDir
    parentRect: Rect
    siblingRects: Rect[]
  } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: "move" | ResizeDir) => {
      e.stopPropagation()
      e.preventDefault()
      if (e.altKey && mode === "move") {
        toggleNodeSelection(nodeId)
        return
      }
      selectNode(nodeId)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const rect = document.canvas[nodeId].rect
      const parent = node.parentId ? absoluteRect(document, node.parentId) : rect

      // 收集兄弟节点的绝对坐标（排除自身）用于吸附
      const siblingRects: Rect[] = node.parentId
        ? document.nodes[node.parentId].childrenIds
            .filter((cid) => cid !== nodeId)
            .map((cid) => absoluteRect(document, cid))
        : []

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origRect: { ...rect },
        mode,
        parentRect: parent,
        siblingRects,
      }

      const handleMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const dx = (ev.clientX - drag.startX) / zoom
        const dy = (ev.clientY - drag.startY) / zoom
        let { x, y, w, h } = drag.origRect

        if (drag.mode === "move") {
          x = drag.origRect.x + dx
          y = drag.origRect.y + dy
        } else {
          // resize
          if (drag.mode.includes("e")) w = Math.max(MIN_SIZE, drag.origRect.w + dx)
          if (drag.mode.includes("s")) h = Math.max(MIN_SIZE, drag.origRect.h + dy)
          if (drag.mode.includes("w")) {
            w = Math.max(MIN_SIZE, drag.origRect.w - dx)
            x = drag.origRect.x + (drag.origRect.w - w)
          }
          if (drag.mode.includes("n")) {
            h = Math.max(MIN_SIZE, drag.origRect.h - dy)
            y = drag.origRect.y + (drag.origRect.h - h)
          }
        }

        // 网格吸附（Alt 关闭）
        if (snapToPixelGrid && !ev.altKey && mode === "move") {
          x = snapToGrid(x, zoom)
          y = snapToGrid(y, zoom)
        }

        // 智能吸附（仅 move 模式，Alt 关闭）
        if (snapToComponents && mode === "move" && !ev.altKey && node.parentId) {
          // 转绝对坐标做吸附判断
          const absDragRect = {
            x: drag.parentRect.x + x,
            y: drag.parentRect.y + y,
            w,
            h,
          }
          const { adjustedRect, guides } = computeSnap(absDragRect, drag.siblingRects, drag.parentRect)
          // 转回相对坐标
          x = adjustedRect.x - drag.parentRect.x
          y = adjustedRect.y - drag.parentRect.y
          setGuides(guides)
        }

        updateCanvasRect(nodeId, { x, y, w, h })
      }

      const handleUp = () => {
        dragRef.current = null
        clearGuides()
        window.removeEventListener("pointermove", handleMove)
        window.removeEventListener("pointerup", handleUp)
      }

      window.addEventListener("pointermove", handleMove)
      window.addEventListener("pointerup", handleUp)
    },
    [document, node, nodeId, selectNode, toggleNodeSelection, updateCanvasRect, setGuides, clearGuides, zoom, snapToComponents, snapToPixelGrid],
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
