import { useEffect } from "react"
import type { ExportDoc } from "@/types/document"
import { deserializeDocument } from "@/model/deserialize"
import { serializeDocument } from "@/model/serialize"
import { useEditorStore } from "@/store/useEditorStore"

const DOCUMENT_ENDPOINT = "/__xuan/document"
const SAVE_DELAY_MS = 250
const POLL_INTERVAL_MS = 750

interface RemoteDocumentState {
  document: ExportDoc
  revision: string
}

async function readRemote(): Promise<RemoteDocumentState | null> {
  const response = await fetch(DOCUMENT_ENDPOINT, { cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Document bridge returned ${response.status}.`)
  return response.json() as Promise<RemoteDocumentState>
}

async function writeRemote(
  document: ExportDoc,
  expectedRevision: string | null,
): Promise<Response> {
  return fetch(DOCUMENT_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document,
      expectedRevision,
      clientMutationId: crypto.randomUUID(),
    }),
  })
}

function startAgentDocumentSync(): () => void {
  let disposed = false
  let enabled = true
  let revision: string | null = null
  let lastSyncedDocument = ""
  let pendingDocument: ExportDoc | null = null
  let saveTimer: number | null = null
  let pollTimer: number | null = null
  let saving = false
  let unsubscribe: (() => void) | null = null

  const applyRemote = (remote: RemoteDocumentState) => {
    revision = remote.revision
    lastSyncedDocument = JSON.stringify(remote.document)
    useEditorStore.getState().replaceDocument(deserializeDocument(remote.document))
  }

  const flush = async () => {
    if (!enabled || disposed || saving || !pendingDocument) return
    const document = pendingDocument
    pendingDocument = null
    saving = true
    try {
      const response = await writeRemote(document, revision)
      if (response.status === 409) {
        pendingDocument = null
        const remote = await readRemote()
        if (remote && !disposed) applyRemote(remote)
        return
      }
      if (!response.ok) throw new Error(`Document bridge returned ${response.status}.`)
      const remote = (await response.json()) as RemoteDocumentState
      revision = remote.revision
      lastSyncedDocument = JSON.stringify(remote.document)
    } catch {
      enabled = false
    } finally {
      saving = false
      if (pendingDocument && enabled && !disposed) void flush()
    }
  }

  const scheduleSave = (document: ExportDoc) => {
    pendingDocument = document
    if (saveTimer !== null) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  const poll = async () => {
    if (!enabled || disposed || saving || pendingDocument) return
    try {
      const remote = await readRemote()
      if (remote && remote.revision !== revision && !disposed) applyRemote(remote)
    } catch {
      enabled = false
    }
  }

  const start = async () => {
    try {
      const remote = await readRemote()
      if (disposed) return
      if (remote) {
        applyRemote(remote)
      } else {
        const localDocument = serializeDocument(useEditorStore.getState().document)
        const response = await writeRemote(localDocument, null)
        if (!response.ok) throw new Error(`Document bridge returned ${response.status}.`)
        const created = (await response.json()) as RemoteDocumentState
        revision = created.revision
        lastSyncedDocument = JSON.stringify(created.document)
      }

      unsubscribe = useEditorStore.subscribe((state, previous) => {
        if (state.document === previous.document) return
        const document = serializeDocument(state.document)
        if (JSON.stringify(document) !== lastSyncedDocument) scheduleSave(document)
      })
      pollTimer = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    } catch {
      enabled = false
    }
  }

  void start()
  return () => {
    disposed = true
    unsubscribe?.()
    if (saveTimer !== null) window.clearTimeout(saveTimer)
    if (pollTimer !== null) window.clearInterval(pollTimer)
  }
}

export function useAgentDocumentSync(): void {
  useEffect(() => startAgentDocumentSync(), [])
}
