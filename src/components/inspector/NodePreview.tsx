// ============================================================
//  Inspector / NodePreview —— catalog-aware semantic preview
// ============================================================
import type { ComponentProps } from "react"
import {
  ChartBar,
  Gear,
  House,
  MagnifyingGlass,
  User,
} from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { FlatNode, XuanDocument } from "@/types/document"
import { useI18n } from "@/lib/i18n"

type Translate = (key: string) => string

function textValue(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value)
}

function listValue(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return fallback
}

function renderSidebar(node: FlatNode, document: XuanDocument, t: Translate) {
  const childNodes = node.childrenIds.flatMap((id) => {
    const child = document.nodes[id]
    return child ? [child] : []
  })
  const branding = childNodes.find((child) => child.role === "branding")
  const menu = childNodes.find(
    (child) => child.component?.ref === "SidebarMenu" || child.role === "navigation",
  )
  const content = node.content ?? {}
  const brand = textValue(
    content.brand ?? branding?.content?.text,
    branding?.name ?? node.name,
  )
  const items = listValue(
    content.items ?? menu?.content?.items,
    ["Overview", "Analytics", "Settings"],
  )
  const icons = [House, ChartBar, User, Gear]

  return (
    <Card size="sm" className="w-full">
      <CardHeader className="border-b">
        <CardTitle>{brand}</CardTitle>
        <CardDescription>{t("Workspace")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {items.slice(0, 5).map((item, index) => {
          const Icon = icons[index % icons.length]
          return (
            <Button
              key={item}
              variant={index === 0 ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              <Icon data-icon="inline-start" />
              {item}
            </Button>
          )
        })}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {textValue(content.footer, t("Account & settings"))}
      </CardFooter>
    </Card>
  )
}

function renderTable(node: FlatNode, t: Translate) {
  const content = node.content ?? {}
  const columns = listValue(content.columns, ["Name", "Status", "Value"])
  const rowCount = Math.min(Number(content.itemCount ?? 3), 4)

  return (
    <Card size="sm" className="w-full">
      <CardHeader>
        <CardTitle>{node.name}</CardTitle>
        <CardDescription>{rowCount} {t("representative rows")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
          {columns.slice(0, 3).map((column) => <span key={column}>{column}</span>)}
        </div>
        {Array.from({ length: rowCount }, (_, index) => (
          <div key={index} className="grid grid-cols-3 gap-2 border-t pt-2 text-xs">
            <span>Item {index + 1}</span>
            <span>{t("Active")}</span>
            <span>—</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function renderChart(node: FlatNode, t: Translate) {
  const content = node.content ?? {}
  const series = listValue(content.series, [t("Series")])
  return (
    <Card size="sm" className="w-full">
      <CardHeader>
        <CardTitle>{textValue(content.title, node.name)}</CardTitle>
        <CardDescription>{textValue(content.range, t("Representative data"))}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-20 items-end gap-2">
          {[42, 68, 52, 86, 64, 92, 74].map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-sm bg-primary/70"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {series.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
        </div>
      </CardContent>
    </Card>
  )
}

function renderPreview(node: FlatNode, document: XuanDocument, t: Translate) {
  const { role, component, content } = node
  const ref = component?.ref
  const props = component?.props ?? {}
  const semantic = content ?? {}

  if (ref === "Sidebar" || role === "sidebar") return renderSidebar(node, document, t)
  if (ref === "SidebarMenu") {
    const items = listValue(semantic.items, ["Overview", "Orders", "Settings"])
    return (
      <Card size="sm" className="w-full">
        <CardContent className="flex flex-col gap-1">
          {items.map((item, index) => (
            <Button key={item} variant={index === 0 ? "secondary" : "ghost"} size="sm" className="justify-start">
              {item}
            </Button>
          ))}
        </CardContent>
      </Card>
    )
  }
  if (ref === "Button") {
    const variant = (props.variant as ComponentProps<typeof Button>["variant"]) ?? "default"
    return <Button variant={variant}>{textValue(semantic.label ?? semantic.text, node.name)}</Button>
  }
  if (ref === "Input" || role === "search") {
    return (
      <div className="relative">
        {role === "search" && (
          <MagnifyingGlass
            className="pointer-events-none absolute left-2.5 top-2.5 text-muted-foreground"
            width={14}
            height={14}
          />
        )}
        <Input
          placeholder={textValue(semantic.placeholder ?? props.placeholder, t("Enter a value…"))}
          className={role === "search" ? "pl-8" : undefined}
        />
      </div>
    )
  }
  if (ref === "Textarea") {
    return <Textarea placeholder={textValue(props.placeholder, t("Enter details…"))} />
  }
  if (ref === "Badge") {
    return <Badge variant="secondary">{textValue(semantic.text ?? semantic.label, node.name)}</Badge>
  }
  if (ref === "Table" || role === "table" || role === "data-table") return renderTable(node, t)
  if (ref === "ChartContainer" || role === "chart") return renderChart(node, t)
  if (ref === "Card" || role === "stat-card" || role === "card") {
    return (
      <Card size="sm" className="w-full">
        <CardHeader>
          <CardTitle>{textValue(semantic.label, node.name)}</CardTitle>
          {semantic.description != null && <CardDescription>{textValue(semantic.description)}</CardDescription>}
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-2">
          <p className="text-xl font-semibold">{textValue(semantic.value, "—")}</p>
          {semantic.delta != null && <Badge variant="secondary">{textValue(semantic.delta)}</Badge>}
        </CardContent>
      </Card>
    )
  }
  if (ref === "Alert") {
    return (
      <Card size="sm" className="w-full">
        <CardHeader>
          <CardTitle>{textValue(semantic.title, node.name)}</CardTitle>
          <CardDescription>{textValue(semantic.message, t("Alert message"))}</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  if (role === "heading" || role === "branding") {
    return <p className="text-base font-semibold">{textValue(semantic.text, node.name)}</p>
  }
  if (ref === "Separator") return <Separator />

  return (
    <Card size="sm" className="w-full">
      <CardHeader>
        <CardTitle>{node.name}</CardTitle>
        <CardDescription>{ref ? `${ref} · ${role}` : role}</CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {t("Add semantic content fields to make this preview more specific.")}
      </CardContent>
    </Card>
  )
}

export function NodePreview() {
  const { t } = useI18n()
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)

  if (!selectedId) return null
  const node = document.nodes[selectedId]
  if (!node) return null

  return (
    <section className="p-4">
      <h3 className="mb-3 text-sm font-semibold">{t("Preview")}</h3>
      <div className="rounded-md border bg-muted/30 p-3">
        {renderPreview(node, document, t)}
      </div>
    </section>
  )
}
