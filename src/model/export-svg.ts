/**
 * [INPUT]: 依赖 @/types/document 的 ExportDoc/ExportNode/XuanDocument；
 *          依赖 ./serialize 的 serializeDocument（扁平→导出树）
 * [OUTPUT]: 对外提供 exportSvg / documentToSvg —— 导出树或内部文档 → SVG 线框字符串
 * [POS]: model/ 的 SVG 导出器，与 serialize 同层（纯函数、无 React）；
 *        Header 与 CLI 复用；嵌套 <g> + 相对坐标，便于 Figma/Inkscape 二次编辑
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ExportDoc, ExportNode, XuanDocument } from "@/types/document"
import { serializeDocument } from "./serialize"

/* ----------------------------- 视觉 token（线框） ----------------------------- */

const FILL_PAGE = "#ffffff"
const FILL_NODE = "#f5f5f5"
const STROKE = "#d4d4d4"
const STROKE_TEXT = "#a3a3a3"
const TEXT_FILL = "#171717"
const FONT_SIZE = 12
const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif"
const LABEL_PAD_X = 6
const LABEL_PAD_Y = 16
const STROKE_WIDTH = 1
const RECT_RX = 6

/* ----------------------------- 工具 ----------------------------- */

/** XML 属性/文本转义 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** 扫描子树，取包围盒（绝对坐标） */
function boundsOf(node: ExportNode): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = node.rect.x
  let minY = node.rect.y
  let maxX = node.rect.x + node.rect.w
  let maxY = node.rect.y + node.rect.h
  for (const child of node.children) {
    const b = boundsOf(child)
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }
  return { minX, minY, maxX, maxY }
}

/** 节点形状几何（相对父组原点 0,0） */
function shapeMarkup(node: ExportNode, isRoot: boolean): string {
  const { w, h } = node.rect
  const fill = isRoot ? FILL_PAGE : FILL_NODE

  if (node.shape === "ellipse") {
    const cx = w / 2
    const cy = h / 2
    const rx = Math.max(0, w / 2)
    const ry = Math.max(0, h / 2)
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}"/>`
  }

  if (node.shape === "text") {
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="${RECT_RX}" fill="${fill}" stroke="${STROKE_TEXT}" stroke-width="${STROKE_WIDTH}" stroke-dasharray="4 3"/>`
  }

  return `<rect x="0" y="0" width="${w}" height="${h}" rx="${RECT_RX}" fill="${fill}" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}"/>`
}

/** 标签：优先 content.text，否则 name */
function labelText(node: ExportNode): string {
  const fromContent = node.content?.text
  if (typeof fromContent === "string" && fromContent.trim()) return fromContent
  return node.name
}

function labelMarkup(node: ExportNode): string {
  const text = labelText(node)
  if (!text) return ""
  // 窄节点不硬塞字，仍输出（二次编辑时可见）
  const x = LABEL_PAD_X
  const y = Math.min(LABEL_PAD_Y, Math.max(FONT_SIZE, node.rect.h - 4))
  return `<text x="${x}" y="${y}" fill="${TEXT_FILL}" font-size="${FONT_SIZE}" font-family="${FONT_FAMILY}" font-weight="600">${escapeXml(text)}</text>`
}

/**
 * 递归节点 → 嵌套 <g>。
 * ExportNode.rect 为绝对坐标；子节点相对父节点用 translate 建立局部坐标系。
 */
function renderNode(node: ExportNode, parentAbs: { x: number; y: number }, isRoot: boolean): string {
  const relX = node.rect.x - parentAbs.x
  const relY = node.rect.y - parentAbs.y

  const attrs = [
    `id="${escapeXml(node.id)}"`,
    `data-xuan-id="${escapeXml(node.id)}"`,
    `data-role="${escapeXml(node.role)}"`,
    `data-name="${escapeXml(node.name)}"`,
    `data-shape="${node.shape}"`,
  ]
  if (node.component?.ref) {
    attrs.push(`data-component="${escapeXml(node.component.ref)}"`)
  }

  const transform =
    relX === 0 && relY === 0 ? "" : ` transform="translate(${relX} ${relY})"`

  const children = node.children
    .map((c) => renderNode(c, { x: node.rect.x, y: node.rect.y }, false))
    .join("")

  return `<g${transform} ${attrs.join(" ")}>${shapeMarkup(node, isRoot)}${labelMarkup(node)}${children}</g>`
}

/* ----------------------------- 公开 API ----------------------------- */

/**
 * ExportDoc → SVG 字符串（线框，嵌套分组）。
 * viewBox 取 viewport 与内容包围盒的并集，避免裁切。
 */
export function exportSvg(doc: ExportDoc): string {
  const { tree, meta } = doc
  const b = boundsOf(tree)
  const width = Math.max(meta.viewport.width, b.maxX, 1)
  const height = Math.max(meta.viewport.height, b.maxY, 1)
  const title = escapeXml(meta.name)

  const body = renderNode(tree, { x: 0, y: 0 }, true)

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`,
    `  <title>${title}</title>`,
    `  <desc>xuan wireframe export · ${escapeXml(meta.designSystem)}</desc>`,
    `  ${body}`,
    `</svg>`,
    ``,
  ].join("\n")
}

/** 内部扁平文档 → SVG（先 materialize + serialize） */
export function documentToSvg(doc: XuanDocument): string {
  return exportSvg(serializeDocument(doc))
}
