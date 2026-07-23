// ============================================================
//  snap/boundsSnap —— 移植自 tldraw BoundsSnaps
//  点对齐（角/中心）+ gap 中心夹入 + gap 等距复制
//  无 Editor 依赖，纯函数
// ============================================================
import type { Rect } from "@/types/document"
import {
  cornersAndCenter,
  dedupePoints,
  rangeIntersection,
  rangesOverlap,
  rectSides,
  round,
  translateRect,
} from "./geometry"
import type {
  GapsSnapIndicator,
  PointsSnapIndicator,
  SnapIndicator,
  SnapResizeInput,
  SnapResizeResult,
  SnapTarget,
  SnapTranslateInput,
  SnapTranslateResult,
  Vec2,
} from "./types"

export const SNAP_THRESHOLD_SCREEN = 8

interface SnapPoint {
  id: string
  x: number
  y: number
}

interface GapNode {
  id: string
  bounds: Rect
}

interface Gap {
  startNode: GapNode
  endNode: GapNode
  startEdge: [Vec2, Vec2]
  endEdge: [Vec2, Vec2]
  length: number
  breadthIntersection: [number, number]
}

interface SnapPair {
  thisPoint: SnapPoint
  otherPoint: SnapPoint
}

type NearestSnap =
  | { type: "points"; points: SnapPair; nudge: number }
  | { type: "gap_center"; gap: Gap; nudge: number }
  | {
      type: "gap_duplicate"
      gap: Gap
      protrusionDirection: "left" | "right" | "top" | "bottom"
      nudge: number
    }

function pointsOf(target: SnapTarget): SnapPoint[] {
  return cornersAndCenter(target.bounds).map((p, i) => ({
    id: `${target.id}:${i}`,
    x: p.x,
    y: p.y,
  }))
}

function selectionPoints(bounds: Rect, prefix = "sel"): SnapPoint[] {
  return cornersAndCenter(bounds).map((p, i) => ({
    id: `${prefix}:${i}`,
    x: p.x,
    y: p.y,
  }))
}

/** 收集目标之间的水平/垂直间隙（tldraw getVisibleGaps） */
export function collectGaps(targets: SnapTarget[]): {
  horizontal: Gap[]
  vertical: Gap[]
} {
  const nodes: GapNode[] = targets.map((t) => ({ id: t.id, bounds: t.bounds }))
  const horizontal: Gap[] = []
  const vertical: Gap[] = []

  const byX = nodes.slice().sort((a, b) => a.bounds.x - b.bounds.x)
  for (let i = 0; i < byX.length; i++) {
    const start = byX[i]
    for (let j = i + 1; j < byX.length; j++) {
      const end = byX[j]
      const startRight = start.bounds.x + start.bounds.w
      const endLeft = end.bounds.x
      if (
        startRight < endLeft &&
        rangesOverlap(
          start.bounds.y,
          start.bounds.y + start.bounds.h,
          end.bounds.y,
          end.bounds.y + end.bounds.h,
        )
      ) {
        const bi = rangeIntersection(
          start.bounds.y,
          start.bounds.y + start.bounds.h,
          end.bounds.y,
          end.bounds.y + end.bounds.h,
        )!
        horizontal.push({
          startNode: start,
          endNode: end,
          startEdge: [
            { x: startRight, y: start.bounds.y },
            { x: startRight, y: start.bounds.y + start.bounds.h },
          ],
          endEdge: [
            { x: endLeft, y: end.bounds.y },
            { x: endLeft, y: end.bounds.y + end.bounds.h },
          ],
          length: endLeft - startRight,
          breadthIntersection: bi,
        })
      }
    }
  }

  const byY = nodes.slice().sort((a, b) => a.bounds.y - b.bounds.y)
  for (let i = 0; i < byY.length; i++) {
    const start = byY[i]
    for (let j = i + 1; j < byY.length; j++) {
      const end = byY[j]
      const startBottom = start.bounds.y + start.bounds.h
      const endTop = end.bounds.y
      if (
        startBottom < endTop &&
        rangesOverlap(
          start.bounds.x,
          start.bounds.x + start.bounds.w,
          end.bounds.x,
          end.bounds.x + end.bounds.w,
        )
      ) {
        const bi = rangeIntersection(
          start.bounds.x,
          start.bounds.x + start.bounds.w,
          end.bounds.x,
          end.bounds.x + end.bounds.w,
        )!
        vertical.push({
          startNode: start,
          endNode: end,
          startEdge: [
            { x: start.bounds.x, y: startBottom },
            { x: start.bounds.x + start.bounds.w, y: startBottom },
          ],
          endEdge: [
            { x: end.bounds.x, y: endTop },
            { x: end.bounds.x + end.bounds.w, y: endTop },
          ],
          length: endTop - startBottom,
          breadthIntersection: bi,
        })
      }
    }
  }

  return { horizontal, vertical }
}

function collectPointSnaps(
  selectionSnapPoints: SnapPoint[],
  otherPoints: SnapPoint[],
  minOffset: { x: number; y: number },
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[],
) {
  for (const thisPt of selectionSnapPoints) {
    for (const other of otherPoints) {
      const offsetX = Math.abs(thisPt.x - other.x)
      const offsetY = Math.abs(thisPt.y - other.y)

      if (round(offsetX) <= round(minOffset.x)) {
        if (round(offsetX) < round(minOffset.x)) nearestSnapsX.length = 0
        nearestSnapsX.push({
          type: "points",
          points: { thisPoint: thisPt, otherPoint: other },
          nudge: other.x - thisPt.x,
        })
        minOffset.x = offsetX
      }

      if (round(offsetY) <= round(minOffset.y)) {
        if (round(offsetY) < round(minOffset.y)) nearestSnapsY.length = 0
        nearestSnapsY.push({
          type: "points",
          points: { thisPoint: thisPt, otherPoint: other },
          nudge: other.y - thisPt.y,
        })
        minOffset.y = offsetY
      }
    }
  }
}

function pushGapCenterX(
  nearestSnapsX: NearestSnap[],
  snap: Extract<NearestSnap, { type: "gap_center" }>,
  gap: Gap,
) {
  const other = nearestSnapsX.find((s) => s.type === "gap_center") as
    | Extract<NearestSnap, { type: "gap_center" }>
    | undefined
  const overlap =
    other &&
    rangeIntersection(
      gap.breadthIntersection[0],
      gap.breadthIntersection[1],
      other.gap.breadthIntersection[0],
      other.gap.breadthIntersection[1],
    )
  if (other && other.gap.length > gap.length && overlap) {
    nearestSnapsX[nearestSnapsX.indexOf(other)] = snap
  } else if (!other || !overlap) {
    nearestSnapsX.push(snap)
  }
}

function pushGapCenterY(
  nearestSnapsY: NearestSnap[],
  snap: Extract<NearestSnap, { type: "gap_center" }>,
  gap: Gap,
) {
  const other = nearestSnapsY.find((s) => s.type === "gap_center") as
    | Extract<NearestSnap, { type: "gap_center" }>
    | undefined
  const overlap =
    other &&
    rangesOverlap(
      other.gap.breadthIntersection[0],
      other.gap.breadthIntersection[1],
      gap.breadthIntersection[0],
      gap.breadthIntersection[1],
    )
  if (other && other.gap.length > gap.length && overlap) {
    nearestSnapsY[nearestSnapsY.indexOf(other)] = snap
  } else if (!other || !overlap) {
    nearestSnapsY.push(snap)
  }
}

function collectGapSnaps(
  selectionBounds: Rect,
  gaps: { horizontal: Gap[]; vertical: Gap[] },
  minOffset: { x: number; y: number },
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[],
) {
  const sel = selectionBounds
  const selRight = sel.x + sel.w
  const selBottom = sel.y + sel.h
  const selCX = sel.x + sel.w / 2
  const selCY = sel.y + sel.h / 2

  for (const gap of gaps.horizontal) {
    if (
      !rangesOverlap(
        gap.breadthIntersection[0],
        gap.breadthIntersection[1],
        sel.y,
        selBottom,
      )
    ) {
      continue
    }

    const gapMidX = gap.startEdge[0].x + gap.length / 2
    const centerNudge = gapMidX - selCX
    if (gap.length > sel.w && round(Math.abs(centerNudge)) <= round(minOffset.x)) {
      if (round(Math.abs(centerNudge)) < round(minOffset.x)) nearestSnapsX.length = 0
      minOffset.x = Math.abs(centerNudge)
      pushGapCenterX(
        nearestSnapsX,
        { type: "gap_center", gap, nudge: centerNudge },
        gap,
      )
    }

    const duplicationLeftX = gap.startNode.bounds.x - gap.length
    const leftNudge = duplicationLeftX - selRight
    if (round(Math.abs(leftNudge)) <= round(minOffset.x)) {
      if (round(Math.abs(leftNudge)) < round(minOffset.x)) nearestSnapsX.length = 0
      minOffset.x = Math.abs(leftNudge)
      nearestSnapsX.push({
        type: "gap_duplicate",
        gap,
        protrusionDirection: "left",
        nudge: leftNudge,
      })
    }

    const duplicationRightX =
      gap.endNode.bounds.x + gap.endNode.bounds.w + gap.length
    const rightNudge = duplicationRightX - sel.x
    if (round(Math.abs(rightNudge)) <= round(minOffset.x)) {
      if (round(Math.abs(rightNudge)) < round(minOffset.x)) nearestSnapsX.length = 0
      minOffset.x = Math.abs(rightNudge)
      nearestSnapsX.push({
        type: "gap_duplicate",
        gap,
        protrusionDirection: "right",
        nudge: rightNudge,
      })
    }
  }

  for (const gap of gaps.vertical) {
    if (
      !rangesOverlap(
        gap.breadthIntersection[0],
        gap.breadthIntersection[1],
        sel.x,
        selRight,
      )
    ) {
      continue
    }

    const gapMidY = gap.startEdge[0].y + gap.length / 2
    const centerNudge = gapMidY - selCY
    if (gap.length > sel.h && round(Math.abs(centerNudge)) <= round(minOffset.y)) {
      if (round(Math.abs(centerNudge)) < round(minOffset.y)) nearestSnapsY.length = 0
      minOffset.y = Math.abs(centerNudge)
      pushGapCenterY(
        nearestSnapsY,
        { type: "gap_center", gap, nudge: centerNudge },
        gap,
      )
      continue
    }

    const duplicationTopY = gap.startNode.bounds.y - gap.length
    const topNudge = duplicationTopY - selBottom
    if (round(Math.abs(topNudge)) <= round(minOffset.y)) {
      if (round(Math.abs(topNudge)) < round(minOffset.y)) nearestSnapsY.length = 0
      minOffset.y = Math.abs(topNudge)
      nearestSnapsY.push({
        type: "gap_duplicate",
        gap,
        protrusionDirection: "top",
        nudge: topNudge,
      })
    }

    const duplicationBottomY =
      gap.endNode.bounds.y + gap.endNode.bounds.h + gap.length
    const bottomNudge = duplicationBottomY - sel.y
    if (round(Math.abs(bottomNudge)) <= round(minOffset.y)) {
      if (round(Math.abs(bottomNudge)) < round(minOffset.y)) nearestSnapsY.length = 0
      minOffset.y = Math.abs(bottomNudge)
      nearestSnapsY.push({
        type: "gap_duplicate",
        gap,
        protrusionDirection: "bottom",
        nudge: bottomNudge,
      })
    }
  }
}

function getPointSnapLines(
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[],
): PointsSnapIndicator[] {
  const groupsX = new Map<number, SnapPair[]>()
  const groupsY = new Map<number, SnapPair[]>()

  for (const snap of nearestSnapsX) {
    if (snap.type !== "points") continue
    const key = round(snap.points.otherPoint.x)
    const list = groupsX.get(key) ?? []
    list.push(snap.points)
    groupsX.set(key, list)
  }
  for (const snap of nearestSnapsY) {
    if (snap.type !== "points") continue
    const key = round(snap.points.otherPoint.y)
    const list = groupsY.get(key) ?? []
    list.push(snap.points)
    groupsY.set(key, list)
  }

  const lines: PointsSnapIndicator[] = []
  let i = 0
  for (const pairs of [...groupsX.values(), ...groupsY.values()]) {
    const pts = dedupePoints(
      pairs.flatMap((p) => [
        { x: p.otherPoint.x, y: p.otherPoint.y },
        { x: p.thisPoint.x, y: p.thisPoint.y },
      ]),
    )
    if (pts.length >= 1) {
      lines.push({ id: `pts-${i++}`, type: "points", points: pts })
    }
  }
  return lines
}

function findAdjacentGaps(
  gaps: Gap[],
  shapeId: string,
  gapLength: number,
  direction: "forward" | "backward",
  intersection: [number, number],
): Array<{ startEdge: [Vec2, Vec2]; endEdge: [Vec2, Vec2] }> {
  const matches = gaps.filter(
    (gap) =>
      (direction === "forward"
        ? gap.startNode.id === shapeId
        : gap.endNode.id === shapeId) &&
      round(gap.length) === round(gapLength) &&
      rangeIntersection(
        gap.breadthIntersection[0],
        gap.breadthIntersection[1],
        intersection[0],
        intersection[1],
      ),
  )

  if (matches.length === 0) return []

  const result: Array<{ startEdge: [Vec2, Vec2]; endEdge: [Vec2, Vec2] }> = []
  const nextNodes = new Set<string>()

  for (const match of matches) {
    result.push({ startEdge: match.startEdge, endEdge: match.endEdge })
    const node = direction === "forward" ? match.endNode.id : match.startNode.id
    if (nextNodes.has(node)) continue
    nextNodes.add(node)
    const nextIx = rangeIntersection(
      match.breadthIntersection[0],
      match.breadthIntersection[1],
      intersection[0],
      intersection[1],
    )
    if (!nextIx) continue
    result.push(...findAdjacentGaps(gaps, node, gapLength, direction, nextIx))
  }

  return result
}

function getGapSnapLines(
  selectionBounds: Rect,
  gaps: { horizontal: Gap[]; vertical: Gap[] },
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[],
): GapsSnapIndicator[] {
  const sides = rectSides(selectionBounds)
  const result: GapsSnapIndicator[] = []
  let id = 0

  for (const snap of nearestSnapsX) {
    if (snap.type === "points") continue
    const { gap } = snap
    const bi = rangeIntersection(
      gap.breadthIntersection[0],
      gap.breadthIntersection[1],
      selectionBounds.y,
      selectionBounds.y + selectionBounds.h,
    )
    if (!bi) continue

    if (snap.type === "gap_center") {
      const newGapLen = (gap.length - selectionBounds.w) / 2
      result.push({
        id: `gap-h-${id++}`,
        type: "gaps",
        direction: "horizontal",
        gaps: [
          ...findAdjacentGaps(gaps.horizontal, gap.startNode.id, newGapLen, "backward", bi),
          { startEdge: gap.startEdge, endEdge: sides.left },
          { startEdge: sides.right, endEdge: gap.endEdge },
          ...findAdjacentGaps(gaps.horizontal, gap.endNode.id, newGapLen, "forward", bi),
        ],
      })
    } else if (snap.type === "gap_duplicate") {
      if (snap.protrusionDirection === "left") {
        const mirroredEnd: [Vec2, Vec2] = [
          { x: gap.startEdge[0].x - gap.startNode.bounds.w, y: gap.startEdge[0].y },
          { x: gap.startEdge[1].x - gap.startNode.bounds.w, y: gap.startEdge[1].y },
        ]
        result.push({
          id: `gap-h-${id++}`,
          type: "gaps",
          direction: "horizontal",
          gaps: [
            { startEdge: sides.right, endEdge: mirroredEnd },
            { startEdge: gap.startEdge, endEdge: gap.endEdge },
            ...findAdjacentGaps(
              gaps.horizontal,
              gap.endNode.id,
              gap.length,
              "forward",
              bi,
            ),
          ],
        })
      } else {
        const mirroredStart: [Vec2, Vec2] = [
          { x: gap.endEdge[0].x + gap.endNode.bounds.w, y: gap.endEdge[0].y },
          { x: gap.endEdge[1].x + gap.endNode.bounds.w, y: gap.endEdge[1].y },
        ]
        result.push({
          id: `gap-h-${id++}`,
          type: "gaps",
          direction: "horizontal",
          gaps: [
            ...findAdjacentGaps(
              gaps.horizontal,
              gap.startNode.id,
              gap.length,
              "backward",
              bi,
            ),
            { startEdge: gap.startEdge, endEdge: gap.endEdge },
            { startEdge: mirroredStart, endEdge: sides.left },
          ],
        })
      }
    }
  }

  for (const snap of nearestSnapsY) {
    if (snap.type === "points") continue
    const { gap } = snap
    const bi = rangeIntersection(
      gap.breadthIntersection[0],
      gap.breadthIntersection[1],
      selectionBounds.x,
      selectionBounds.x + selectionBounds.w,
    )
    if (!bi) continue

    if (snap.type === "gap_center") {
      const newGapLen = (gap.length - selectionBounds.h) / 2
      result.push({
        id: `gap-v-${id++}`,
        type: "gaps",
        direction: "vertical",
        gaps: [
          ...findAdjacentGaps(gaps.vertical, gap.startNode.id, newGapLen, "backward", bi),
          { startEdge: gap.startEdge, endEdge: sides.top },
          { startEdge: sides.bottom, endEdge: gap.endEdge },
          ...findAdjacentGaps(gaps.vertical, gap.endNode.id, newGapLen, "forward", bi),
        ],
      })
    } else if (snap.type === "gap_duplicate") {
      if (snap.protrusionDirection === "top") {
        const mirroredEnd: [Vec2, Vec2] = [
          { x: gap.startEdge[0].x, y: gap.startEdge[0].y - gap.startNode.bounds.h },
          { x: gap.startEdge[1].x, y: gap.startEdge[1].y - gap.startNode.bounds.h },
        ]
        result.push({
          id: `gap-v-${id++}`,
          type: "gaps",
          direction: "vertical",
          gaps: [
            { startEdge: sides.bottom, endEdge: mirroredEnd },
            { startEdge: gap.startEdge, endEdge: gap.endEdge },
            ...findAdjacentGaps(gaps.vertical, gap.endNode.id, gap.length, "forward", bi),
          ],
        })
      } else {
        const mirroredStart: [Vec2, Vec2] = [
          { x: gap.endEdge[0].x, y: gap.endEdge[0].y + gap.endNode.bounds.h },
          { x: gap.endEdge[1].x, y: gap.endEdge[1].y + gap.endNode.bounds.h },
        ]
        result.push({
          id: `gap-v-${id++}`,
          type: "gaps",
          direction: "vertical",
          gaps: [
            ...findAdjacentGaps(
              gaps.vertical,
              gap.startNode.id,
              gap.length,
              "backward",
              bi,
            ),
            { startEdge: gap.startEdge, endEdge: gap.endEdge },
            { startEdge: mirroredStart, endEdge: sides.top },
          ],
        })
      }
    }
  }

  return result
}

/**
 * 平移吸附（tldraw snapTranslateShapes）
 * 两阶段：先找 nudge，再零阈值重扫以收集全部精确指示线。
 */
export function snapTranslate(input: SnapTranslateInput): SnapTranslateResult {
  const { initialSelectionBounds, dragDelta, targets, threshold, lockedAxis } = input
  const otherPoints = targets.flatMap(pointsOf)
  const gaps = collectGaps(targets)

  const selectionBounds = translateRect(
    initialSelectionBounds,
    dragDelta.x,
    dragDelta.y,
  )
  let selectionSnapPoints = selectionPoints(selectionBounds)

  const nearestSnapsX: NearestSnap[] = []
  const nearestSnapsY: NearestSnap[] = []
  const minOffset = { x: threshold, y: threshold }

  collectPointSnaps(
    selectionSnapPoints,
    otherPoints,
    minOffset,
    nearestSnapsX,
    nearestSnapsY,
  )
  collectGapSnaps(selectionBounds, gaps, minOffset, nearestSnapsX, nearestSnapsY)

  const nudge = {
    x: lockedAxis === "x" ? 0 : (nearestSnapsX[0]?.nudge ?? 0),
    y: lockedAxis === "y" ? 0 : (nearestSnapsY[0]?.nudge ?? 0),
  }

  // phase 2: 应用 nudge 后精确匹配指示线
  nearestSnapsX.length = 0
  nearestSnapsY.length = 0
  minOffset.x = 0
  minOffset.y = 0

  const snappedBounds = translateRect(selectionBounds, nudge.x, nudge.y)
  selectionSnapPoints = selectionPoints(snappedBounds)

  collectPointSnaps(
    selectionSnapPoints,
    otherPoints,
    minOffset,
    nearestSnapsX,
    nearestSnapsY,
  )
  collectGapSnaps(snappedBounds, gaps, minOffset, nearestSnapsX, nearestSnapsY)

  const indicators: SnapIndicator[] = [
    ...getGapSnapLines(snappedBounds, gaps, nearestSnapsX, nearestSnapsY),
    ...getPointSnapLines(nearestSnapsX, nearestSnapsY),
  ]

  return { nudge, indicators, snappedBounds }
}

/**
 * Resize 吸附：仅点对齐（与 tldraw snapResizeShapes 一致，不含 gap）
 */
export function snapResize(input: SnapResizeInput): SnapResizeResult {
  const { rawBounds, targets, threshold, edges } = input
  const otherPoints = targets.flatMap(pointsOf)

  // 只对正在拖动的角点采样
  const pts: SnapPoint[] = []
  const r = rawBounds
  const push = (id: string, x: number, y: number) => pts.push({ id, x, y })
  if (edges.n || edges.w) push("nw", r.x, r.y)
  if (edges.n || edges.e) push("ne", r.x + r.w, r.y)
  if (edges.s || edges.e) push("se", r.x + r.w, r.y + r.h)
  if (edges.s || edges.w) push("sw", r.x, r.y + r.h)
  // 边中点
  if (edges.n && !edges.e && !edges.w) push("n", r.x + r.w / 2, r.y)
  if (edges.s && !edges.e && !edges.w) push("s", r.x + r.w / 2, r.y + r.h)
  if (edges.e && !edges.n && !edges.s) push("e", r.x + r.w, r.y + r.h / 2)
  if (edges.w && !edges.n && !edges.s) push("w", r.x, r.y + r.h / 2)

  const nearestSnapsX: NearestSnap[] = []
  const nearestSnapsY: NearestSnap[] = []
  const minOffset = { x: threshold, y: threshold }

  collectPointSnaps(pts, otherPoints, minOffset, nearestSnapsX, nearestSnapsY)

  const lockX = edges.n && edges.s ? true : !edges.e && !edges.w
  const lockY = edges.e && edges.w ? true : !edges.n && !edges.s
  // 仅 top/bottom 锁定 x；仅 left/right 锁定 y
  const isXLocked = !edges.e && !edges.w
  const isYLocked = !edges.n && !edges.s

  const nudge = {
    x: isXLocked ? 0 : (nearestSnapsX[0]?.nudge ?? 0),
    y: isYLocked ? 0 : (nearestSnapsY[0]?.nudge ?? 0),
  }
  void lockX
  void lockY

  // 把 nudge 作用到被拖的边上
  let snapped = { ...rawBounds }
  if (edges.e && !edges.w) {
    snapped.w = Math.max(1, rawBounds.w + nudge.x)
  } else if (edges.w && !edges.e) {
    snapped.x = rawBounds.x + nudge.x
    snapped.w = Math.max(1, rawBounds.w - nudge.x)
  } else if (edges.e && edges.w) {
    snapped.x = rawBounds.x + nudge.x
  }

  if (edges.s && !edges.n) {
    snapped.h = Math.max(1, rawBounds.h + nudge.y)
  } else if (edges.n && !edges.s) {
    snapped.y = rawBounds.y + nudge.y
    snapped.h = Math.max(1, rawBounds.h - nudge.y)
  } else if (edges.n && edges.s) {
    snapped.y = rawBounds.y + nudge.y
  }

  // 精确指示
  nearestSnapsX.length = 0
  nearestSnapsY.length = 0
  minOffset.x = 0
  minOffset.y = 0
  const snappedPts = selectionPoints(snapped)
  collectPointSnaps(snappedPts, otherPoints, minOffset, nearestSnapsX, nearestSnapsY)

  return {
    nudge,
    indicators: getPointSnapLines(nearestSnapsX, nearestSnapsY),
    snappedBounds: snapped,
  }
}

export function thresholdFromZoom(zoom: number, screenPx = SNAP_THRESHOLD_SCREEN): number {
  return screenPx / Math.max(0.05, zoom)
}
