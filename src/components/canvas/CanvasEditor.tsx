// ============================================================
//  CanvasEditor —— Canvas 模式容器
//  页面 frame + pan/zoom + 框选 + 视图开关 + 吸附辅助线 + 绘制工具
//  pan：中键 / Space+拖；框选：select 工具在空白处拖
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
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  AlignCenterHorizontalSimple,
  AlignCenterVerticalSimple,
} from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { hitTestMarquee, topLevelSelectedIds } from "@/lib/geometry"
import type { Rect } from "@/types/document"
import { CanvasNode } from "./CanvasNode"
import { SelectionOverlay } from "./SelectionOverlay"
import { SnapOverlay } from "./SnapOverlay"
import { CanvasViewportProvider } from "./CanvasViewportContext"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useI18n } from "@/lib/i18n"

type DrawTool = "select" | "rectangle"

const MARQUEE_MIN = 3

/** client 坐标 → frame 内坐标（已除 zoom） */
function clientToFrame(
  clientX: number,
  clientY: number,
  frame: DOMRect,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (clientX - frame.left) / zoom,
    y: (clientY - frame.top) / zoom,
  }
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  }
}

export function CanvasEditor() {
  const { t } = useI18n()
  const document = useEditorStore((s) => s.document)
  const selectNode = useEditorStore((s) => s.selectNode)
  const selectNodes = useEditorStore((s) => s.selectNodes)
  const addNode = useEditorStore((s) => s.addNode)
  const updateCanvasData = useEditorStore((s) => s.updateCanvasData)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const removeNodes = useEditorStore((s) => s.removeNodes)
  const updateCanvasRects = useEditorStore((s) => s.updateCanvasRects)
  const alignNodes = useEditorStore((s) => s.alignNodes)
  const distributeNodes = useEditorStore((s) => s.distributeNodes)
  const rootId = document.rootId
  const rootCanvas = document.canvas[rootId]
  const viewport = document.meta.viewport

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

  // Space 按住 → pan 模式
  const [spaceHeld, setSpaceHeld] = useState(false)
  const spaceHeldRef = useRef(false)

  // 框选
  const marqueeRef = useRef<{
    startX: number
    startY: number
    additive: boolean
    baseIds: string[]
  } | null>(null)
  const marqueeBoxRef = useRef<Rect | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  /** 刚完成框选时抑制 background click 清空 */
  const suppressClickRef = useRef(false)

  // 滚轮缩放：以光标为不动点（ctrl/meta + wheel）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()

      const rect = el.getBoundingClientRect()
      // 指针相对容器
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const cx = rect.width / 2
      const cy = rect.height / 2

      const delta = -e.deltaY * 0.001
      setZoom((z0) => {
        const z1 = Math.min(4, Math.max(0.1, z0 + delta))
        if (z1 === z0) return z0
        // 保持光标下内容点不动：
        // sx = cx + pan.x + z * localX  →  pan' = sx - cx - z' * (sx - cx - pan) / z
        setPan((p0) => ({
          x: sx - cx - (z1 * (sx - cx - p0.x)) / z0,
          y: sy - cy - (z1 * (sy - cy - p0.y)) / z0,
        }))
        return z1
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  // Space 跟踪（忽略输入框）
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      )
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTypingTarget(e.target)) return
      e.preventDefault()
      spaceHeldRef.current = true
      setSpaceHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }
    const onBlur = () => {
      spaceHeldRef.current = false
      setSpaceHeld(false)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  // 方向键连击/长按合并为一条 undo：live 更新 + 停顿后 seal
  const NUDGE_SEAL_MS = 400
  const nudgeSealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sealHistoryBatch = useEditorStore((s) => s.sealHistoryBatch)

  const scheduleNudgeSeal = useCallback(() => {
    if (nudgeSealTimerRef.current) clearTimeout(nudgeSealTimerRef.current)
    nudgeSealTimerRef.current = setTimeout(() => {
      nudgeSealTimerRef.current = null
      sealHistoryBatch()
    }, NUDGE_SEAL_MS)
  }, [sealHistoryBatch])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      )
    }

    const arrowKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      if ((event.key === "Backspace" || event.key === "Delete") && selectedIds.length > 0) {
        // delete 走 commit，store 会自动 seal 未收口的微移 batch
        event.preventDefault()
        if (nudgeSealTimerRef.current) {
          clearTimeout(nudgeSealTimerRef.current)
          nudgeSealTimerRef.current = null
        }
        removeNodes(selectedIds)
        return
      }

      // 方向键微移：Shift = 10px，否则 1px；连击合并一条 undo
      if (arrowKeys.has(event.key) && selectedIds.length > 0) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0
        if (event.key === "ArrowLeft") dx = -step
        if (event.key === "ArrowRight") dx = step
        if (event.key === "ArrowUp") dy = -step
        if (event.key === "ArrowDown") dy = step

        const doc = useEditorStore.getState().document
        const ids = topLevelSelectedIds(doc, selectedIds)
        const updates = ids
          .map((id) => {
            const rect = doc.canvas[id]?.rect
            if (!rect) return null
            return {
              id,
              rect: { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h },
            }
          })
          .filter((u): u is { id: string; rect: Rect } => u !== null)
        if (updates.length > 0) {
          updateCanvasRects(updates, { history: false })
          scheduleNudgeSeal()
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!arrowKeys.has(event.key)) return
      // 抬起后重新计时：长按松手 / 连点间隔都靠 debounce 收口成一条
      scheduleNudgeSeal()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      if (nudgeSealTimerRef.current) {
        clearTimeout(nudgeSealTimerRef.current)
        nudgeSealTimerRef.current = null
      }
      // 卸载时收口，避免 batch 悬空
      sealHistoryBatch()
    }
  }, [removeNodes, selectedIds, updateCanvasRects, scheduleNudgeSeal, sealHistoryBatch])

  const isEmptyTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null
    if (!el) return false
    return Boolean(el.dataset.bg || el.dataset.canvasRoot)
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tool !== "select") return
      if (!isEmptyTarget(e.target)) return

      const wantsPan =
        e.button === 1 || e.button === 2 || spaceHeldRef.current || e.altKey

      if (wantsPan) {
        e.preventDefault()
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: pan.x,
          origY: pan.y,
        }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        return
      }

      // 左键空白 → 框选（需 frame 坐标系）
      if (e.button !== 0) return
      const frame = frameRef.current
      if (!frame) return
      const frameRect = frame.getBoundingClientRect()
      const { x, y } = clientToFrame(e.clientX, e.clientY, frameRect, zoom)
      const state = useEditorStore.getState()
      marqueeRef.current = {
        startX: x,
        startY: y,
        additive: e.shiftKey,
        baseIds: e.shiftKey ? [...state.selectedIds] : [],
      }
      const initial = { x, y, w: 0, h: 0 }
      marqueeBoxRef.current = initial
      setMarquee(initial)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pan, tool, zoom],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = panRef.current
      if (p) {
        setPan({
          x: p.origX + (e.clientX - p.startX),
          y: p.origY + (e.clientY - p.startY),
        })
        return
      }

      const m = marqueeRef.current
      if (!m) return
      const frame = frameRef.current
      if (!frame) return
      const frameRect = frame.getBoundingClientRect()
      const { x, y } = clientToFrame(e.clientX, e.clientY, frameRect, zoom)
      const rect = normalizeRect(m.startX, m.startY, x, y)
      marqueeBoxRef.current = rect
      setMarquee(rect)

      // 拖动过程中实时高亮命中
      const doc = useEditorStore.getState().document
      const hits = hitTestMarquee(doc, rect)
      if (m.additive) {
        const set = new Set([...m.baseIds, ...hits])
        selectNodes([...set])
      } else {
        selectNodes(hits)
      }
    },
    [selectNodes, zoom],
  )

  const handlePointerUp = useCallback(() => {
    const wasPanning = panRef.current !== null
    panRef.current = null

    const m = marqueeRef.current
    if (m) {
      const box = marqueeBoxRef.current
      marqueeRef.current = null
      marqueeBoxRef.current = null
      setMarquee(null)
      suppressClickRef.current = true

      if (!box || (box.w < MARQUEE_MIN && box.h < MARQUEE_MIN)) {
        // 单击空白：清空（additive 时保持）
        if (!m.additive) selectNode(null)
      } else {
        const doc = useEditorStore.getState().document
        const hits = hitTestMarquee(doc, box)
        if (m.additive) {
          const set = new Set([...m.baseIds, ...hits])
          selectNodes([...set])
        } else {
          selectNodes(hits)
        }
      }
      return
    }

    if (wasPanning) suppressClickRef.current = true
  }, [selectNode, selectNodes])

  const handleBackgroundClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
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
        const newId = addNode(rootId, t("New Region"), "section")
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
    [tool, zoom, rootId, addNode, updateCanvasData, t],
  )

  const cursor =
    tool === "rectangle"
      ? "crosshair"
      : spaceHeld || panRef.current
        ? "grab"
        : "default"

  const operableCount = topLevelSelectedIds(document, selectedIds).filter(
    (id) => document.nodes[id]?.parentId != null,
  ).length

  return (
    <CanvasViewportProvider
      zoom={zoom}
      pan={pan}
      setPan={setPan}
      containerRef={containerRef}
    >
    <div
      ref={containerRef}
      role="application"
      tabIndex={0}
      aria-label={t("Workspace")}
      className="canvas-workspace relative h-full w-full overflow-hidden bg-muted/30"
      style={{ cursor }}
      onPointerDown={(e) => {
        handlePointerDown(e)
        handleDrawPointerDown(e)
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => {
        handlePointerUp()
        handleDrawPointerUp(e)
      }}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => {
        // 右键用于 pan，抑制菜单
        if (tool === "select") e.preventDefault()
      }}
      onClick={handleBackgroundClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") handleBackgroundClick()
      }}
    >
      <TooltipProvider>
        <div className="pointer-events-auto absolute left-3 top-3 z-10 flex flex-col gap-1">
          <div className="flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-xs backdrop-blur">
            <ToolButton active={tool === "select"} onClick={() => setTool("select")} label={t("Select and move components")}>
              <Cursor />
            </ToolButton>
            <ToolButton active={tool === "rectangle"} onClick={() => setTool("rectangle")} label={t("Draw rectangle components")}>
              <Square />
            </ToolButton>
            <ToolButton active={snapToComponents} onClick={() => setSnapToComponents((value) => !value)} label={t("Snap to other components while dragging")}>
              <Magnet />
            </ToolButton>
            <ToolButton active={showPixelGrid} onClick={() => setShowPixelGrid((value) => !value)} label={t("Show pixel grid")}>
              <GridFour />
            </ToolButton>
            <ToolButton active={snapToPixelGrid} onClick={() => setSnapToPixelGrid((value) => !value)} label={t("Snap to the pixel grid while dragging")}>
              <DotsNine />
            </ToolButton>
            <ToolButton onClick={() => setPan({ x: 0, y: 0 })} label={t("Center view")}>
              <ArrowsInSimple />
            </ToolButton>
          </div>
          {operableCount >= 2 && (
            <div className="flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-xs backdrop-blur">
              <ToolButton onClick={() => alignNodes(selectedIds, "left")} label={t("Align left")}>
                <AlignLeft />
              </ToolButton>
              <ToolButton onClick={() => alignNodes(selectedIds, "centerX")} label={t("Align center")}>
                <AlignCenterHorizontal />
              </ToolButton>
              <ToolButton onClick={() => alignNodes(selectedIds, "right")} label={t("Align right")}>
                <AlignRight />
              </ToolButton>
              <ToolButton onClick={() => alignNodes(selectedIds, "top")} label={t("Align top")}>
                <AlignTop />
              </ToolButton>
              <ToolButton onClick={() => alignNodes(selectedIds, "centerY")} label={t("Align middle")}>
                <AlignCenterVertical />
              </ToolButton>
              <ToolButton onClick={() => alignNodes(selectedIds, "bottom")} label={t("Align bottom")}>
                <AlignBottom />
              </ToolButton>
              {operableCount >= 3 && (
                <>
                  <ToolButton onClick={() => distributeNodes(selectedIds, "horizontal")} label={t("Distribute horizontal")}>
                    <AlignCenterHorizontalSimple />
                  </ToolButton>
                  <ToolButton onClick={() => distributeNodes(selectedIds, "vertical")} label={t("Distribute vertical")}>
                    <AlignCenterVerticalSimple />
                  </ToolButton>
                </>
              )}
            </div>
          )}
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

          {/* 选区一等公民：AABB 框 + 组手柄 + 尺寸 */}
          {tool === "select" && (
            <SelectionOverlay zoom={zoom} snapToComponents={snapToComponents} />
          )}

          {tool === "rectangle" && (
            <div className="absolute inset-0 z-30 cursor-crosshair" aria-label={t("Rectangle drawing surface")} />
          )}

          {/* 框选矩形 */}
          {marquee && marquee.w > 0 && marquee.h > 0 && (
            <div
              className="pointer-events-none absolute z-40 border border-ring bg-ring/10"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.w,
                height: marquee.h,
              }}
            />
          )}

          {/* 智能吸附引导线 */}
          <SnapOverlay zoom={zoom} />

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
    </CanvasViewportProvider>
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
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation()
              onClick()
            }}
            aria-label={label}
            aria-pressed={active}
            className={
              active
                ? "bg-muted text-foreground hover:bg-muted hover:text-foreground dark:bg-muted dark:hover:bg-muted"
                : undefined
            }
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

