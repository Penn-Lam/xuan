// ============================================================
//  CanvasEditor —— Canvas 模式容器
//  页面 frame + pan/zoom + 视图开关 + 吸附辅助线 + 绘制工具
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react"
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  Cursor,
  Square,
  GridFour,
  Magnet,
  DotsNine,
  ArrowsInSimple,
} from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { CanvasNode } from "./CanvasNode"
import { useSnapStore, type SnapGuide } from "./useCanvasSnap"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type DrawTool = "select" | "rectangle"

export function CanvasEditor() {
  const document = useEditorStore((s) => s.document)
  const selectNode = useEditorStore((s) => s.selectNode)
  const addNode = useEditorStore((s) => s.addNode)
  const updateCanvasData = useEditorStore((s) => s.updateCanvasData)
  const rootId = document.rootId
  const rootCanvas = document.canvas[rootId]
  const viewport = document.meta.viewport
  const guides = useSnapStore((s) => s.guides)

  // pan/zoom 状态
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  )

  // 工具与视图开关
  const [tool, setTool] = useState<DrawTool>("select")
  const [snapToComponents, setSnapToComponents] = useState(true)
  const [showPixelGrid, setShowPixelGrid] = useState(false)
  const [snapToPixelGrid, setSnapToPixelGrid] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  // 用原生事件监听器处理 wheel（React onWheel 是 passive，无法 preventDefault）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = -e.deltaY * 0.001
        setZoom((z) => Math.min(4, Math.max(0.1, z + delta)))
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 在背景（非节点）上按下时启动 pan（仅 select 工具）
      if (tool !== "select") return
      if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) {
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: pan.x,
          origY: pan.y,
        }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }
    },
    [pan, tool],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = panRef.current
      if (!p) return
      setPan({
        x: p.origX + (e.clientX - p.startX),
        y: p.origY + (e.clientY - p.startY),
      })
    },
    [],
  )

  const handlePointerUp = useCallback(() => {
    panRef.current = null
  }, [])

  const handleBackgroundClick = useCallback(() => {
    if (tool === "select") selectNode(null)
  }, [selectNode, tool])

  // 绘制工具：在背景上拖拽创建子节点
  const drawRef = useRef<{ startX: number; startY: number } | null>(null)
  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tool === "select") return
      const frame = frameRef.current
      if (!frame) return
      const rect = frame.getBoundingClientRect()
      // 转换到 frame 内部坐标（考虑 zoom）
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom
      drawRef.current = { startX: x, startY: y }
    },
    [tool, zoom],
  )

  const handleDrawPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const draw = drawRef.current
      if (!draw || tool === "select") {
        drawRef.current = null
        return
      }
      const frame = frameRef.current
      if (!frame) {
        drawRef.current = null
        return
      }
      const rect = frame.getBoundingClientRect()
      const x2 = (e.clientX - rect.left) / zoom
      const y2 = (e.clientY - rect.top) / zoom

      const w = Math.abs(x2 - draw.startX)
      const h = Math.abs(y2 - draw.startY)

      // 只有足够大的拖拽才创建节点（否则视为点击，切回 select）
      if (w > 10 && h > 10) {
        const newId = addNode(rootId, "New Region", "section")
        // 设置新节点的位置和尺寸（相对 root frame）
        updateCanvasData(newId, {
          rect: {
            x: Math.min(draw.startX, x2),
            y: Math.min(draw.startY, y2),
            w,
            h,
          },
          shape: "rectangle",
          placed: true,
        })
        setTool("select")
      }
      drawRef.current = null
    },
    [tool, zoom, rootId, addNode, updateCanvasData],
  )

  return (
    <div
      ref={containerRef}
      className="canvas-workspace relative h-full w-full overflow-hidden bg-muted/30"
      style={{ cursor: tool === "select" ? "grab" : "crosshair" }}
      onPointerDown={(e) => {
        handlePointerDown(e)
        handleDrawPointerDown(e)
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => {
        handlePointerUp()
        handleDrawPointerUp(e)
      }}
      onClick={handleBackgroundClick}
    >
      <TooltipProvider>
        <div className="pointer-events-auto absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-xs backdrop-blur">
          <ToolButton active={tool === "select"} onClick={() => setTool("select")} label="Select and move components">
            <Cursor />
          </ToolButton>
          <ToolButton active={tool === "rectangle"} onClick={() => setTool("rectangle")} label="Draw rectangle components">
            <Square />
          </ToolButton>
          <ToolButton active={snapToComponents} onClick={() => setSnapToComponents((value) => !value)} label="Snap to other components while dragging">
            <Magnet />
          </ToolButton>
          <ToolButton active={showPixelGrid} onClick={() => setShowPixelGrid((value) => !value)} label="Show pixel grid">
            <GridFour />
          </ToolButton>
          <ToolButton active={snapToPixelGrid} onClick={() => setSnapToPixelGrid((value) => !value)} label="Snap to the pixel grid while dragging">
            <DotsNine />
          </ToolButton>
          <ToolButton onClick={() => setPan({ x: 0, y: 0 })} label="Center view">
            <ArrowsInSimple />
          </ToolButton>
        </div>
      </TooltipProvider>

      {/* 可 pan/zoom 的画布层 */}
      <div
        data-bg="true"
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* 页面 frame */}
        <div
          ref={frameRef}
          data-bg="true"
          className="relative bg-background shadow-lg"
          style={{ width: viewport.width, height: viewport.height }}
          onClick={(e) => e.stopPropagation()}
        >
          {rootCanvas && (
            <CanvasNode
              nodeId={rootId}
              zoom={zoom}
              snapToComponents={snapToComponents}
              snapToPixelGrid={snapToPixelGrid}
              showPixelGrid={showPixelGrid}
            />
          )}

          {tool === "rectangle" && (
            <div className="absolute inset-0 z-30 cursor-crosshair" aria-label="Rectangle drawing surface" />
          )}

          {/* 吸附辅助线层 */}
          {guides.map((g, i) => (
            <SnapGuideLine key={i} guide={g} viewport={viewport} />
          ))}

        </div>
      </div>

      {/* 缩放指示器 */}
      <div className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1 rounded-md border bg-background px-2 py-1 font-mono text-xs shadow-xs">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            setZoom((z) => Math.max(0.1, z - 0.1))
          }}
        >
          <MagnifyingGlassMinus />
        </Button>
        <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation()
            setZoom((z) => Math.min(4, z + 0.1))
          }}
        >
          <MagnifyingGlassPlus />
        </Button>
      </div>
    </div>
  )
}

/** 工具按钮 */
function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? "default" : "ghost"}
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation()
              onClick()
            }}
            aria-label={label}
            aria-pressed={active}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/** 吸附辅助线（红色） */
function SnapGuideLine({
  guide,
  viewport,
}: {
  guide: SnapGuide
  viewport: { width: number; height: number }
}) {
  if (guide.orientation === "v") {
    return (
      <div
        className="pointer-events-none absolute top-0 z-50 bg-red-500"
        style={{ left: guide.position, width: 1, height: viewport.height }}
      />
    )
  }
  return (
    <div
      className="pointer-events-none absolute left-0 z-50 bg-red-500"
      style={{ top: guide.position, height: 1, width: viewport.width }}
    />
  )
}
