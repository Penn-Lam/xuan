// ============================================================
//  Inspector —— 右侧 292px 检查器
//  选中节点时展示 Basics / Component / Content / Preview
// ============================================================
import { Cursor } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { BasicsSection } from "@/components/inspector/BasicsSection"
import { ComponentSection } from "@/components/inspector/ComponentSection"
import { ContentSection } from "@/components/inspector/ContentSection"
import { NodePreview } from "@/components/inspector/NodePreview"
import { useI18n } from "@/lib/i18n"

export function Inspector() {
  const { t } = useI18n()
  const selectedId = useEditorStore((s) => s.selectedId)

  if (!selectedId) {
    return (
      <aside
        data-testid="property-panel"
        className="flex flex-col items-center justify-center gap-2 border-l bg-background p-8 text-center"
      >
        <Cursor className="text-muted-foreground" width={32} height={32} />
        <p className="text-sm text-muted-foreground">
          {t("Select a node to edit its properties")}
        </p>
      </aside>
    )
  }

  return (
    <aside
      data-testid="property-panel"
      className="flex flex-col overflow-y-auto border-l bg-background"
    >
      <BasicsSection />
      <ComponentSection />
      <ContentSection />
      <NodePreview />
    </aside>
  )
}
