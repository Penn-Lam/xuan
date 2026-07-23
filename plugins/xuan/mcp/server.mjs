#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  DocumentNotFoundError,
  RevisionConflictError,
  createDocument,
  initializeDocument,
  mutateDocument,
  readDocumentState,
} from "./document-service.mjs"
import {
  applyCanvasOperations,
  applyIaOperations,
  documentContext,
} from "./document-operations.mjs"

const server = new McpServer({ name: "xuan", version: "0.1.0" })
const editorUrl = process.env.XUAN_EDITOR_URL ?? "http://localhost:5173"

const projectPath = z
  .string()
  .min(1)
  .describe("Absolute path to the active project workspace that contains .xuan/document.json.")
const revision = z
  .string()
  .min(1)
  .describe("Revision returned by get_xuan_document_context. Mutations fail if it is stale.")
const mutationId = z
  .string()
  .min(1)
  .describe("Unique idempotency key for this mutation batch, such as a UUID.")
const nodeId = z.string().min(1)

const iaOperation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_document_name"), name: z.string().min(1) }),
  z.object({
    type: z.literal("add_node"),
    parentId: nodeId,
    id: nodeId.optional(),
    name: z.string().min(1),
    role: z.string().min(1).optional(),
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("rename_node"), nodeId, name: z.string().min(1) }),
  z.object({ type: z.literal("set_role"), nodeId, role: z.string().min(1) }),
  z.object({
    type: z.literal("move_node"),
    nodeId,
    parentId: nodeId,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("reorder_node"), nodeId, index: z.number().int().nonnegative() }),
  z.object({ type: z.literal("remove_node"), nodeId }),
])

const rect = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().nonnegative(),
  h: z.number().finite().nonnegative(),
})

const canvasOperation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_rect"), nodeId, rect }),
  z.object({ type: z.literal("set_shape"), nodeId, shape: z.enum(["rectangle", "ellipse", "text"]) }),
  z.object({
    type: z.literal("bind_component"),
    nodeId,
    componentRef: z.string().min(1),
    props: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({ type: z.literal("unbind_component"), nodeId }),
  z.object({ type: z.literal("set_prop"), nodeId, field: z.string().min(1), value: z.unknown() }),
  z.object({ type: z.literal("remove_prop"), nodeId, field: z.string().min(1) }),
  z.object({
    type: z.literal("set_content"),
    nodeId,
    content: z.record(z.string(), z.unknown()).nullable(),
  }),
  z.object({
    type: z.literal("set_content_field"),
    nodeId,
    field: z.string().min(1),
    value: z.unknown(),
  }),
  z.object({ type: z.literal("remove_content_field"), nodeId, field: z.string().min(1) }),
  z.object({
    type: z.literal("auto_layout"),
    nodeId,
    direction: z.enum(["vertical", "horizontal", "grid"]).optional(),
    padding: z.number().nonnegative().optional(),
    gap: z.number().nonnegative().optional(),
    columns: z.number().int().positive().optional(),
  }),
])

function success(payload, message) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: payload,
  }
}

function failure(error) {
  const payload = {
    error: error instanceof Error ? error.message : String(error),
    ...(error instanceof RevisionConflictError
      ? { expectedRevision: error.expectedRevision, actualRevision: error.actualRevision }
      : {}),
  }
  return {
    isError: true,
    content: [{ type: "text", text: payload.error }],
    structuredContent: payload,
  }
}

server.registerTool(
  "initialize_xuan_document",
  {
    title: "Initialize Xuan document",
    description:
      "Create .xuan/document.json for a project when it does not exist. Existing documents are returned unchanged.",
    inputSchema: {
      projectPath,
      name: z.string().min(1).optional(),
      viewport: z
        .object({ width: z.number().positive(), height: z.number().positive() })
        .optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ projectPath: workspace, name, viewport }) => {
    try {
      const state = await initializeDocument(workspace, { name, viewport })
      return success(
        { projectPath: workspace, revision: state.revision, ...documentContext(state.document) },
        `Xuan document is ready at revision ${state.revision}.`,
      )
    } catch (error) {
      return failure(error)
    }
  },
)

server.registerTool(
  "create_xuan_page",
  {
    title: "Create Xuan page",
    description:
      "Create a new Xuan page and make it active without discarding prior pages. A running editor adds and opens it automatically; never create a standalone JSON export for this workflow.",
    inputSchema: {
      projectPath,
      name: z.string().min(1),
      viewport: z
        .object({ width: z.number().positive(), height: z.number().positive() })
        .optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  async ({ projectPath: workspace, name, viewport }) => {
    try {
      const state = await createDocument(workspace, { name, viewport })
      return success(
        {
          projectPath: workspace,
          editorUrl,
          revision: state.revision,
          ...documentContext(state.document),
        },
        `Created page “${name}” at revision ${state.revision}. Open ${editorUrl}; the editor will load it automatically.`,
      )
    } catch (error) {
      return failure(error)
    }
  },
)

server.registerTool(
  "get_xuan_document_context",
  {
    title: "Get Xuan document context",
    description:
      "Read the current Xuan IA, Canvas geometry, component bindings, content intent, and revision before making changes.",
    inputSchema: { projectPath },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  async ({ projectPath: workspace }) => {
    try {
      const state = await readDocumentState(workspace)
      return success(
        { projectPath: workspace, revision: state.revision, ...documentContext(state.document) },
        `Read ${documentContext(state.document).nodes.length} nodes at revision ${state.revision}.`,
      )
    } catch (error) {
      const hint =
        error instanceof DocumentNotFoundError
          ? `${error.message} Call initialize_xuan_document first.`
          : error
      return failure(hint)
    }
  },
)

server.registerTool(
  "apply_xuan_ia_operations",
  {
    title: "Apply Xuan IA operations",
    description:
      "Apply an atomic batch of information-architecture operations. This tool changes only names, roles, and tree structure; it never binds components or authors layout/content.",
    inputSchema: {
      projectPath,
      expectedRevision: revision,
      clientMutationId: mutationId,
      operations: z.array(iaOperation).min(1).max(100),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  async ({ projectPath: workspace, expectedRevision, clientMutationId, operations }) => {
    try {
      const state = await mutateDocument(workspace, {
        expectedRevision,
        clientMutationId,
        mutate: (document) => applyIaOperations(document, operations),
      })
      return success(
        {
          projectPath: workspace,
          revision: state.revision,
          replayed: state.replayed,
          appliedOperationCount: state.replayed ? 0 : operations.length,
          ...documentContext(state.document),
        },
        `${state.replayed ? "Replayed" : "Applied"} IA mutation ${clientMutationId} at revision ${state.revision}.`,
      )
    } catch (error) {
      return failure(error)
    }
  },
)

server.registerTool(
  "apply_xuan_canvas_operations",
  {
    title: "Apply Xuan Canvas operations",
    description:
      "Apply an atomic batch of layout, shape, shadcn/ui component, props, and content-intent operations. This tool never changes IA names, roles, or parent-child structure.",
    inputSchema: {
      projectPath,
      expectedRevision: revision,
      clientMutationId: mutationId,
      operations: z.array(canvasOperation).min(1).max(100),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  async ({ projectPath: workspace, expectedRevision, clientMutationId, operations }) => {
    try {
      const state = await mutateDocument(workspace, {
        expectedRevision,
        clientMutationId,
        mutate: (document) => applyCanvasOperations(document, operations),
      })
      return success(
        {
          projectPath: workspace,
          revision: state.revision,
          replayed: state.replayed,
          appliedOperationCount: state.replayed ? 0 : operations.length,
          ...documentContext(state.document),
        },
        `${state.replayed ? "Replayed" : "Applied"} Canvas mutation ${clientMutationId} at revision ${state.revision}.`,
      )
    } catch (error) {
      return failure(error)
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
