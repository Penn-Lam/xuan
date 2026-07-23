// ============================================================
//  SelectionOverlay —— 选区 AABB + 8 手柄
//  resize：Shift 锁比例、Alt 中心缩放；边缘滚动
// ============================================================
import { useCallback, useMemo, useRef } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import {
  MIN_SIZE,
  absoluteRect,
  topLevelSelectedIds,
} from "@/lib/geometry"
import { cn } from "@/lib/utils"
import type { Rect } from "@/types/document"
import {
  buildSnapTargets,
  createSnapSession,
  unionRects,
  useSnapStore,
} from "./useCanvasSnap"
import {
  RESIZE_HANDLES,
  handleCursor,
  handlePositionClass,
  type ResizeDir,
} from "./selectionHandles"
import { useCanvasViewport } from "./CanvasViewportContext"

interface SelectionOverlayProps {
  zoom: number
  snapToComponents?: boolean
}

/** 根据手柄 + 修饰键计算新组 AABB（Shift=锁比例，Alt=中心缩放） */
function computeResizedGroup(
  g: Rect,
  dir: ResizeDir,
  rawDx: number,
  rawDy: number,
  shiftKey: boolean,
  altKey: boolean,
): Rect {
  const aspect = g.w / Math.max(1e-6, g.h)
  const isCorner =
    (dir.includes("n") || dir.includes("s")) &&
    (dir.includes("e") || dir.includes("w"))

  // 先算「固定对边」下的尺寸变化量
  let dw = 0
  let dh = 0
  if (dir.includes("e")) dw = rawDx
  if (dir.includes("w")) dw = -rawDx
  if (dir.includes("s")) dh = rawDy
  if (dir.includes("n")) dh = -rawDy

  if (shiftKey && isCorner) {
    // 以变化更大的边驱动比例
    if (Math.abs(dw) / aspect >= Math.abs(dh)) {
      dh = dw / aspect
    } else {
      dw = dh * aspect
    }
  } else if (shiftKey && !isCorner) {
    if (dir === "e" || dir === "w") dh = dw / aspect
    else dw = dh * aspect
  }

  let w = Math.max(MIN_SIZE, g.w + (altKey ? 2 * dw : dw))
  let h = Math.max(MIN_SIZE, g.h + (altKey ? 2 * dh : dh))

  // 再次锁比例（防止 min-size 破坏）
  if (shiftKey) {
    if (Math.abs(w / h - aspect) > 0.001) {
      if (isCorner || dir === "e" || dir === "w") h = w / aspect
      else w = h * aspect
    }
  }

  let x = g.x
  let y = g.y
  if (altKey) {
    x = g.x + g.w / 2 - w / 2
    y = g.y + g.h / 2 - h / 2
  } else {
    if (dir.includes("w")) x = g.x + g.w - w
    if (dir.includes("n")) y = g.y + g.h - h
    // 边手柄 + shift：另一维居中
    if (shiftKey && !isCorner) {
      if (dir === "e" || dir === "w") y = g.y + (g.h - h) / 2
      if (dir === "n" || dir === "s") x = g.x + (g.w - w) / 2
    }
  }

  return { x, y, w, h }
}

export function SelectionOverlay({
  zoom: zoomProp = 1,
  snapToComponents = true,
}: SelectionOverlayProps) {
  const viewport = useCanvasViewport()
  const zoom = viewport.zoom || zoomProp

  const document = useEditorStore((s) => s.document)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const updateCanvasRects = useEditorStore((s) => s.updateCanvasRects)
  const sealHistoryBatch = useEditorStore((s) => s.sealHistoryBatch)
  const setIndicators = useSnapStore((s) => s.setIndicators)
  const clearGuides = useSnapStore((s) => s.clearGuides)

  const topIds = useMemo(
    () => topLevelSelectedIds(document, selectedIds),
    [document, selectedIds],
  )

  const operableIds = useMemo(() => {
    return topIds.filter((id) => {
      const n = document.nodes[id]
      if (!n) return false
      if (!n.parentId && topIds.length > 1) return false
      return Boolean(document.canvas[id])
    })
  }, [document, topIds])

  const bounds = useMemo(() => {
    if (operableIds.length === 0) return null
    const rects = operableIds.map((id) => absoluteRect(document, id))
    return unionRects(rects)
  }, [document, operableIds])

  const dragRef = useRef<{
    startX: number
    startY: number
    startPanX: number
    startPanY: number
    dir: ResizeDir
    groupOrig: Rect
    items: Array<{
      id: string
      origRect: Rect
      origAbs: Rect
      parentAbs: Rect
      rel: { x: number; y: number; w: number; h: number }
    }>
    session: ReturnType<typeof createSnapSession>
    targets: ReturnType<typeof buildSnapTargets>
    dirty: boolean
  } | null>(null)

  const handleResizeDown = useCallback(
    (e: React.PointerEvent, dir: ResizeDir) => {
      e.stopPropagation()
      e.preventDefault()
      if (!bounds || operableIds.length === 0) return

      const state = useEditorStore.getState()
      const doc = state.document

      const items = operableIds
        .map((id) => {
          const n = doc.nodes[id]
          const c = doc.canvas[id]
          if (!n || !c) return null
          const origAbs = absoluteRect(doc, id)
          const parentAbs = n.parentId
            ? absoluteRect(doc, n.parentId)
            : { x: 0, y: 0, w: origAbs.w, h: origAbs.h }
          return {
            id,
            origRect: { ...c.rect },
            origAbs,
            parentAbs,
            rel: {
              x: (origAbs.x - bounds.x) / Math.max(1, bounds.w),
              y: (origAbs.y - bounds.y) / Math.max(1, bounds.h),
              w: origAbs.w / Math.max(1, bounds.w),
              h: origAbs.h / Math.max(1, bounds.h),
            },
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      if (items.length === 0) return

      const moving = new Set(operableIds)
      const siblingMap = new Map<string, Rect>()
      for (const id of operableIds) {
        const n = doc.nodes[id]
        if (!n?.parentId) continue
        for (const cid of doc.nodes[n.parentId].childrenIds) {
          if (moving.has(cid)) continue
          siblingMap.set(cid, absoluteRect(doc, cid))
        }
      }
      const first = doc.nodes[operableIds[0]]
      const parentRect = first?.parentId
        ? absoluteRect(doc, first.parentId)
        : absoluteRect(doc, doc.rootId)
      const canvasRect = absoluteRect(doc, doc.rootId)
      const targets = buildSnapTargets({
        siblingRects: [...siblingMap.entries()].map(([id, b]) => ({
          id,
          bounds: b,
        })),
        parentRect,
        parentId: first?.parentId ?? doc.rootId,
        canvasRect,
        canvasId: doc.rootId,
      })

      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const startPan = viewport.edgeScroll.begin(e.clientX, e.clientY)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: startPan.panX,
        startPanY: startPan.panY,
        dir,
        groupOrig: { ...bounds },
        items,
        session: createSnapSession(),
        targets,
        dirty: false,
      }

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        viewport.edgeScroll.tick(ev.clientX, ev.clientY)
        const { dx: rawDx, dy: rawDy } = viewport.clientDeltaToDoc(
          ev.clientX,
          ev.clientY,
          drag.startX,
          drag.startY,
          drag.startPanX,
          drag.startPanY,
        )
        if (!drag.dirty && Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return
        if (!drag.dirty) viewport.edgeScroll.enable()

        let groupRect = computeResizedGroup(
          drag.groupOrig,
          drag.dir,
          rawDx,
          rawDy,
          ev.shiftKey,
          ev.altKey,
        )

        // 单选且未按 Alt（中心缩放时跳过，避免与 alt 修饰冲突）时做点吸附
        if (
          snapToComponents &&
          !ev.altKey &&
          drag.items.length === 1
        ) {
          const result = drag.session.resolveResize({
            initialBounds: drag.groupOrig,
            rawBounds: groupRect,
            targets: drag.targets,
            zoom,
            edges: {
              n: drag.dir.includes("n"),
              s: drag.dir.includes("s"),
              e: drag.dir.includes("e"),
              w: drag.dir.includes("w"),
            },
          })
          groupRect = result.snappedBounds
          setIndicators(result.indicators)
        } else {
          clearGuides()
        }

        const updates = drag.items.map((item) => {
          const n = useEditorStore.getState().document.nodes[item.id]
          if (!n?.parentId) {
            return {
              id: item.id,
              rect: {
                x: groupRect.x,
                y: groupRect.y,
                w: groupRect.w,
                h: groupRect.h,
              },
            }
          }
          const absX = groupRect.x + item.rel.x * groupRect.w
          const absY = groupRect.y + item.rel.y * groupRect.h
          const absW = Math.max(MIN_SIZE, item.rel.w * groupRect.w)
          const absH = Math.max(MIN_SIZE, item.rel.h * groupRect.h)
          return {
            id: item.id,
            rect: {
              x: absX - item.parentAbs.x,
              y: absY - item.parentAbs.y,
              w: absW,
              h: absH,
            },
          }
        })

        drag.dirty = true
        updateCanvasRects(updates, { history: false })
      }

      const onUp = () => {
        const drag = dragRef.current
        dragRef.current = null
        viewport.edgeScroll.end()
        drag?.session.reset()
        clearGuides()
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        if (drag?.dirty) sealHistoryBatch()
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [
      bounds,
      operableIds,
      zoom,
      snapToComponents,
      updateCanvasRects,
      sealHistoryBatch,
      setIndicators,
      clearGuides,
      viewport,
    ],
  )

  if (!bounds || operableIds.length === 0) return null

  const label = `${Math.round(bounds.w)} × ${Math.round(bounds.h)}`

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
      }}
      data-selection-overlay="true"
    >
      <div className="absolute inset-0 border-2 border-ring" />
      <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-sm bg-ring px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-primary-foreground">
        {label}
      </div>
      {RESIZE_HANDLES.map((dir) => (
        <div
          key={dir}
          className={cn(
            "pointer-events-auto absolute size-2 rounded-full border border-ring bg-background",
            handlePositionClass(dir),
          )}
          style={{ cursor: handleCursor(dir) }}
          onPointerDown={(e) => handleResizeDown(e, dir)}
        />
      ))}
    </div>
  )
}
