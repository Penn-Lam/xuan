// ============================================================
//  Inspector / Content —— 内容意图 JSON 编辑
// ============================================================
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useEditorStore } from "@/store/useEditorStore"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ContentSection() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)
  const setContent = useEditorStore((s) => s.setContent)

  const [text, setText] = useState("")
  const node = selectedId ? document.nodes[selectedId] : null
  const content = node?.content ?? null

  useEffect(() => {
    setText(content ? JSON.stringify(content, null, 2) : "")
  }, [content, selectedId])

  if (!selectedId || !node) return null

  const handleCommit = () => {
    try {
      const parsed = text.trim() ? JSON.parse(text) : null
      setContent(selectedId, parsed)
    } catch {
      toast.error("Invalid JSON in content")
    }
  }

  return (
    <section className="border-b p-4">
      <h3 className="mb-3 text-sm font-semibold">Content</h3>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          Content Intent (JSON)
        </Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleCommit}
          placeholder='{\n  "text": "..."\n}'
          className="min-h-24 font-mono text-xs"
          spellCheck={false}
        />
      </div>
    </section>
  )
}
