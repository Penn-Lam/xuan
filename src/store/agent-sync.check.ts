import assert from "node:assert/strict"
import { createBlankPage } from "../model/factories"
import { useEditorStore } from "./useEditorStore"

const before = Object.keys(useEditorStore.getState().pages).length
const blank = createBlankPage("Agent Page", { width: 1440, height: 900 })
const rootId = "node_agent_page"
const document = {
  ...blank,
  rootId,
  nodes: { [rootId]: { ...blank.nodes[blank.rootId], id: rootId } },
  canvas: { [rootId]: blank.canvas[blank.rootId] },
  mindmap: { [rootId]: blank.mindmap[blank.rootId] },
}

useEditorStore.getState().upsertAgentDocument(document)
assert.equal(Object.keys(useEditorStore.getState().pages).length, before + 1)
assert.equal(useEditorStore.getState().document.rootId, document.rootId)

useEditorStore.getState().upsertAgentDocument({
  ...document,
  meta: { ...document.meta, name: "Agent Page Updated" },
})
assert.equal(Object.keys(useEditorStore.getState().pages).length, before + 1)
assert.equal(useEditorStore.getState().document.meta.name, "Agent Page Updated")

console.log("agent page sync: ok")
