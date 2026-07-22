// ============================================================
//  Inspector / Component —— shadcn 组件绑定 + props JSON 编辑
// ============================================================
import { useState, useEffect } from "react"
import { Cube, X } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useEditorStore } from "@/store/useEditorStore"
import { COMPONENTS } from "@/store/catalog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ComponentSection() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)
  const setComponent = useEditorStore((s) => s.setComponent)

  // 本地编辑态，失焦时提交
  const [propsText, setPropsText] = useState("")
  const node = selectedId ? document.nodes[selectedId] : null
  const component = node?.component ?? null

  useEffect(() => {
    setPropsText(component ? JSON.stringify(component.props, null, 2) : "")
  }, [component, selectedId])

  if (!selectedId || !node) return null

  const handleUnbind = () => {
    setComponent(selectedId, null)
    setPropsText("")
  }

  const handleCommitProps = () => {
    if (!component) return
    try {
      const parsed = propsText.trim() ? JSON.parse(propsText) : {}
      setComponent(selectedId, { ref: component.ref, props: parsed })
    } catch {
      toast.error("Invalid JSON in props")
    }
  }

  return (
    <section className="border-b p-4">
      <h3 className="mb-3 text-sm font-semibold">Component</h3>
      {component ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Cube className="text-muted-foreground" width={16} height={16} />
            <code className="flex-1 text-sm font-medium">{component.ref}</code>
            <Button variant="ghost" size="icon-xs" onClick={handleUnbind} aria-label="Unbind">
              <X />
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Props (JSON)</Label>
            <Textarea
              value={propsText}
              onChange={(e) => setPropsText(e.target.value)}
              onBlur={handleCommitProps}
              className="min-h-24 font-mono text-xs"
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Bind Component</Label>
          <Select
            value=""
            onValueChange={(ref) => { if (ref) setComponent(selectedId, { ref, props: {} }) }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select a component…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {COMPONENTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Unbound nodes use semantic HTML.</p>
        </div>
      )}
    </section>
  )
}
