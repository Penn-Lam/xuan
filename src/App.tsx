// ============================================================
//  App —— 三栏布局：Header + 编辑区 + Inspector
// ============================================================
import { Fragment, useEffect } from "react"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/store/useEditorStore"
import { Header } from "@/components/shell/Header"
import { Inspector } from "@/components/shell/Inspector"
import { MindmapEditor } from "@/components/mindmap/MindmapEditor"
import { CanvasEditor } from "@/components/canvas/CanvasEditor"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useI18n } from "@/lib/i18n"
import { useAgentDocumentSync } from "@/lib/use-agent-document-sync"

export default function App() {
  useAgentDocumentSync()
  const { resolvedTheme, setTheme } = useTheme()
  const mode = useEditorStore((s) => s.mode)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.shiftKey && key === "d") {
        event.preventDefault()
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
        return
      }
      if (!modifier || (key !== "z" && key !== "y")) return

      event.preventDefault()
      if (key === "y" || event.shiftKey) redo()
      else undo()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [redo, resolvedTheme, setTheme, undo])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/40 text-foreground">
      <Header />
      <main className="grid flex-1 grid-cols-[minmax(0,1fr)_292px] overflow-hidden">
        <div className="relative overflow-hidden">
          {mode === "mindmap" ? <MindmapEditor /> : <CanvasEditor />}
          <ShortcutHints mode={mode} />
        </div>
        <Inspector />
      </main>
    </div>
  )
}

function ShortcutHints({ mode }: { mode: "mindmap" | "canvas" }) {
  const { t } = useI18n()
  const shortcuts: [string[], string][] =
    mode === "mindmap"
      ? [
          [["Tab"], "Child"],
          [["↵"], "Sibling"],
          [["F2"], "Rename"],
          [["⌘", "D"], "Duplicate"],
          [["⌫"], "Delete"],
        ]
      : [
          [["⌥", "Click"], "Multi-select"],
          [["⌥", "Drag"], "Duplicate drag"],
          [["⇧", "Drag"], "Lock axis"],
          [["Space", "Drag"], "Pan"],
        ]

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border bg-background/90 px-2 py-1.5 text-xs text-muted-foreground shadow-xs backdrop-blur">
      {shortcuts.map(([keys, action]) => (
        <span key={action} className="flex items-center gap-1">
          <KbdGroup>
            {keys.map((key, index) => (
              <Fragment key={key}>
                {index > 0 && <span aria-hidden="true">+</span>}
                <Kbd>{key}</Kbd>
              </Fragment>
            ))}
          </KbdGroup>
          {t(action)}
        </span>
      ))}
    </div>
  )
}
