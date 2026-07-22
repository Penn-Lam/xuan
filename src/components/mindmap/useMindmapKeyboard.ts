// ============================================================
//  useMindmapKeyboard —— IA 模式键盘快捷键
//  Tab=加子节点 / Enter/F2=重命名 / Delete=删分支
//  方向键=导航 / Cmd+Z=撤销 / Cmd+C/V=复制粘贴 / Cmd+D=复制
// ============================================================
import { useEffect } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import {
  navigateUp,
  navigateDown,
  navigateLeft,
  navigateRight,
  subtreeSize,
} from "@/lib/geometry"

export function useMindmapKeyboard(): void {
  const document = useEditorStore((s) => s.document)
  const selectedId = useEditorStore((s) => s.selectedId)
  const renamingId = useEditorStore((s) => s.renamingId)
  const selectNode = useEditorStore((s) => s.selectNode)
  const setRenaming = useEditorStore((s) => s.setRenaming)
  const addNode = useEditorStore((s) => s.addNode)
  const removeNode = useEditorStore((s) => s.removeNode)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const copySubtree = useEditorStore((s) => s.copySubtree)
  const pasteSubtree = useEditorStore((s) => s.pasteSubtree)
  const duplicateNode = useEditorStore((s) => s.duplicateNode)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在内联重命名，只处理 Escape/Enter（由 input 自己处理提交）
      if (renamingId) {
        if (e.key === "Escape") {
          setRenaming(null)
          e.preventDefault()
        }
        return
      }

      // 输入框聚焦时跳过（Inspector 里的 input/textarea）
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return

      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl 系列
      if (mod) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault()
            if (e.shiftKey) redo()
            else undo()
            return
          case "y":
            e.preventDefault()
            redo()
            return
          case "c":
            if (selectedId) {
              e.preventDefault()
              copySubtree(selectedId)
            }
            return
          case "v":
            if (selectedId) {
              e.preventDefault()
              pasteSubtree(selectedId)
            }
            return
          case "d":
            if (selectedId) {
              e.preventDefault()
              duplicateNode(selectedId)
            }
            return
        }
        return
      }

      // 非 Cmd 系列（需要选中节点）
      if (!selectedId) return
      const rootId = document.rootId

      switch (e.key) {
        case "Tab":
          e.preventDefault()
          addNode(selectedId, "New Section", "section")
          return

        case "Enter":
        case "F2":
          e.preventDefault()
          if (selectedId !== rootId) setRenaming(selectedId)
          return

        case "Delete":
        case "Backspace":
          e.preventDefault()
          if (selectedId === rootId) return
          // >3 节点子树确认删除
          const size = subtreeSize(document, selectedId)
          if (size > 3) {
            if (!confirm(`Delete "${document.nodes[selectedId]?.name}" and ${size - 1} descendant${size - 1 > 1 ? "s" : ""}?`)) return
          }
          removeNode(selectedId)
          return

        case "ArrowUp":
          e.preventDefault()
          selectNode(navigateUp(document, selectedId))
          return
        case "ArrowDown":
          e.preventDefault()
          selectNode(navigateDown(document, selectedId))
          return
        case "ArrowLeft":
          e.preventDefault()
          selectNode(navigateLeft(document, selectedId))
          return
        case "ArrowRight":
          e.preventDefault()
          selectNode(navigateRight(document, selectedId))
          return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    document,
    selectedId,
    renamingId,
    selectNode,
    setRenaming,
    addNode,
    removeNode,
    undo,
    redo,
    copySubtree,
    pasteSubtree,
    duplicateNode,
  ])
}
