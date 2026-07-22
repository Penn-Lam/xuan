// ============================================================
//  App —— 三栏布局：Header + 编辑区 + Inspector
// ============================================================
import { useEditorStore } from "@/store/useEditorStore"
import { Header } from "@/components/shell/Header"
import { Inspector } from "@/components/shell/Inspector"
import { MindmapEditor } from "@/components/mindmap/MindmapEditor"
import { CanvasEditor } from "@/components/canvas/CanvasEditor"
import { Toaster } from "@/components/ui/sonner"

export default function App() {
  const mode = useEditorStore((s) => s.mode)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40 text-foreground">
      <Header />
      <main className="grid flex-1 grid-cols-[minmax(0,1fr)_292px] overflow-hidden">
        <div className="relative overflow-hidden">
          {mode === "mindmap" ? <MindmapEditor /> : <CanvasEditor />}
        </div>
        <Inspector />
      </main>
      <Toaster />
    </div>
  )
}
