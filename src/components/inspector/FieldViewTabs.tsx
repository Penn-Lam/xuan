// ============================================================
//  FieldViewTabs —— Form / JSON 双视图切换
//  Form = SemanticFieldsEditor（结构化字段编辑）
//  JSON = 可编辑 textarea（原始 JSON 文本，Geist Mono，实时校验）
//  ComponentSection 的 Props 和 ContentSection 都复用此组件
// ============================================================
import { useEffect, useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/lib/i18n"
import { SemanticFieldsEditor } from "./SemanticFieldsEditor"
import type { SemanticField } from "@/store/catalog"

interface FieldViewTabsProps {
  definitions: SemanticField[]
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  fieldKind: "prop" | "content"
}

export function FieldViewTabs({
  definitions,
  value,
  onChange,
  fieldKind,
}: FieldViewTabsProps) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-2">
      <Tabs defaultValue="form">
        <TabsList className="h-7">
          <TabsTrigger value="form">{t("Form")}</TabsTrigger>
          <TabsTrigger value="json">{t("JSON")}</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-2">
          <SemanticFieldsEditor
            definitions={definitions}
            value={value}
            onChange={onChange}
            fieldKind={fieldKind}
          />
        </TabsContent>
        <TabsContent value="json" className="mt-2">
          <JsonTextarea value={value} onChange={onChange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** 可编辑 JSON textarea：受控于父级 value，本地草稿 + 失焦提交 + 校验 */
function JsonTextarea({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  // 父级 value 变化时（如 Form 视图编辑、切换节点）同步草稿
  useEffect(() => {
    setDraft(JSON.stringify(value, null, 2))
    setError(null)
  }, [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      onChange({})
      setError(null)
      return
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        onChange(parsed as Record<string, unknown>)
        setError(null)
      } else {
        setError("Must be a JSON object")
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        spellCheck={false}
        className={error ? "border-destructive font-mono text-xs" : "font-mono text-xs"}
        style={{ minHeight: "96px" }}
        aria-label="JSON editor"
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
