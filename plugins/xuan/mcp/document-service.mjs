import { createHash, randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const DOCUMENT_DIRECTORY = ".xuan"
const DOCUMENT_FILE = "document.json"
const MUTATION_FILE = "mutations.json"
const LOCK_FILE = ".document.lock"
const MAX_MUTATIONS = 100

export class DocumentNotFoundError extends Error {}
export class RevisionConflictError extends Error {
  constructor(expectedRevision, actualRevision) {
    super(`Revision conflict: expected ${expectedRevision}, received ${actualRevision}.`)
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}
export class DocumentValidationError extends Error {}

function workspacePaths(projectPath) {
  const root = path.resolve(projectPath)
  const directory = path.join(root, DOCUMENT_DIRECTORY)
  return {
    root,
    directory,
    document: path.join(directory, DOCUMENT_FILE),
    mutations: path.join(directory, MUTATION_FILE),
    lock: path.join(directory, LOCK_FILE),
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function assertFiniteNumber(value, label, { positive = false, nonnegative = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DocumentValidationError(`${label} must be a finite number.`)
  }
  if (positive && value <= 0) {
    throw new DocumentValidationError(`${label} must be greater than zero.`)
  }
  if (nonnegative && value < 0) {
    throw new DocumentValidationError(`${label} must be nonnegative.`)
  }
}

export function assertDocument(document) {
  if (!isRecord(document) || document.version !== "2.0") {
    throw new DocumentValidationError('Document version must be "2.0".')
  }
  if (!isRecord(document.meta) || typeof document.meta.name !== "string") {
    throw new DocumentValidationError("Document meta.name must be a string.")
  }
  if (typeof document.meta.designSystem !== "string" || !isRecord(document.meta.viewport)) {
    throw new DocumentValidationError("Document meta must include designSystem and viewport.")
  }
  assertFiniteNumber(document.meta.viewport.width, "meta.viewport.width", { positive: true })
  assertFiniteNumber(document.meta.viewport.height, "meta.viewport.height", { positive: true })

  const ids = new Set()
  const visit = (node, trail) => {
    if (!isRecord(node) || typeof node.id !== "string" || node.id.length === 0) {
      throw new DocumentValidationError(`${trail}.id must be a non-empty string.`)
    }
    if (ids.has(node.id)) {
      throw new DocumentValidationError(`Duplicate node id: ${node.id}.`)
    }
    ids.add(node.id)
    if (typeof node.name !== "string" || typeof node.role !== "string") {
      throw new DocumentValidationError(`${trail} must include string name and role fields.`)
    }
    if (!isRecord(node.rect)) {
      throw new DocumentValidationError(`${trail}.rect must be an object.`)
    }
    assertFiniteNumber(node.rect.x, `${trail}.rect.x`)
    assertFiniteNumber(node.rect.y, `${trail}.rect.y`)
    assertFiniteNumber(node.rect.w, `${trail}.rect.w`, { nonnegative: true })
    assertFiniteNumber(node.rect.h, `${trail}.rect.h`, { nonnegative: true })
    if (!["rectangle", "ellipse", "text"].includes(node.shape)) {
      throw new DocumentValidationError(`${trail}.shape is invalid.`)
    }
    if (node.component !== null) {
      if (!isRecord(node.component) || typeof node.component.ref !== "string" || !isRecord(node.component.props)) {
        throw new DocumentValidationError(`${trail}.component must include ref and props.`)
      }
    }
    if (node.content !== null && !isRecord(node.content)) {
      throw new DocumentValidationError(`${trail}.content must be an object or null.`)
    }
    if (!Array.isArray(node.children)) {
      throw new DocumentValidationError(`${trail}.children must be an array.`)
    }
    node.children.forEach((child, index) => visit(child, `${trail}.children[${index}]`))
  }

  visit(document.tree, "tree")
  return document
}

export function revisionFor(document) {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex").slice(0, 16)
}

function stateFrom(document, replayed = false) {
  return {
    document,
    revision: revisionFor(document),
    replayed,
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

export async function readDocumentState(projectPath) {
  const paths = workspacePaths(projectPath)
  try {
    const document = assertDocument(await readJson(paths.document))
    return stateFrom(document)
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new DocumentNotFoundError(`No Xuan document at ${paths.document}.`)
    }
    throw error
  }
}

async function readMutations(file) {
  try {
    const value = await readJson(file)
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
  } catch (error) {
    if (error?.code === "ENOENT") return []
    throw error
  }
}

async function atomicWrite(file, value) {
  const temporaryFile = `${file}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporaryFile, file)
}

async function acquireLock(paths) {
  await mkdir(paths.directory, { recursive: true })
  const startedAt = Date.now()
  while (Date.now() - startedAt < 2_000) {
    try {
      const handle = await open(paths.lock, "wx")
      return async () => {
        await handle.close()
        await unlink(paths.lock).catch(() => {})
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error
      const lockStat = await stat(paths.lock).catch(() => null)
      if (lockStat && Date.now() - lockStat.mtimeMs > 10_000) {
        await unlink(paths.lock).catch(() => {})
        continue
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  throw new Error("Timed out waiting for the Xuan document lock.")
}

async function withDocumentLock(projectPath, callback) {
  const paths = workspacePaths(projectPath)
  const release = await acquireLock(paths)
  try {
    return await callback(paths)
  } finally {
    await release()
  }
}

function blankDocument(name, viewport) {
  const width = viewport?.width ?? 1440
  const height = viewport?.height ?? 900
  const rootId = "node_root"
  return {
    version: "2.0",
    meta: {
      name,
      designSystem: "shadcn/ui@latest",
      viewport: { width, height },
    },
    tree: {
      id: rootId,
      name,
      role: "page",
      rect: { x: 0, y: 0, w: width, h: height },
      shape: "rectangle",
      component: null,
      content: null,
      children: [],
    },
  }
}

export async function initializeDocument(projectPath, options = {}) {
  return withDocumentLock(projectPath, async (paths) => {
    try {
      const existing = assertDocument(await readJson(paths.document))
      return stateFrom(existing)
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
    const document = assertDocument(blankDocument(options.name ?? "Untitled Page", options.viewport))
    await atomicWrite(paths.document, document)
    return stateFrom(document)
  })
}

export async function mutateDocument(projectPath, options) {
  const { clientMutationId, expectedRevision, mutate } = options
  if (!clientMutationId?.trim()) {
    throw new Error("clientMutationId is required.")
  }

  return withDocumentLock(projectPath, async (paths) => {
    let current
    try {
      current = assertDocument(await readJson(paths.document))
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new DocumentNotFoundError(`No Xuan document at ${paths.document}.`)
      }
      throw error
    }

    const mutations = await readMutations(paths.mutations)
    if (mutations.includes(clientMutationId)) {
      return stateFrom(current, true)
    }

    const currentRevision = revisionFor(current)
    if (expectedRevision !== currentRevision) {
      throw new RevisionConflictError(expectedRevision, currentRevision)
    }

    const next = assertDocument(await mutate(structuredClone(current)))
    await atomicWrite(paths.document, next)
    await atomicWrite(paths.mutations, [...mutations, clientMutationId].slice(-MAX_MUTATIONS))
    return stateFrom(next)
  })
}

export async function replaceDocument(projectPath, options) {
  return mutateDocument(projectPath, {
    clientMutationId: options.clientMutationId,
    expectedRevision: options.expectedRevision,
    mutate: () => assertDocument(options.document),
  })
}

