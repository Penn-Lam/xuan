// ============================================================
//  undo/redo —— 基于 immer patch 的撤销重做
//  每次 mutator 跑 produceWithPatches，记录 patches + inversePatches
//  past/future 栈，上限 100
// ============================================================
import { applyPatches, enablePatches, produceWithPatches, type Patch } from "immer"

// 启用 Immer 的 Patches 插件（undo/redo 依赖）
enablePatches()

export interface PatchEntry {
  patches: Patch[]
  inverse: Patch[]
}

const MAX_HISTORY = 100

/** 带撤销历史的包装器（T 需满足 immer 的可变约束） */
export class History<T> {
  past: PatchEntry[] = []
  future: PatchEntry[] = []

  /** 执行一次可变操作，自动记录 patch */
  commit(state: T, mutator: (draft: T) => void): T {
    const [next, patches, inverse] = produceWithPatches(
      state as Parameters<typeof produceWithPatches>[0],
      mutator as Parameters<typeof produceWithPatches>[1],
    )
    this.past.push({ patches, inverse })
    if (this.past.length > MAX_HISTORY) this.past.shift()
    this.future = []
    return next as T
  }

  undo(state: T): T {
    const entry = this.past.pop()
    if (!entry) return state
    this.future.push(entry)
    return applyPatches(state as Parameters<typeof applyPatches>[0], entry.inverse) as T
  }

  redo(state: T): T {
    const entry = this.future.pop()
    if (!entry) return state
    this.past.push(entry)
    return applyPatches(state as Parameters<typeof applyPatches>[0], entry.patches) as T
  }

  canUndo(): boolean {
    return this.past.length > 0
  }
  canRedo(): boolean {
    return this.future.length > 0
  }

  /** 清空历史（切换页面时） */
  reset(): void {
    this.past = []
    this.future = []
  }
}
