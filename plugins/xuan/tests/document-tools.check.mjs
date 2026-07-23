import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import {
  RevisionConflictError,
  initializeDocument,
  mutateDocument,
  readDocumentState,
} from "../mcp/document-service.mjs"
import {
  applyCanvasOperations,
  applyIaOperations,
  documentContext,
} from "../mcp/document-operations.mjs"

const workspace = await mkdtemp(path.join(os.tmpdir(), "xuan-agent-tools-"))

try {
  const initialized = await initializeDocument(workspace, { name: "Order Search" })
  assert.equal(initialized.document.tree.name, "Order Search")
  assert.equal(documentContext(initialized.document).nodes.length, 1)

  const iaMutation = await mutateDocument(workspace, {
    expectedRevision: initialized.revision,
    clientMutationId: "ia-1",
    mutate: (document) =>
      applyIaOperations(document, [
        {
          type: "add_node",
          parentId: "node_root",
          id: "node_search",
          name: "Global Search",
          role: "search",
        },
        {
          type: "add_node",
          parentId: "node_root",
          id: "node_results",
          name: "Search Results",
          role: "list",
        },
      ]),
  })
  assert.equal(documentContext(iaMutation.document).nodes.length, 3)
  assert.equal(iaMutation.document.tree.children[0].component, null)

  const replay = await mutateDocument(workspace, {
    expectedRevision: initialized.revision,
    clientMutationId: "ia-1",
    mutate: () => {
      throw new Error("A replay must not execute the mutator.")
    },
  })
  assert.equal(replay.replayed, true)
  assert.equal(documentContext(replay.document).nodes.length, 3)

  await assert.rejects(
    mutateDocument(workspace, {
      expectedRevision: initialized.revision,
      clientMutationId: "stale-write",
      mutate: (document) => document,
    }),
    RevisionConflictError,
  )

  const semanticTree = (document) =>
    documentContext(document).nodes.map(({ id, parentId, childIds, name, role }) => ({
      id,
      parentId,
      childIds,
      name,
      role,
    }))
  const semanticsBeforeCanvas = semanticTree(iaMutation.document)

  const canvasMutation = await mutateDocument(workspace, {
    expectedRevision: iaMutation.revision,
    clientMutationId: "canvas-1",
    mutate: (document) =>
      applyCanvasOperations(document, [
        {
          type: "set_rect",
          nodeId: "node_search",
          rect: { x: 32, y: 32, w: 420, h: 48 },
        },
        {
          type: "bind_component",
          nodeId: "node_search",
          componentRef: "Input",
          props: { type: "search" },
        },
        {
          type: "set_content_field",
          nodeId: "node_search",
          field: "placeholder",
          value: "Search orders",
        },
      ]),
  })
  assert.deepEqual(semanticTree(canvasMutation.document), semanticsBeforeCanvas)
  assert.equal(canvasMutation.document.tree.children[0].component.ref, "Input")
  assert.equal(canvasMutation.document.tree.children[0].content.placeholder, "Search orders")

  const persisted = await readDocumentState(workspace)
  assert.equal(persisted.revision, canvasMutation.revision)
  assert.deepEqual(
    JSON.parse(await readFile(path.join(workspace, ".xuan/document.json"), "utf8")),
    canvasMutation.document,
  )

  const client = new Client({ name: "xuan-test", version: "0.1.0" })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("plugins/xuan/mcp/generated/server.bundle.mjs")],
  })
  await client.connect(transport)
  const tools = await client.listTools()
  assert.deepEqual(
    tools.tools.map(({ name }) => name).sort(),
    [
      "apply_xuan_canvas_operations",
      "apply_xuan_ia_operations",
      "create_xuan_page",
      "get_xuan_document_context",
      "initialize_xuan_document",
    ],
  )
  const contextResult = await client.callTool({
    name: "get_xuan_document_context",
    arguments: { projectPath: workspace },
  })
  assert.equal(contextResult.isError, undefined)
  assert.equal(contextResult.structuredContent.revision, canvasMutation.revision)
  const createResult = await client.callTool({
    name: "create_xuan_page",
    arguments: { projectPath: workspace, name: "New Agent Page" },
  })
  assert.equal(createResult.isError, undefined)
  assert.equal(createResult.structuredContent.meta.name, "New Agent Page")
  assert.notEqual(createResult.structuredContent.rootId, initialized.document.tree.id)
  assert.equal((await readdir(path.join(workspace, ".xuan/pages"))).length, 2)
  await client.close()

  console.log("xuan agent tools: ok")
} finally {
  await rm(workspace, { recursive: true, force: true })
}
