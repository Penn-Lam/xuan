// ============================================================
//  snap/engine.check —— 智能吸附纯函数自检
//  运行：bun src/components/canvas/snap/engine.check.ts
// ============================================================
import { createSnapSession, resolveSnapFrame, generateCandidates } from "./engine"
import { thresholdDoc, ENTER_SCREEN_PX, EXIT_SCREEN_PX } from "./constants"
import type { Rect } from "@/types/document"
import type { SnapFrameInput } from "./types"

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++
    console.log(`  ✓ ${msg}`)
  } else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

function approx(a: number, b: number, eps = 0.6) {
  return Math.abs(a - b) <= eps
}

const parent: Rect = { x: 0, y: 0, w: 800, h: 600 }
const canvas = parent

function baseInput(over: Partial<SnapFrameInput> & { rawRect: Rect }): SnapFrameInput {
  return {
    targets: [],
    parentRect: parent,
    canvasRect: canvas,
    zoom: 1,
    mode: "move",
    enableLayoutGrid: false,
    enablePixelGrid: false,
    ...over,
  }
}

console.log("1. edge align")
{
  const sibling: Rect = { x: 100, y: 100, w: 80, h: 40 }
  // self left near sibling left (diff 3)
  const raw: Rect = { x: 103, y: 200, w: 50, h: 30 }
  const r = resolveSnapFrame(
    baseInput({ rawRect: raw, targets: [sibling] }),
  )
  assert(approx(r.deltaX, -3), `left edge snap deltaX≈-3 got ${r.deltaX}`)
  assert(r.guides.some((g) => g.orientation === "v"), "has vertical guide")
}

console.log("2. center align")
{
  const sibling: Rect = { x: 100, y: 100, w: 100, h: 40 } // centerX=150
  // centerX=153 → 应吸附到 150
  const raw2: Rect = { x: 123, y: 200, w: 60, h: 30 }
  const r = resolveSnapFrame(baseInput({ rawRect: raw2, targets: [sibling] }))
  assert(approx(r.deltaX, -3), `center snap deltaX≈-3 got ${r.deltaX}`)
}

console.log("3. equal spacing")
{
  const a: Rect = { x: 0, y: 0, w: 50, h: 40 }
  const b: Rect = { x: 70, y: 0, w: 50, h: 40 } // gap 20
  // drag self to right of b with near-gap 20
  const raw: Rect = { x: 138, y: 0, w: 50, h: 40 } // want 70+50+20=140
  const r = resolveSnapFrame(baseInput({ rawRect: raw, targets: [a, b] }))
  assert(approx(r.deltaX, 2), `spacing deltaX≈2 got ${r.deltaX}`)
}

console.log("4. hysteresis hold")
{
  const session = createSnapSession()
  const sibling: Rect = { x: 100, y: 0, w: 50, h: 40 }
  // enter: error 3
  let raw: Rect = { x: 103, y: 100, w: 40, h: 30 }
  let r = session.resolve(baseInput({ rawRect: raw, targets: [sibling] }))
  assert(approx(r.deltaX, -3), `hysteresis enter delta ${r.deltaX}`)
  // move away but within exit (error 8 < 12)
  raw = { x: 108, y: 100, w: 40, h: 30 }
  r = session.resolve(baseInput({ rawRect: raw, targets: [sibling] }))
  assert(approx(r.deltaX, -8), `hysteresis hold delta ${r.deltaX}`)
}

console.log("5. hysteresis exit")
{
  const session = createSnapSession()
  const sibling: Rect = { x: 100, y: 0, w: 50, h: 40 }
  session.resolve(baseInput({ rawRect: { x: 103, y: 100, w: 40, h: 30 }, targets: [sibling] }))
  // 远离所有 sibling 关键线（error ≫ exit），且无其它进入候选
  const r = session.resolve(
    baseInput({ rawRect: { x: 200, y: 100, w: 40, h: 30 }, targets: [sibling] }),
  )
  assert(r.deltaX === 0, `hysteresis exit no snap got ${r.deltaX}`)
}

console.log("6. zoom threshold")
{
  assert(approx(thresholdDoc(ENTER_SCREEN_PX, 2), 3), "enter at zoom2 = 3")
  assert(approx(thresholdDoc(EXIT_SCREEN_PX, 2), 6), "exit at zoom2 = 6")
}

console.log("7. resize size match")
{
  const sibling: Rect = { x: 0, y: 0, w: 120, h: 40 }
  const raw: Rect = { x: 200, y: 0, w: 118, h: 50 }
  const r = resolveSnapFrame(
    baseInput({
      rawRect: raw,
      targets: [sibling],
      mode: "resize",
      resizeEdges: { e: true },
    }),
  )
  assert(
    r.sizeDelta != null && approx(r.sizeDelta.dw, 2),
    `size match dw≈2 got ${r.sizeDelta?.dw}`,
  )
}

console.log("8. multi group AABB (via rawRect=union)")
{
  const sibling: Rect = { x: 0, y: 0, w: 100, h: 100 }
  // group AABB left at 203 → snap to 200? sibling right=100... use sibling left
  const group: Rect = { x: 3, y: 50, w: 80, h: 60 }
  const r = resolveSnapFrame(baseInput({ rawRect: group, targets: [sibling] }))
  assert(approx(r.deltaX, -3), `group AABB left align ${r.deltaX}`)
}

console.log("9. candidates non-empty with targets")
{
  const c = generateCandidates(
    baseInput({
      rawRect: { x: 10, y: 10, w: 40, h: 40 },
      targets: [{ x: 100, y: 10, w: 40, h: 40 }],
      enableLayoutGrid: true,
    }),
  )
  assert(c.length > 10, `many candidates got ${c.length}`)
}

console.log("")
console.log(`Result: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
