// ============================================================
//  Header —— 顶部栏：页面名称 / 模式切换 / 导入导出
// ============================================================
import { useRef } from "react"
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  DownloadSimple,
  UploadSimple,
  BracketsCurly,
  Sparkle,
  TreeStructure,
  FrameCorners,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useEditorStore } from "@/store/useEditorStore"
import { serializeDocument } from "@/model/serialize"
import { importFromJson } from "@/model/deserialize"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { buildGenerationPrompt } from "@/prompts/generation"
import { PageMenu } from "./PageMenu"

export function Header() {
  const document = useEditorStore((s) => s.document)
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const setDocumentName = useEditorStore((s) => s.setDocumentName)
  const replaceDocument = useEditorStore((s) => s.replaceDocument)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const history = useEditorStore((s) => s.history)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportJson = () => {
    try {
      const exported = serializeDocument(document)
      const json = JSON.stringify(exported, null, 2)
      navigator.clipboard.writeText(json)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = globalThis.document.createElement("a")
      a.href = url
      a.download = `${document.meta.name.replace(/\s+/g, "-").toLowerCase()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Exported JSON", { description: "Copied to clipboard and downloaded" })
    } catch (e) {
      toast.error("Export failed", { description: String(e) })
    }
  }

  const handleCopyPrompt = async () => {
    try {
      const exported = serializeDocument(document)
      const prompt = buildGenerationPrompt(exported)
      await navigator.clipboard.writeText(prompt)
      toast.success("Copied generation prompt", {
        description: "Paste into your AI tool to generate the page",
      })
    } catch (e) {
      toast.error("Copy failed", { description: String(e) })
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const doc = importFromJson(reader.result as string)
        replaceDocument(doc)
        toast.success("Imported document", { description: file.name })
      } catch (err) {
        toast.error("Import failed", { description: String(err) })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-4">
      {/* 左：页面切换 + 页面名称 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <img src="/logo.png" alt="宣" className="size-7 shrink-0 object-contain" />
        <PageMenu />
        <Input
          value={document.meta.name}
          onChange={(e) => setDocumentName(e.target.value)}
          className="h-8 w-48"
          aria-label="Document name"
        />
      </div>

      {/* 中：模式切换（带图标） */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList>
          <TabsTrigger value="mindmap">
            <TreeStructure width={16} height={16} />
            IA
          </TabsTrigger>
          <TabsTrigger value="canvas">
            <FrameCorners width={16} height={16} />
            Canvas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 右：撤销重做 + 导入导出 */}
      <div className="flex flex-1 items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={undo}
          disabled={!history.canUndo()}
          aria-label="Undo"
        >
          <ArrowCounterClockwise />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={redo}
          disabled={!history.canRedo()}
          aria-label="Redo"
        >
          <ArrowClockwise />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          <UploadSimple />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ size: "sm" })}
          >
            <DownloadSimple />
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleExportJson}>
                <BracketsCurly />
                JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyPrompt}>
                <Sparkle />
                Prompt
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
