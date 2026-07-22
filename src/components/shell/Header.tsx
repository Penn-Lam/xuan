// ============================================================
//  Header —— 顶部栏：页面名称 / 模式切换 / 导入导出
// ============================================================
import { useRef } from "react"
import { useTheme } from "next-themes"
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  DownloadSimple,
  UploadSimple,
  BracketsCurly,
  Sparkle,
  TreeStructure,
  FrameCorners,
  Translate,
  Desktop,
  Sun,
  Moon,
  Check,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useEditorStore } from "@/store/useEditorStore"
import { serializeDocument } from "@/model/serialize"
import { importFromJson } from "@/model/deserialize"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
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
import { useI18n } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n-messages"
import { websiteConfig } from "@/config/website"
import { PageMenu } from "./PageMenu"

export function Header() {
  const { locale, setLocale, t } = useI18n()
  const { theme, setTheme } = useTheme()
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
      toast.success(t("Exported JSON"), { description: t("Copied to clipboard and downloaded") })
    } catch (e) {
      toast.error(t("Export failed"), { description: String(e) })
    }
  }

  const handleCopyPrompt = async () => {
    try {
      const exported = serializeDocument(document)
      const prompt = buildGenerationPrompt(exported)
      await navigator.clipboard.writeText(prompt)
      toast.success(t("Copied generation prompt"), {
        description: t("Paste into your AI tool to generate the page"),
      })
    } catch (e) {
      toast.error(t("Copy failed"), { description: String(e) })
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
        toast.success(t("Imported document"), { description: file.name })
      } catch (err) {
        toast.error(t("Import failed"), { description: String(err) })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-4">
      {/* 左：页面切换 + 页面名称 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <img
          src={websiteConfig.metadata.images.logoLight}
          alt="宣"
          className="size-7 shrink-0 object-contain dark:hidden"
        />
        <img
          src={websiteConfig.metadata.images.logoDark}
          alt=""
          aria-hidden="true"
          className="hidden size-7 shrink-0 object-contain dark:block"
        />
        <PageMenu />
        <Input
          value={document.meta.name}
          onChange={(e) => setDocumentName(e.target.value)}
          className="h-8 w-48 rounded-none border-0 bg-transparent px-1 shadow-none focus-visible:border-b focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
          aria-label={t("Document name")}
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
          aria-label={t("Undo")}
        >
          <ArrowCounterClockwise />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={redo}
          disabled={!history.canRedo()}
          aria-label={t("Redo")}
        >
          <ArrowClockwise />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          <UploadSimple />
          {t("Import")}
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
            {t("Export")}
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

        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label={t("Language")}
          >
            <Translate />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["zh", "en"] as Locale[]).map((value) => (
              <DropdownMenuItem key={value} onClick={() => setLocale(value)}>
                <span className="w-4">{locale === value && <Check />}</span>
                {t(value === "zh" ? "Chinese" : "English")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label={t("Theme")}
          >
            {theme === "light" ? <Sun /> : theme === "dark" ? <Moon /> : <Desktop />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {([
              ["system", "System", Desktop],
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
            ] as const).map(([value, label, Icon]) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                <Icon />
                {t(label)}
                <span className="ml-auto w-4">{theme === value && <Check />}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
