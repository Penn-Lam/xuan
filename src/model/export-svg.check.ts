// ============================================================
//  export-svg.check —— SVG 导出自检
//  运行：bun src/model/export-svg.check.ts
// ============================================================
import type { ExportDoc } from "@/types/document"
import { documentToSvg, exportSvg } from "./export-svg"
import { createDefaultDocument } from "./factories"
import { serializeDocument } from "./serialize"

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

const minimal: ExportDoc = {
  version: "2.0",
  meta: {
    name: "Test <Page> & \"Demo\"",
    designSystem: "shadcn/ui@latest",
    viewport: { width: 400, height: 300 },
  },
  tree: {
    id: "root",
    name: "Root",
    role: "page",
    rect: { x: 0, y: 0, w: 400, h: 300 },
    shape: "rectangle",
    component: null,
    content: null,
    children: [
      {
        id: "card",
        name: "Card & Co",
        role: "card",
        rect: { x: 20, y: 30, w: 120, h: 80 },
        shape: "rectangle",
        component: { ref: "Card", props: {} },
        content: null,
        children: [
          {
            id: "label",
            name: "Title",
            role: "heading",
            rect: { x: 28, y: 40, w: 100, h: 24 },
            shape: "text",
            component: null,
            content: { text: "Hello <world>" },
            children: [],
          },
        ],
      },
      {
        id: "oval",
        name: "Badge",
        role: "badge",
        rect: { x: 200, y: 50, w: 60, h: 60 },
        shape: "ellipse",
        component: null,
        content: null,
        children: [],
      },
    ],
  },
}

console.log("1. basic structure")
{
  const svg = exportSvg(minimal)
  assert(svg.startsWith("<?xml"), "xml declaration")
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'), "svg ns")
  assert(svg.includes('width="400"'), "width from viewport")
  assert(svg.includes('height="300"'), "height from viewport")
  assert(svg.includes('id="root"'), "root id")
  assert(svg.includes('data-role="card"'), "role attr")
  assert(svg.includes('data-component="Card"'), "component attr")
  assert(svg.includes("<ellipse"), "ellipse shape")
  assert(svg.includes('stroke-dasharray="4 3"'), "text dashed stroke")
}

console.log("2. nesting uses relative translate")
{
  const svg = exportSvg(minimal)
  // card at abs 20,30 → translate(20 30)
  assert(svg.includes('transform="translate(20 30)"'), "card relative to root")
  // label abs 28,40 → rel to card 8,10
  assert(svg.includes('transform="translate(8 10)"'), "label relative to card")
}

console.log("3. xml escape")
{
  const svg = exportSvg(minimal)
  assert(svg.includes("Test &lt;Page&gt; &amp; &quot;Demo&quot;"), "title escaped")
  assert(svg.includes("Hello &lt;world&gt;"), "label content escaped")
  assert(svg.includes('data-name="Card &amp; Co"'), "attr escaped")
  assert(!svg.includes("Hello <world>"), "raw < not in body text")
}

console.log("4. bounds expand beyond viewport")
{
  const oversized: ExportDoc = {
    ...minimal,
    meta: { ...minimal.meta, viewport: { width: 100, height: 100 } },
    tree: {
      ...minimal.tree,
      rect: { x: 0, y: 0, w: 50, h: 50 },
      children: [
        {
          id: "far",
          name: "Far",
          role: "region",
          rect: { x: 500, y: 400, w: 100, h: 80 },
          shape: "rectangle",
          component: null,
          content: null,
          children: [],
        },
      ],
    },
  }
  const svg = exportSvg(oversized)
  assert(svg.includes('width="600"'), "width = max content")
  assert(svg.includes('height="480"'), "height = max content")
}

console.log("5. default document pipeline")
{
  const doc = createDefaultDocument()
  const svg = documentToSvg(doc)
  const exported = serializeDocument(doc)
  assert(svg.includes(`data-xuan-id="${exported.tree.id}"`), "root from serialize")
  assert(svg.includes("<svg"), "valid-ish svg")
  assert(svg.length > 500, "non-trivial size")
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
