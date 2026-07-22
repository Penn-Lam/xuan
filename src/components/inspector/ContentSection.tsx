// ============================================================
//  Inspector / Content —— semantic copy and representative data
// ============================================================
import { useEditorStore } from "@/store/useEditorStore"
import { getContentFields } from "@/store/catalog"
import { Label } from "@/components/ui/label"
import { SemanticFieldsEditor } from "./SemanticFieldsEditor"

export function ContentSection() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)
  const setContent = useEditorStore((s) => s.setContent)
  const node = selectedId ? document.nodes[selectedId] : null

  if (!selectedId || !node) return null

  return (
    <section className="border-b p-4">
      <h3 className="mb-3 text-sm font-semibold">Content</h3>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Semantic content</Label>
        <SemanticFieldsEditor
          key={selectedId}
          definitions={getContentFields(node.role, node.component?.ref)}
          value={node.content ?? {}}
          onChange={(content) =>
            setContent(selectedId, Object.keys(content).length > 0 ? content : null)
          }
          emptyMessage="Describe the copy or representative data without writing JSON."
          fieldKind="content"
        />
      </div>
    </section>
  )
}
