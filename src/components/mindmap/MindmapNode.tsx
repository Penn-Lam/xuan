// ============================================================
//  MindmapNode —— IA 模式自定义节点卡片
//  显示 name + role badge + 折叠开关
//  支持内联重命名（renamingId === nodeId 时显示 input）
// ============================================================
import { memo, useEffect, useRef, useState } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { CaretDown, Cube } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useEditorStore } from "@/store/useEditorStore"
import { cn } from "@/lib/utils"
import type { MindmapNodeData } from "./useMindmapTree"

type MindmapNodeProps = NodeProps & { data: MindmapNodeData }

function MindmapNodeBase({ data, selected }: MindmapNodeProps) {
  const d = data
  const renamingId = useEditorStore((s) => s.renamingId)
  const setRenaming = useEditorStore((s) => s.setRenaming)
  const renameNode = useEditorStore((s) => s.renameNode)
  const [name, setName] = useState(d.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const isRenaming = renamingId === d.nodeId

  // 进入重命名模式时聚焦并选中
  useEffect(() => {
    if (isRenaming) {
      setName(d.name)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isRenaming, d.name])

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== d.name) {
      renameNode(d.nodeId, trimmed)
    }
    setRenaming(null)
  }

  return (
    <div
      className={cn(
        "mindmap-card flex w-[220px] cursor-pointer flex-col gap-1 rounded-md border bg-background p-3 shadow-xs transition-shadow",
        selected && "border-primary ring-2 ring-ring/50",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2" />

      <div className="flex items-start justify-between gap-2">
        {isRenaming ? (
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName()
              if (e.key === "Escape") setRenaming(null)
            }}
            className="h-6 flex-1 px-1 text-sm"
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium"
            onDoubleClick={() => setRenaming(d.nodeId)}
          >
            {d.name}
          </span>
        )}
        {d.hasComponent && (
          <Cube className="shrink-0 text-muted-foreground" width={14} height={14} />
        )}
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="font-mono text-[10px]">
          {d.role}
        </Badge>
        {d.childCount > 0 && (
          <button
            className="flex h-4 w-4 items-center justify-center rounded-full border bg-background text-[10px] text-muted-foreground hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation()
              d.onToggleCollapse?.(d.nodeId)
            }}
            aria-label={d.collapsed ? "Expand" : "Collapse"}
          >
            <CaretDown
              width={10}
              height={10}
              style={{ transform: d.collapsed ? "rotate(-90deg)" : "none" }}
            />
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-2 !w-2" />
    </div>
  )
}

export const MindmapNode = memo(MindmapNodeBase)
