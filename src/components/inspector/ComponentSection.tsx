// ============================================================
//  Inspector / Component —— catalog component + typed prop fields
// ============================================================
import { X } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import {
  COMPONENT_CATALOG,
  COMPONENTS,
  getPropFields,
} from "@/store/catalog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SemanticFieldsEditor } from "./SemanticFieldsEditor"

export function ComponentSection() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)
  const setComponent = useEditorStore((s) => s.setComponent)
  const node = selectedId ? document.nodes[selectedId] : null
  const component = node?.component ?? null

  if (!selectedId || !node) return null

  const bindComponent = (ref: string) => {
    setComponent(selectedId, {
      ref,
      props: component?.ref === ref ? component.props : {},
    })
  }

  return (
    <section className="border-b p-4">
      <h3 className="mb-3 text-sm font-semibold">Component</h3>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Component type</Label>
          <div className="flex items-center gap-1.5">
            <Select value={component?.ref ?? ""} onValueChange={(ref) => ref && bindComponent(ref)}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Select a component…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {COMPONENTS.map((ref) => (
                    <SelectItem key={ref} value={ref}>
                      {ref}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {component && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setComponent(selectedId, null)}
                aria-label="Unbind component"
              >
                <X />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {component
              ? COMPONENT_CATALOG[component.ref]?.description ?? "Custom component"
              : "Unbound nodes use their semantic role."}
          </p>
        </div>

        {component && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Props</Label>
            <SemanticFieldsEditor
              key={`${selectedId}:${component.ref}`}
              definitions={getPropFields(component.ref)}
              value={component.props}
              onChange={(props) => setComponent(selectedId, { ...component, props })}
              emptyMessage="Add only the behavior or appearance props this component needs."
              fieldKind="prop"
            />
          </div>
        )}
      </div>
    </section>
  )
}
