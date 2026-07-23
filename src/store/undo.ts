// ============================================================
//  undo/redo —— 基于 immer patch 的撤销重做
//  每次 mutator 跑 produceWithPatches，记录 patches + inversePatches
//  past/future 栈，上限 100
//  拖拽路径：apply（无历史）+ recordTransition（松手记一条）
// ============================================================
import {
  applyPatches,
  enablePatches,
  produce,
  produceWithPatches,
  type Patch,
} from "immer"

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
    this.pushEntry({ patches, inverse })
    return next as T
  }

  /** 无历史 mutate（拖拽过程中的 live 预览） */
  apply(state: T, mutator: (draft: T) => void): T {
    return produce(
      state as Parameters<typeof produce>[0],
      mutator as Parameters<typeof produce>[1],
    ) as T
  }

  /**
   * 把 from→to 记为一条历史（拖拽松手时用）。
   * document 已处于 to，只补 past 栈；无 diff 则跳过。
   */
  recordTransition(from: T, to: T): boolean {
    const [, patches, inverse] = produceWithPatches(
      from as Parameters<typeof produceWithPatches>[0],
      (draft) => {
        const target = to as Record<string, unknown>
        const d = draft as Record<string, unknown>
        for (const key of Object.keys(target)) {
          d[key] = target[key]
        }
      },
    )
    if (patches.length === 0) return false
    this.pushEntry({ patches, inverse })
    return true
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

  private pushEntry(entry: PatchEntry): void {
    this.past.push(entry)
    if (this.past.length > MAX_HISTORY) this.past.shift()
    this.future = []
  }
}
