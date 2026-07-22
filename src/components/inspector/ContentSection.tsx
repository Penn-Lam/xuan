// ============================================================
//  Inspector / Content —— semantic copy and representative data
// ============================================================
import { useEditorStore } from "@/store/useEditorStore"
import { getContentFields } from "@/store/catalog"
import { Label } from "@/components/ui/label"
import { SemanticFieldsEditor } from "./SemanticFieldsEditor"
import { HelpTooltip } from "./HelpTooltip"
import { useI18n } from "@/lib/i18n"

export function ContentSection() {
  const { t } = useI18n()
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)
  const setContent = useEditorStore((s) => s.setContent)
  const node = selectedId ? document.nodes[selectedId] : null

  if (!selectedId || !node) return null

  return (
    <section className="border-b p-4">
      <h3 className="mb-3 text-sm font-semibold">{t("Content")}</h3>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">{t("Semantic content")}</Label>
          <HelpTooltip content={t("Describe the copy or representative data without writing JSON.")} />
        </div>
        <SemanticFieldsEditor
          key={selectedId}
          definitions={getContentFields(node.role, node.component?.ref)}
          value={node.content ?? {}}
          onChange={(content) =>
            setContent(selectedId, Object.keys(content).length > 0 ? content : null)
          }
          fieldKind="content"
        />
      </div>
    </section>
  )
}
