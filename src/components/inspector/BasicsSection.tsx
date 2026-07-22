// ============================================================
//  Inspector / Basics —— 名称 / role / shape / 页面尺寸
// ============================================================
import { Monitor, DeviceTablet, DeviceMobile } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { ROLES } from "@/store/catalog"
import { PAGE_PRESETS } from "@/types/document"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** 页面尺寸预设图标 */
const PRESET_ICONS = {
  desktop: Monitor,
  tablet: DeviceTablet,
  mobile: DeviceMobile,
} as const

export function BasicsSection() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const document = useEditorStore((s) => s.document)
  const renameNode = useEditorStore((s) => s.renameNode)
  const setRole = useEditorStore((s) => s.setRole)
  const updateCanvasData = useEditorStore((s) => s.updateCanvasData)

  if (!selectedId) return null
  const node = document.nodes[selectedId]
  const canvas = document.canvas[selectedId]
  if (!node || !canvas) return null
  const isRoot = node.parentId === null

  return (
    <section className="border-b p-4">
      <h3 className="mb-3 text-sm font-semibold">Basics</h3>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="insp-name" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input
            id="insp-name"
            value={node.name}
            onChange={(e) => renameNode(selectedId, e.target.value)}
            className="h-8"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Role</Label>
          <Select value={node.role} onValueChange={(v) => { if (v) setRole(selectedId, v) }}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Shape</Label>
          <Select
            value={canvas.shape}
            onValueChange={(v) =>
              updateCanvasData(selectedId, { shape: v as typeof canvas.shape })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rectangle">Rectangle</SelectItem>
              <SelectItem value="ellipse">Ellipse</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isRoot && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Page Size</Label>
            <div className="flex items-center gap-1">
              {PAGE_PRESETS.map((p) => {
                const Icon = PRESET_ICONS[p.id as keyof typeof PRESET_ICONS]
                const isActive = document.meta.viewport.width === p.width
                return (
                  <button
                    key={p.id}
                    title={`${p.label} (${p.width}×${p.height})`}
                    onClick={() =>
                      updateCanvasData(selectedId, {
                        rect: { x: 0, y: 0, w: p.width, h: p.height },
                      })
                    }
                    className={cn(
                      "flex h-8 flex-1 items-center justify-center rounded-md border transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon width={16} height={16} />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
