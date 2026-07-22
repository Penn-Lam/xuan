import { randomUUID } from "node:crypto"

export class DocumentOperationError extends Error {
  constructor(index, message) {
    super(`Operation ${index + 1}: ${message}`)
    this.operationIndex = index
  }
}

function operationError(index, message) {
  throw new DocumentOperationError(index, message)
}

function walk(node, visitor, parent = null) {
  visitor(node, parent)
  node.children.forEach((child) => walk(child, visitor, node))
}

function findNode(document, nodeId) {
  let result = null
  const visit = (node, parent = null) => {
    if (node.id === nodeId) {
      result = { node, parent }
      return
    }
    for (const child of node.children) {
      visit(child, node)
      if (result) return
    }
  }
  visit(document.tree)
  return result
}

function containsNode(node, nodeId) {
  if (node.id === nodeId) return true
  return node.children.some((child) => containsNode(child, nodeId))
}

function insertAt(children, node, index) {
  if (index === undefined) {
    children.push(node)
    return
  }
  children.splice(Math.max(0, Math.min(index, children.length)), 0, node)
}

function ensureNode(document, nodeId, index) {
  const match = findNode(document, nodeId)
  if (!match) operationError(index, `Node ${nodeId} does not exist.`)
  return match
}

function ensureRecord(value, index, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    operationError(index, `${label} must be an object.`)
  }
}

function createNode(parent, operation, index) {
  const id = operation.id?.trim() || `node_${randomUUID().replaceAll("-", "").slice(0, 12)}`
  if (!operation.name?.trim()) operationError(index, "add_node requires a name.")
  return {
    id,
    name: operation.name.trim(),
    role: operation.role?.trim() || "section",
    rect: {
      x: parent.rect.x + 16,
      y: parent.rect.y + 16,
      w: Math.max(0, Math.min(320, parent.rect.w - 32)),
      h: 120,
    },
    shape: "rectangle",
    component: null,
    content: null,
    children: [],
  }
}

export function applyIaOperations(document, operations) {
  const next = structuredClone(document)
  operations.forEach((operation, index) => {
    switch (operation.type) {
      case "set_document_name": {
        if (!operation.name?.trim()) operationError(index, "name cannot be empty.")
        next.meta.name = operation.name.trim()
        break
      }
      case "add_node": {
        const parent = ensureNode(next, operation.parentId, index).node
        const node = createNode(parent, operation, index)
        if (findNode(next, node.id)) operationError(index, `Node id ${node.id} already exists.`)
        insertAt(parent.children, node, operation.index)
        break
      }
      case "rename_node": {
        if (!operation.name?.trim()) operationError(index, "name cannot be empty.")
        ensureNode(next, operation.nodeId, index).node.name = operation.name.trim()
        break
      }
      case "set_role": {
        if (!operation.role?.trim()) operationError(index, "role cannot be empty.")
        ensureNode(next, operation.nodeId, index).node.role = operation.role.trim()
        break
      }
      case "move_node": {
        const match = ensureNode(next, operation.nodeId, index)
        const destination = ensureNode(next, operation.parentId, index).node
        if (!match.parent) operationError(index, "The root node cannot be moved.")
        if (containsNode(match.node, destination.id)) {
          operationError(index, "A node cannot be moved into its own subtree.")
        }
        match.parent.children = match.parent.children.filter((child) => child.id !== match.node.id)
        insertAt(destination.children, match.node, operation.index)
        break
      }
      case "reorder_node": {
        const match = ensureNode(next, operation.nodeId, index)
        if (!match.parent) operationError(index, "The root node cannot be reordered.")
        match.parent.children = match.parent.children.filter((child) => child.id !== match.node.id)
        insertAt(match.parent.children, match.node, operation.index)
        break
      }
      case "remove_node": {
        const match = ensureNode(next, operation.nodeId, index)
        if (!match.parent) operationError(index, "The root node cannot be removed.")
        match.parent.children = match.parent.children.filter((child) => child.id !== match.node.id)
        break
      }
      default:
        operationError(index, `Unsupported IA operation: ${operation.type}.`)
    }
  })
  return next
}

function translateSubtree(node, dx, dy, includeSelf = true) {
  if (includeSelf) {
    node.rect.x += dx
    node.rect.y += dy
  }
  node.children.forEach((child) => translateSubtree(child, dx, dy))
}

function setRect(node, rect, index) {
  ensureRecord(rect, index, "rect")
  const values = [rect.x, rect.y, rect.w, rect.h]
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    operationError(index, "rect values must be finite numbers.")
  }
  if (rect.w < 0 || rect.h < 0) operationError(index, "rect width and height must be nonnegative.")
  const dx = rect.x - node.rect.x
  const dy = rect.y - node.rect.y
  translateSubtree(node, dx, dy, false)
  node.rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
}

function setField(record, field, value, index) {
  if (!field?.trim()) operationError(index, "field cannot be empty.")
  record[field.trim()] = value
}

function layoutChildren(container, operation, index) {
  const direction = operation.direction ?? "vertical"
  const padding = operation.padding ?? 16
  const gap = operation.gap ?? 16
  if (!["vertical", "horizontal", "grid"].includes(direction)) {
    operationError(index, `Unsupported layout direction: ${direction}.`)
  }
  if (![padding, gap].every((value) => typeof value === "number" && value >= 0)) {
    operationError(index, "padding and gap must be nonnegative numbers.")
  }

  const columns = Math.max(1, Math.floor(operation.columns ?? 2))
  let cursorX = container.rect.x + padding
  let cursorY = container.rect.y + padding
  container.children.forEach((child, childIndex) => {
    if (direction === "grid" && childIndex > 0 && childIndex % columns === 0) {
      cursorX = container.rect.x + padding
      const row = container.children.slice(childIndex - columns, childIndex)
      cursorY += Math.max(...row.map((item) => item.rect.h)) + gap
    }
    const dx = cursorX - child.rect.x
    const dy = cursorY - child.rect.y
    translateSubtree(child, dx, dy)
    if (direction === "vertical") cursorY += child.rect.h + gap
    else cursorX += child.rect.w + gap
  })
}

export function applyCanvasOperations(document, operations) {
  const next = structuredClone(document)
  operations.forEach((operation, index) => {
    const node = ensureNode(next, operation.nodeId, index).node
    switch (operation.type) {
      case "set_rect":
        setRect(node, operation.rect, index)
        if (node === next.tree) {
          if (node.rect.w <= 0 || node.rect.h <= 0) {
            operationError(index, "The root rect must have positive width and height.")
          }
          next.meta.viewport = { width: node.rect.w, height: node.rect.h }
        }
        break
      case "set_shape":
        if (!["rectangle", "ellipse", "text"].includes(operation.shape)) {
          operationError(index, `Unsupported shape: ${operation.shape}.`)
        }
        node.shape = operation.shape
        break
      case "bind_component":
        if (!operation.componentRef?.trim()) operationError(index, "componentRef cannot be empty.")
        if (operation.props !== undefined) ensureRecord(operation.props, index, "props")
        node.component = {
          ref: operation.componentRef.trim(),
          props: operation.props ?? {},
        }
        break
      case "unbind_component":
        node.component = null
        break
      case "set_prop":
        if (!node.component) operationError(index, "Bind a component before setting props.")
        setField(node.component.props, operation.field, operation.value, index)
        break
      case "remove_prop":
        if (!node.component) operationError(index, "Bind a component before removing props.")
        delete node.component.props[operation.field]
        break
      case "set_content":
        if (operation.content !== null) ensureRecord(operation.content, index, "content")
        node.content = operation.content
        break
      case "set_content_field":
        node.content ??= {}
        setField(node.content, operation.field, operation.value, index)
        break
      case "remove_content_field":
        if (node.content) {
          delete node.content[operation.field]
          if (Object.keys(node.content).length === 0) node.content = null
        }
        break
      case "auto_layout":
        layoutChildren(node, operation, index)
        break
      default:
        operationError(index, `Unsupported Canvas operation: ${operation.type}.`)
    }
  })
  return next
}

export function documentContext(document) {
  const nodes = []
  walk(document.tree, (node, parent) => {
    nodes.push({
      id: node.id,
      parentId: parent?.id ?? null,
      childIds: node.children.map((child) => child.id),
      name: node.name,
      role: node.role,
      rect: node.rect,
      shape: node.shape,
      component: node.component,
      content: node.content,
    })
  })
  return {
    version: document.version,
    meta: document.meta,
    rootId: document.tree.id,
    nodes,
  }
}
