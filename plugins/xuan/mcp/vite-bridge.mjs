import {
  DocumentNotFoundError,
  RevisionConflictError,
  initializeDocument,
  readDocumentState,
  replaceDocument,
} from "./document-service.mjs"

const ENDPOINT = "/__xuan/document"
const MAX_BODY_SIZE = 5 * 1024 * 1024

function send(response, status, payload) {
  response.statusCode = status
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  let body = ""
  for await (const chunk of request) {
    body += chunk
    if (body.length > MAX_BODY_SIZE) throw new Error("Request body is too large.")
  }
  return JSON.parse(body || "{}")
}

async function writeFromBrowser(projectPath, payload) {
  if (!payload.document || typeof payload.clientMutationId !== "string") {
    throw new Error("document and clientMutationId are required.")
  }
  try {
    return await replaceDocument(projectPath, payload)
  } catch (error) {
    if (!(error instanceof DocumentNotFoundError) || payload.expectedRevision !== null) throw error
    const initialized = await initializeDocument(projectPath, {
      name: payload.document.meta?.name,
      viewport: payload.document.meta?.viewport,
    })
    return replaceDocument(projectPath, {
      ...payload,
      expectedRevision: initialized.revision,
    })
  }
}

export function xuanDocumentBridge(projectPath) {
  return {
    name: "xuan-document-bridge",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname
        if (pathname !== ENDPOINT) {
          next()
          return
        }

        try {
          if (request.method === "GET") {
            const state = await readDocumentState(projectPath)
            send(response, 200, state)
            return
          }
          if (request.method === "PUT") {
            const state = await writeFromBrowser(projectPath, await readBody(request))
            send(response, 200, state)
            return
          }
          send(response, 405, { error: "Method not allowed." })
        } catch (error) {
          if (error instanceof DocumentNotFoundError) {
            send(response, 404, { error: error.message })
            return
          }
          if (error instanceof RevisionConflictError) {
            send(response, 409, {
              error: error.message,
              expectedRevision: error.expectedRevision,
              actualRevision: error.actualRevision,
            })
            return
          }
          send(response, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      })
    },
  }
}

