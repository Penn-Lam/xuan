// ============================================================
//  MindmapEditor —— IA 模式容器（React Flow v12）
//  从 store 读 document → useMindmapTree → ReactFlow
//  点击选中、拖拽改父级、折叠切换
// ============================================================
import { useCallback } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
} from "@xyflow/react"
import { useEditorStore } from "@/store/useEditorStore"
import { isDescendant } from "@/lib/geometry"
import { useMindmapTree, type MindmapNodeData } from "./useMindmapTree"
import { useMindmapKeyboard } from "./useMindmapKeyboard"
import { MindmapNode } from "./MindmapNode"

const nodeTypes = { mindmap: MindmapNode }

function MindmapEditorInner() {
  const document = useEditorStore((s) => s.document)
  const selectedId = useEditorStore((s) => s.selectedId)
  const selectNode = useEditorStore((s) => s.selectNode)
  const reparentNode = useEditorStore((s) => s.reparentNode)
  const toggleCollapse = useEditorStore((s) => s.toggleCollapse)

  // 全局键盘快捷键
  useMindmapKeyboard()

  const { nodes, edges } = useMindmapTree(document)

  // 注入 onToggleCollapse 回调（运行时注入，避开 RF data 序列化限制）
  const nodesWithCallbacks: Node[] = nodes.map((n) => ({
    ...n,
    data: { ...(n.data as MindmapNodeData), onToggleCollapse: toggleCollapse },
    selected: n.id === selectedId,
  }))

  const handleNodeClick = useCallback(
    (_e: unknown, node: Node) => selectNode(node.id),
    [selectNode],
  )

  const handleNodeDragStop = useCallback(
    (_e: unknown, draggedNode: Node) => {
      const pos = draggedNode.position
      // 找 bounding box 重叠的候选父节点（排除自身及后代）
      const candidates = nodes.filter((n) => {
        if (n.id === draggedNode.id) return false
        if (isDescendant(document, draggedNode.id, n.id)) return false
        const dx = Math.abs(n.position.x - pos.x)
        const dy = Math.abs(n.position.y - pos.y)
        return dx < 180 && dy < 70
      })
      if (candidates.length > 0) {
        reparentNode(draggedNode.id, candidates[0].id)
      }
    },
    [nodes, document, reparentNode],
  )

  const handlePaneClick = useCallback(() => selectNode(null), [selectNode])

  return (
    <div className="mindmap-editor h-full w-full bg-muted/30">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick as never}
        onNodeDragStop={handleNodeDragStop as never}
        onPaneClick={handlePaneClick}
        nodesConnectable={false}
        panOnDrag={[1]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode="Meta"
        minZoom={0.25}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { stroke: "var(--ring)", strokeWidth: 1.5 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  )
}

export function MindmapEditor() {
  return (
    <ReactFlowProvider>
      <MindmapEditorInner />
    </ReactFlowProvider>
  )
}
