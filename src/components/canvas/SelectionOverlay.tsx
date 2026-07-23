// ============================================================
//  SelectionOverlay —— 选区一等公民（tldraw SelectionForeground 思路）
//  顶层选中节点的 AABB 框 + 8 向手柄；resize 在此统一处理
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

interface SelectionOverlayProps {
  zoom: number
  snapToComponents?: boolean
}

export function SelectionOverlay({
  zoom,
  snapToComponents = true,
}: SelectionOverlayProps) {
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

  // 可操作选区：排除「仅 root 且无其它」时的整页框？root 单独选中仍可 resize 页面
  const operableIds = useMemo(() => {
    return topIds.filter((id) => {
      const n = document.nodes[id]
      if (!n) return false
      // 多选时不把 root 算进 AABB（root 是页面框）
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
    dir: ResizeDir
    /** 开始时组 AABB */
    groupOrig: Rect
    /** 各节点相对组的归一化位置 + 原始相对 rect */
    items: Array<{
      id: string
      origRect: Rect
      origAbs: Rect
      parentAbs: Rect
      /** 相对 group 的 left/top/w/h 比例（多选缩放） */
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
          if (!n || !c || !n.parentId) {
            // root：特殊处理
            if (!n?.parentId && c) {
              const origAbs = absoluteRect(doc, id)
              return {
                id,
                origRect: { ...c.rect },
                origAbs,
                parentAbs: { x: 0, y: 0, w: origAbs.w, h: origAbs.h },
                rel: {
                  x: (origAbs.x - bounds.x) / Math.max(1, bounds.w),
                  y: (origAbs.y - bounds.y) / Math.max(1, bounds.h),
                  w: origAbs.w / Math.max(1, bounds.w),
                  h: origAbs.h / Math.max(1, bounds.h),
                },
              }
            }
            return null
          }
          const origAbs = absoluteRect(doc, id)
          const parentAbs = absoluteRect(doc, n.parentId)
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

      // 吸附目标：所有选区节点的同父兄弟（并集去重）
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
      // 单节点时用其 parent；多选用第一个
      const first = doc.nodes[operableIds[0]]
      const parentRect = first?.parentId
        ? absoluteRect(doc, first.parentId)
        : absoluteRect(doc, doc.rootId)
      const canvasRect = absoluteRect(doc, doc.rootId)
      const targets = buildSnapTargets({
        siblingRects: [...siblingMap.entries()].map(([id, bounds]) => ({
          id,
          bounds,
        })),
        parentRect,
        parentId: first?.parentId ?? doc.rootId,
        canvasRect,
        canvasId: doc.rootId,
      })

      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
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
        let rawDx = (ev.clientX - drag.startX) / zoom
        let rawDy = (ev.clientY - drag.startY) / zoom
        if (!drag.dirty && Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return

        // 组 AABB resize
        const g = drag.groupOrig
        let x = g.x
        let y = g.y
        let w = g.w
        let h = g.h
        if (drag.dir.includes("e")) w = Math.max(MIN_SIZE, g.w + rawDx)
        if (drag.dir.includes("s")) h = Math.max(MIN_SIZE, g.h + rawDy)
        if (drag.dir.includes("w")) {
          w = Math.max(MIN_SIZE, g.w - rawDx)
          x = g.x + (g.w - w)
        }
        if (drag.dir.includes("n")) {
          h = Math.max(MIN_SIZE, g.h - rawDy)
          y = g.y + (g.h - h)
        }

        let groupRect: Rect = { x, y, w, h }

        if (snapToComponents && !ev.altKey && drag.items.length === 1) {
          // 单选：点吸附 resize
          const result = drag.session.resolveResize({
            initialBounds: g,
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

        // 将组缩放映射回各节点
        const updates = drag.items.map((item) => {
          const node = useEditorStore.getState().document.nodes[item.id]
          if (!node?.parentId) {
            // root：直接设为 groupRect
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
    ],
  )

  if (!bounds || operableIds.length === 0) return null

  // 尺寸标注
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
      {/* 选区框 */}
      <div className="absolute inset-0 border-2 border-ring" />

      {/* 尺寸标签 */}
      <div
        className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-sm bg-ring px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-primary-foreground"
      >
        {label}
      </div>

      {/* 8 向手柄 */}
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
