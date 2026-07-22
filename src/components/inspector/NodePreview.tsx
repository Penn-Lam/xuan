// ============================================================
//  Inspector / NodePreview —— role + component 组合单元的实时预览
//  用真实 shadcn 组件渲染，解决「纯文字难脑补」问题
//  Phase 1：基础实现；Phase 3 增强
// ============================================================
import type { ComponentProps } from "react"
import { useEditorStore } from "@/store/useEditorStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { FlatNode } from "@/types/document"

/** 根据 role + component 渲染预览 */
function renderPreview(node: FlatNode) {
  const { role, component, content } = node
  const ref = component?.ref
  const c = content ?? {}

  // 有绑定组件：渲染组件
  if (ref === "Button") {
    const variant = (component?.props.variant as ComponentProps<typeof Button>["variant"]) ?? "default"
    return (
      <Button variant={variant} size="sm">
        {String(c.text ?? c.label ?? component?.props.children ?? "Button")}
      </Button>
    )
  }
  if (ref === "Input") {
    return (
      <Input
        placeholder={String(c.placeholder ?? component?.props.placeholder ?? "Input…")}
        className="h-8"
      />
    )
  }
  if (ref === "Card" || role === "stat-card" || role === "card") {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">{String(c.label ?? node.name)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{String(c.value ?? "—")}</p>
          {c.delta ? <Badge variant="secondary">{String(c.delta)}</Badge> : null}
        </CardContent>
      </Card>
    )
  }

  // 无绑定组件：按 role 渲染骨架
  if (role === "heading" || role === "branding") {
    return <p className="text-base font-semibold">{String(c.text ?? node.name)}</p>
  }
  if (role === "search") {
    return <Input placeholder="Search…" className="h-8" />
  }
  if (role === "separator") {
    return <Separator />
  }

  // 兜底：显示节点信息
  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{node.name}</span>
      <span>role: {role}</span>
      {ref && <span>component: {ref}</span>}
    </div>
  )
}

export function NodePreview() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)

  if (!selectedId) return null
  const node = document.nodes[selectedId]
  if (!node) return null

  return (
    <section className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Preview</h3>
      <div className="rounded-md border bg-muted/30 p-3">
        {renderPreview(node)}
      </div>
    </section>
  )
}
