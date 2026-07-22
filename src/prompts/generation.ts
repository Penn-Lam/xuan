// ============================================================
//  AI 生成 prompt 模板 —— 把导出 JSON 包装成结构化生成指令
// ============================================================
import type { ExportDoc } from "@/types/document"
import { COMPONENTS } from "@/store/catalog"

/** 构建发给 AI 的生成 prompt */
export function buildGenerationPrompt(doc: ExportDoc, notes?: string): string {
  const json = JSON.stringify(doc, null, 2)
  return `You are a senior frontend engineer. Your task is to accurately turn a wireframe JSON document into runnable page code.

# Input Format
- name and role describe the intent of each region.
- rect contains absolute canvas coordinates and dimensions.
- Rect dimensions are reference measurements, not fixed min/max constraints.
- component.ref names the required component. component.props must be respected as provided.
- The children array order is the render order.

# Generation Rules
1. Stack: React + TypeScript + Tailwind CSS + shadcn/ui.
2. Infer layout from sibling rect positions, sizes, and repetition patterns:
   prefer flex for one-axis arrangements and grid for regular matrices.
3. Convert canvas coordinates into reasonable spacing, proportions, and responsive
   constraints. Do not write every node as absolute positioning.
4. Use absolute positioning only for overlaps, overlays.
5. Use semantic HTML elements for nodes without a bound component.
6. Mock data must match the business context described by content.
7. For metric cards, navigation items, prioritize readable, complete content
   over the sampled rect height. Avoid fixed heights and overflow clipping.
8. Do not invent or omit regions.
9. Use the original copy from the JSON. When copy is missing, add concise placeholder
   copy based on name and role.

# Output Format
First summarize the page structure in 3-5 lines, then output a directly runnable
single-file React component.

# Available Components
${COMPONENTS.join(", ")}

# Wireframe JSON
${json}

${notes ? `# User Notes\n${notes}\n` : ""}`
}
