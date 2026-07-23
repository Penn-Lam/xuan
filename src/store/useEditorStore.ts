// ============================================================
//  Zustand store —— xuan 编辑器的核心状态
//  document（镜像当前活动页）+ pages（多页 map）+ undo/redo + selection
//  persist 仅存 pages + activePageId（会话态不持久化）
// ============================================================
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CanvasData, Rect, XuanDocument } from "@/types/document"
import { genNodeId, genPageId } from "@/lib/id"
import { clampRect, collectDescendants, isDescendant } from "@/lib/geometry"
import { createBlankPage, createDefaultDocument } from "@/model/factories"
import { materializeDocument } from "@/model/materialize"
import { History } from "./undo"

export type EditorMode = "mindmap" | "canvas"

/** 序列化的子树快照（不含真实 ID，粘贴时重新生成） */
interface SerializedSubtree {
  name: string
  role: string
  component: { ref: string; props: Record<string, unknown> } | null
  content: Record<string, unknown> | null
  shape: import("@/types/document").NodeShape
  children: SerializedSubtree[]
}

interface EditorState {
  /* ---- 持久化 ---- */
  pages: Record<string, XuanDocument>
  activePageId: string

  /* ---- 会话态（不持久化）---- */
  document: XuanDocument
  mode: EditorMode
  selectedId: string | null
  selectedIds: string[]
  /** 正在重命名的节点 ID（IA 内联编辑） */
  renamingId: string | null
  history: History<XuanDocument>
  /** 剪贴板：序列化的子树快照（不含 ID，粘贴时重新生成） */
  clipboard: SerializedSubtree | null

  /* ---- 模式与选择 ---- */
  setMode: (mode: EditorMode) => void
  selectNode: (id: string | null) => void
  /** 批量设置选区（框选 / 多选替换） */
  selectNodes: (ids: string[]) => void
  toggleNodeSelection: (id: string) => void
  setRenaming: (id: string | null) => void

  /* ---- 页面管理 ---- */
  createPage: (name?: string) => void
  switchPage: (id: string) => void
  deletePage: (id: string) => void
  setDocumentName: (name: string) => void

  /* ---- 节点增删改（可撤销）---- */
  addNode: (parentId: string, name: string, role?: string) => string
  removeNode: (id: string) => void
  removeNodes: (ids: string[]) => void
  renameNode: (id: string, name: string) => void
  setRole: (id: string, role: string) => void
  setComponent: (
    id: string,
    component: { ref: string; props: Record<string, unknown> } | null,
  ) => void
  setContent: (id: string, content: Record<string, unknown> | null) => void
  updateCanvasRect: (id: string, rect: Rect) => void
  /**
   * 批量更新多个节点 rect。
   * history:true（默认）= 立即记一条 undo；
   * false = 并入当前 history batch（首次自动记下 baseline），需 sealHistoryBatch 收口。
   */
  updateCanvasRects: (
    updates: { id: string; rect: Rect }[],
    options?: { history?: boolean },
  ) => void
  /**
   * 把当前 live batch 压成一条 undo。
   * 拖拽松手 / 方向键连击停顿后调用；其它 commit/undo 也会自动 seal。
   */
  sealHistoryBatch: () => void
  updateCanvasData: (id: string, data: Partial<CanvasData>) => void
  reparentNode: (id: string, newParentId: string) => void
  toggleCollapse: (id: string) => void

  /* ---- 剪贴板（子树复制/粘贴/复制）---- */
  copySubtree: (id: string) => void
  pasteSubtree: (parentId: string) => string | null
  duplicateNode: (id: string) => string | null

  /* ---- 导入/导出/文档替换 ---- */
  replaceDocument: (doc: XuanDocument) => void
  upsertAgentDocument: (doc: XuanDocument) => void

  /* ---- undo/redo ---- */
  undo: () => void
  redo: () => void
}

/**
 * Live history batch baseline。
 * 拖拽 / 连点方向键等「一段手势」共享同一 baseline，seal 时压成一条 undo。
 * 放模块作用域，避免无关 re-render。
 */
let historyBatchBaseline: XuanDocument | null = null

function sealHistoryBatchInternal(get: () => EditorState): void {
  if (!historyBatchBaseline) return
  const state = get()
  state.history.recordTransition(historyBatchBaseline, state.document)
  historyBatchBaseline = null
}

function ensureHistoryBatch(get: () => EditorState): void {
  if (!historyBatchBaseline) historyBatchBaseline = get().document
}

/** 丢弃未 seal 的 batch（换页/换文档时，不写入 history） */
function discardHistoryBatch(): void {
  historyBatchBaseline = null
}

/** 可撤销的 mutator 包装（先收口未 seal 的 live batch） */
function commit(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  mutator: (draft: XuanDocument) => void,
): void {
  sealHistoryBatchInternal(get)
  const state = get()
  const next = state.history.commit(state.document, mutator)
  set({
    document: next,
    pages: { ...state.pages, [state.activePageId]: next },
  })
}

/** 无历史 mutator（拖拽 / 连点方向键 live 预览） */
function applyLive(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  mutator: (draft: XuanDocument) => void,
): void {
  ensureHistoryBatch(get)
  const state = get()
  const next = state.history.apply(state.document, mutator)
  set({
    document: next,
    pages: { ...state.pages, [state.activePageId]: next },
  })
}

/** 对 draft 应用一批 rect 更新（commit / live 共用） */
function applyRectUpdates(
  draft: XuanDocument,
  updates: { id: string; rect: Rect }[],
): void {
  for (const { id, rect } of updates) {
    const canvas = draft.canvas[id]
    const node = draft.nodes[id]
    if (!canvas || !node) continue
    if (node.parentId) {
      const parentCanvas = draft.canvas[node.parentId]
      canvas.rect = clampRect(rect, parentCanvas.rect)
    } else {
      canvas.rect = rect
      draft.meta.viewport = { width: rect.w, height: rect.h }
    }
    canvas.placed = true
  }
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => {
      // 初始：默认示例文档
      const initialDoc = createDefaultDocument()
      const initialPageId = genPageId()

      return {
        pages: { [initialPageId]: initialDoc },
        activePageId: initialPageId,
        document: initialDoc,
        mode: "mindmap",
        selectedId: initialDoc.rootId,
        selectedIds: [initialDoc.rootId],
        renamingId: null,
        history: new History(),
        clipboard: null,

        /* ============ 模式与选择 ============ */
        setMode: (mode) => {
          if (mode === "canvas") {
            // 切到 Canvas 时自动放置未定位节点
            const state = get()
            const materialized = materializeDocument(state.document)
            const next = state.history.commit(state.document, (draft) => {
              Object.assign(draft, materialized)
            })
            set({
              document: next,
              pages: { ...state.pages, [state.activePageId]: next },
              mode,
            })
          } else {
            set({ mode })
          }
        },

        selectNode: (id) =>
          set({ selectedId: id, selectedIds: id ? [id] : [], renamingId: null }),

        selectNodes: (ids) =>
          set({
            selectedIds: ids,
            selectedId: ids[ids.length - 1] ?? null,
            renamingId: null,
          }),

        toggleNodeSelection: (id) => {
          const state = get()
          const selectedIds = state.selectedIds.includes(id)
            ? state.selectedIds.filter((selectedId) => selectedId !== id)
            : [...state.selectedIds, id]
          set({
            selectedIds,
            selectedId: selectedIds.includes(id)
              ? id
              : selectedIds[selectedIds.length - 1] ?? null,
            renamingId: null,
          })
        },

        setRenaming: (id) => set({ renamingId: id }),

        /* ============ 页面管理 ============ */
        createPage: (name) => {
          discardHistoryBatch()
          const state = get()
          const id = genPageId()
          const viewport = state.document.meta.viewport
          const doc = createBlankPage(name?.trim() || "Untitled", viewport)
          const pages = { ...state.pages, [id]: doc }
          discardHistoryBatch()
          set({
            pages,
            activePageId: id,
            document: doc,
            selectedId: doc.rootId,
            selectedIds: [doc.rootId],
            history: new History(),
          })
        },

        switchPage: (id) => {
          const state = get()
          const doc = state.pages[id]
          if (!doc) return
          discardHistoryBatch()
          discardHistoryBatch()
          set({
            activePageId: id,
            document: doc,
            selectedId: doc.rootId,
            selectedIds: [doc.rootId],
            history: new History(),
          })
        },

        deletePage: (id) => {
          const state = get()
          if (Object.keys(state.pages).length <= 1) return
          discardHistoryBatch()
          const pages = { ...state.pages }
          delete pages[id]
          const nextActive =
            id === state.activePageId ? Object.keys(pages)[0] : state.activePageId
          const doc = pages[nextActive]
          discardHistoryBatch()
          set({
            pages,
            activePageId: nextActive,
            document: doc,
            selectedId: doc.rootId,
            selectedIds: [doc.rootId],
            history: new History(),
          })
        },

        setDocumentName: (name) => {
          commit(get, set, (draft) => {
            draft.meta.name = name
          })
        },

        /* ============ 节点增删改 ============ */
        addNode: (parentId, name, role = "section") => {
          const id = genNodeId()
          commit(get, set, (draft) => {
            const parent = draft.nodes[parentId]
            if (!parent) return
            parent.childrenIds.push(id)
            draft.nodes[id] = {
              id,
              parentId,
              childrenIds: [],
              name,
              role,
              component: null,
              content: null,
            }
            draft.canvas[id] = {
              rect: { x: 16, y: 16, w: 80, h: 80 },
              shape: "rectangle",
              placed: false,
            }
            draft.mindmap[id] = { collapsed: false }
          })
          set({ selectedId: id, selectedIds: [id] })
          return id
        },

        removeNode: (id) => get().removeNodes([id]),

        removeNodes: (ids) => {
          const state = get()
          const removableIds = ids.filter(
            (id) =>
              id !== state.document.rootId &&
              state.document.nodes[id] &&
              !ids.some(
                (ancestorId) =>
                  ancestorId !== id &&
                  isDescendant(state.document, ancestorId, id),
              ),
          )
          if (removableIds.length === 0) return
          commit(get, set, (draft) => {
            removableIds.forEach((id) => {
              const node = draft.nodes[id]
              if (!node?.parentId) return
              const toDelete = collectDescendants(draft, id, true)
              const parent = draft.nodes[node.parentId]
              parent.childrenIds = parent.childrenIds.filter((cid) => cid !== id)
              toDelete.forEach((deletedId) => {
                delete draft.nodes[deletedId]
                delete draft.canvas[deletedId]
                delete draft.mindmap[deletedId]
              })
            })
          })
          set({ selectedId: null, selectedIds: [] })
        },

        renameNode: (id, name) => {
          commit(get, set, (draft) => {
            const node = draft.nodes[id]
            if (node) node.name = name
          })
        },

        setRole: (id, role) => {
          commit(get, set, (draft) => {
            const node = draft.nodes[id]
            if (node) node.role = role
          })
        },

        setComponent: (id, component) => {
          commit(get, set, (draft) => {
            const node = draft.nodes[id]
            if (node) node.component = component
          })
        },

        setContent: (id, content) => {
          commit(get, set, (draft) => {
            const node = draft.nodes[id]
            if (node) node.content = content
          })
        },

        updateCanvasRect: (id, rect) => {
          get().updateCanvasRects([{ id, rect }])
        },

        updateCanvasRects: (updates, options) => {
          if (updates.length === 0) return
          const withHistory = options?.history !== false
          const mutator = (draft: XuanDocument) => applyRectUpdates(draft, updates)
          if (withHistory) commit(get, set, mutator)
          else applyLive(get, set, mutator)
        },

        sealHistoryBatch: () => {
          sealHistoryBatchInternal(get)
        },

        updateCanvasData: (id, data) => {
          commit(get, set, (draft) => {
            const canvas = draft.canvas[id]
            const node = draft.nodes[id]
            if (!canvas || !node) return
            if (data.shape) canvas.shape = data.shape
            if (data.placed !== undefined) canvas.placed = data.placed
            if (data.rect) {
              if (node.parentId) {
                const parentCanvas = draft.canvas[node.parentId]
                canvas.rect = clampRect(data.rect, parentCanvas.rect)
              } else {
                canvas.rect = data.rect
                draft.meta.viewport = { width: data.rect.w, height: data.rect.h }
              }
            }
          })
        },

        reparentNode: (id, newParentId) => {
          const state = get()
          // 防止拖进自己的子树
          if (id === newParentId || isDescendant(state.document, id, newParentId)) return
          if (id === state.document.rootId) return

          commit(get, set, (draft) => {
            const node = draft.nodes[id]
            if (!node?.parentId) return
            const oldParent = draft.nodes[node.parentId]
            const newParent = draft.nodes[newParentId]
            if (!oldParent || !newParent) return

            oldParent.childrenIds = oldParent.childrenIds.filter((cid) => cid !== id)
            newParent.childrenIds.push(id)
            node.parentId = newParentId
            // 重新定位到新父容器内
            const parentCanvas = draft.canvas[newParentId]
            draft.canvas[id].rect = {
              x: 16,
              y: 16,
              w: Math.max(80, parentCanvas.rect.w - 32),
              h: 80,
            }
            draft.canvas[id].placed = true
          })
        },

        toggleCollapse: (id) => {
          commit(get, set, (draft) => {
            const mm = draft.mindmap[id]
            if (mm) mm.collapsed = !mm.collapsed
          })
        },

        /* ============ 剪贴板 ============ */
        copySubtree: (id) => {
          const doc = get().document
          const serialize = (nid: string): SerializedSubtree => {
            const n = doc.nodes[nid]
            const c = doc.canvas[nid]
            return {
              name: n.name,
              role: n.role,
              component: n.component,
              content: n.content,
              shape: c.shape,
              children: n.childrenIds.map(serialize),
            }
          }
          if (!doc.nodes[id]) return
          set({ clipboard: serialize(id) })
        },

        pasteSubtree: (parentId) => {
          const clip = get().clipboard
          if (!clip) return null
          const newId = genNodeId()
          commit(get, set, (draft) => {
            const parent = draft.nodes[parentId]
            if (!parent) return
            const insert = (
              node: SerializedSubtree,
              pid: string,
              fallbackId: string,
            ): string => {
              const id = fallbackId === newId ? newId : genNodeId()
              draft.nodes[id] = {
                id,
                parentId: pid,
                childrenIds: [],
                name: node.name,
                role: node.role,
                component: node.component,
                content: node.content,
              }
              draft.canvas[id] = {
                rect: { x: 16, y: 16, w: 80, h: 80 },
                shape: node.shape,
                placed: false,
              }
              draft.mindmap[id] = { collapsed: false }
              draft.nodes[pid].childrenIds.push(id)
              node.children.forEach((child) => insert(child, id, ""))
              return id
            }
            insert(clip, parentId, newId)
          })
          set({ selectedId: newId, selectedIds: [newId] })
          return newId
        },

        duplicateNode: (id) => {
          // 复制到同一父级下（兄弟）
          const doc = get().document
          const node = doc.nodes[id]
          if (!node?.parentId) return null
          get().copySubtree(id)
          return get().pasteSubtree(node.parentId)
        },

        /* ============ 导入/替换 ============ */
        replaceDocument: (doc) => {
          discardHistoryBatch()
          const state = get()
          const pages = { ...state.pages, [state.activePageId]: doc }
          discardHistoryBatch()
          set({
            pages,
            document: doc,
            selectedId: doc.rootId,
            selectedIds: [doc.rootId],
            history: new History(),
          })
        },

        upsertAgentDocument: (doc) => {
          discardHistoryBatch()
          const state = get()
          const pageId =
            Object.keys(state.pages).find((id) => state.pages[id].rootId === doc.rootId) ??
            genPageId()
          discardHistoryBatch()
          set({
            pages: { ...state.pages, [pageId]: doc },
            activePageId: pageId,
            document: doc,
            selectedId: doc.rootId,
            selectedIds: [doc.rootId],
            history: new History(),
          })
        },

        /* ============ undo/redo ============ */
        undo: () => {
          // 先 seal live batch，使 ⌘Z 能撤销刚结束的拖拽/连点微移
          sealHistoryBatchInternal(get)
          const state = get()
          const prev = state.history.undo(state.document)
          set({
            document: prev,
            pages: { ...state.pages, [state.activePageId]: prev },
          })
        },
        redo: () => {
          sealHistoryBatchInternal(get)
          const state = get()
          const next = state.history.redo(state.document)
          set({
            document: next,
            pages: { ...state.pages, [state.activePageId]: next },
          })
        },
      }
    },
    {
      name: "xuan.pages.v1",
      // 仅持久化 pages + activePageId（会话态不存）
      partialize: (s) => ({ pages: s.pages, activePageId: s.activePageId }),
      // 恢复时从 activePageId 重建 document
      merge: (persisted, current) => {
        const p = persisted as Partial<EditorState>
        if (!p.pages || !p.activePageId || !p.pages[p.activePageId]) {
          return current
        }
        discardHistoryBatch()
        return {
          ...current,
          pages: p.pages,
          activePageId: p.activePageId,
          document: p.pages[p.activePageId],
          selectedId: p.pages[p.activePageId].rootId,
          selectedIds: [p.pages[p.activePageId].rootId],
          history: new History(),
        }
      },
    },
  ),
)
