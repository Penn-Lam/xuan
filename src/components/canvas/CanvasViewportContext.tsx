// ============================================================
//  CanvasViewportContext —— pan/zoom 与边缘滚动共享
//  仅在确认拖拽（dirty）后启用边缘滚动；禁止 click 误触发
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"

export interface ViewportState {
  zoom: number
  pan: { x: number; y: number }
  setPan: (
    p:
      | { x: number; y: number }
      | ((prev: { x: number; y: number }) => { x: number; y: number }),
  ) => void
  containerRef: RefObject<HTMLDivElement | null>
}

interface EdgeScrollHandle {
  /** 记录起始 pan + 指针位置；不启动滚动（避免 click 误触发） */
  begin: (clientX: number, clientY: number) => { panX: number; panY: number }
  /** 确认进入拖拽后调用，才开始边缘滚动 rAF */
  enable: () => void
  /** 更新指针位置；若已 enable 则边缘滚动生效 */
  tick: (clientX: number, clientY: number) => { panX: number; panY: number }
  end: () => void
}

interface CanvasViewportValue extends ViewportState {
  edgeScroll: EdgeScrollHandle
  /**
   * 将指针位移 + pan 变化折算为 document 位移
   * docDx = (clientX - startX)/zoom - (pan.x - startPan.x)/zoom
   */
  clientDeltaToDoc: (
    clientX: number,
    clientY: number,
    startClientX: number,
    startClientY: number,
    startPanX: number,
    startPanY: number,
  ) => { dx: number; dy: number }
}

const CanvasViewportContext = createContext<CanvasViewportValue | null>(null)

const EDGE_PX = 40
const MAX_SPEED = 10 // screen px / frame

/** 边缘强度 0..1；指针在容器外时按满速 */
function edgeStrength(dist: number, edge: number): number {
  if (dist >= edge) return 0
  // dist 可为负（在边缘外）→ 钳到满速
  return Math.min(1, Math.max(0, 1 - dist / edge))
}

export function CanvasViewportProvider({
  zoom,
  pan,
  setPan,
  containerRef,
  children,
}: ViewportState & { children: ReactNode }) {
  const panRef = useRef(pan)
  panRef.current = pan
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const enabledRef = useRef(false)
  const rafRef = useRef(0)
  const lastClientRef = useRef({ x: 0, y: 0 })

  const edgeScroll = useMemo<EdgeScrollHandle>(() => {
    const stopRaf = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    const step = () => {
      if (!enabledRef.current) return
      const el = containerRef.current
      if (!el) {
        rafRef.current = requestAnimationFrame(step)
        return
      }
      const rect = el.getBoundingClientRect()
      const { x, y } = lastClientRef.current

      // 未收到任何 tick 时 lastClient 可能仍是 0,0 — enable 前 begin 必须写入真实坐标
      const distL = x - rect.left
      const distR = rect.right - x
      const distT = y - rect.top
      const distB = rect.bottom - y

      const vx =
        MAX_SPEED * edgeStrength(distL, EDGE_PX) -
        MAX_SPEED * edgeStrength(distR, EDGE_PX)
      const vy =
        MAX_SPEED * edgeStrength(distT, EDGE_PX) -
        MAX_SPEED * edgeStrength(distB, EDGE_PX)

      if (vx !== 0 || vy !== 0) {
        const p = panRef.current
        const next = { x: p.x + vx, y: p.y + vy }
        panRef.current = next
        setPan(next)
      }
      rafRef.current = requestAnimationFrame(step)
    }

    return {
      begin: (clientX, clientY) => {
        // 只记录，不开 rAF
        enabledRef.current = false
        stopRaf()
        lastClientRef.current = { x: clientX, y: clientY }
        return { panX: panRef.current.x, panY: panRef.current.y }
      },
      enable: () => {
        if (enabledRef.current) return
        enabledRef.current = true
        stopRaf()
        rafRef.current = requestAnimationFrame(step)
      },
      tick: (clientX, clientY) => {
        lastClientRef.current = { x: clientX, y: clientY }
        return { panX: panRef.current.x, panY: panRef.current.y }
      },
      end: () => {
        enabledRef.current = false
        stopRaf()
      },
    }
  }, [containerRef, setPan])

  const clientDeltaToDoc = useCallback(
    (
      clientX: number,
      clientY: number,
      startClientX: number,
      startClientY: number,
      startPanX: number,
      startPanY: number,
    ) => {
      const z = zoomRef.current
      const p = panRef.current
      return {
        dx: (clientX - startClientX) / z - (p.x - startPanX) / z,
        dy: (clientY - startClientY) / z - (p.y - startPanY) / z,
      }
    },
    [],
  )

  const value = useMemo(
    () => ({
      zoom,
      pan,
      setPan,
      containerRef,
      edgeScroll,
      clientDeltaToDoc,
    }),
    [zoom, pan, setPan, containerRef, edgeScroll, clientDeltaToDoc],
  )

  return (
    <CanvasViewportContext.Provider value={value}>
      {children}
    </CanvasViewportContext.Provider>
  )
}

export function useCanvasViewport(): CanvasViewportValue {
  const ctx = useContext(CanvasViewportContext)
  if (!ctx) {
    return {
      zoom: 1,
      pan: { x: 0, y: 0 },
      setPan: () => {},
      containerRef: { current: null },
      edgeScroll: {
        begin: () => ({ panX: 0, panY: 0 }),
        enable: () => {},
        tick: () => ({ panX: 0, panY: 0 }),
        end: () => {},
      },
      clientDeltaToDoc: (cx, cy, sx, sy) => ({
        dx: cx - sx,
        dy: cy - sy,
      }),
    }
  }
  return ctx
}
