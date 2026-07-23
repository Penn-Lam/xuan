// ============================================================
//  CanvasViewportContext —— pan/zoom 与边缘滚动共享
//  拖拽时根据指针位置自动 pan，并把 pan 变化折算进 document 位移
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
  setPan: (p: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void
  containerRef: RefObject<HTMLDivElement | null>
}

interface EdgeScrollHandle {
  /** 指针按下时记录起始 pan */
  begin: () => { panX: number; panY: number }
  /** 每帧根据指针位置做边缘滚动；返回当前 pan（用于折算 doc 位移） */
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

const EDGE_PX = 48
const MAX_SPEED = 14 // screen px / frame

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
  const scrollingRef = useRef(false)
  const rafRef = useRef(0)
  const lastClientRef = useRef({ x: 0, y: 0 })

  const edgeScroll = useMemo<EdgeScrollHandle>(() => {
    const step = () => {
      if (!scrollingRef.current) return
      const el = containerRef.current
      if (!el) {
        rafRef.current = requestAnimationFrame(step)
        return
      }
      const rect = el.getBoundingClientRect()
      const { x, y } = lastClientRef.current
      let vx = 0
      let vy = 0
      const distL = x - rect.left
      const distR = rect.right - x
      const distT = y - rect.top
      const distB = rect.bottom - y
      if (distL < EDGE_PX) vx = MAX_SPEED * (1 - distL / EDGE_PX)
      else if (distR < EDGE_PX) vx = -MAX_SPEED * (1 - distR / EDGE_PX)
      if (distT < EDGE_PX) vy = MAX_SPEED * (1 - distT / EDGE_PX)
      else if (distB < EDGE_PX) vy = -MAX_SPEED * (1 - distB / EDGE_PX)

      if (vx !== 0 || vy !== 0) {
        const p = panRef.current
        const next = { x: p.x + vx, y: p.y + vy }
        panRef.current = next
        setPan(next)
      }
      rafRef.current = requestAnimationFrame(step)
    }

    return {
      begin: () => {
        scrollingRef.current = true
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(step)
        return { panX: panRef.current.x, panY: panRef.current.y }
      },
      tick: (clientX, clientY) => {
        lastClientRef.current = { x: clientX, y: clientY }
        return { panX: panRef.current.x, panY: panRef.current.y }
      },
      end: () => {
        scrollingRef.current = false
        cancelAnimationFrame(rafRef.current)
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
    // 无 provider 时退化（测试/孤立渲染）
    return {
      zoom: 1,
      pan: { x: 0, y: 0 },
      setPan: () => {},
      containerRef: { current: null },
      edgeScroll: {
        begin: () => ({ panX: 0, panY: 0 }),
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
