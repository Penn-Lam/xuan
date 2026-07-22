// ============================================================
//  ID 生成 —— node_ 前缀 + nanoid
// ============================================================
import { customAlphabet } from "nanoid"

// 去掉易混字符（0/O, 1/l/I），小写字母 + 数字
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10)

/** 生成节点 ID：node_xxxxxx */
export function genNodeId(): string {
  return `node_${nanoid()}`
}

/** 生成页面 ID：page_xxxxxx */
export function genPageId(): string {
  return `page_${nanoid()}`
}
