---
name: xuan-canvas-layout
description: Lay out an existing Xuan IA on Canvas, resize and arrange nodes, bind shadcn/ui components, set component props, and author structured content intent. Use after information architecture exists when the user asks for wireframe layout, placement, previewable components, responsive viewport composition, or Canvas changes.
---

# Xuan Canvas Layout

Turn existing IA into a layout without changing its semantic tree.

## Required workflow

1. Call `get_xuan_document_context` with the active project root.
2. Confirm the required IA nodes and roles already exist. If they do not, use `xuan-ia-writer` before continuing.
3. Inspect the project's supported component catalog when available (for this editor, `src/store/catalog.ts`). Prefer a supported shadcn/ui component whose semantics match the node.
4. Lay out containers before descendants. Xuan coordinates are absolute. Keep descendants inside their parent bounds and preserve readable gaps.
5. Call `apply_xuan_canvas_operations` with the current `expectedRevision`, a stable `clientMutationId`, and the smallest atomic batch.
6. Read context again and verify geometry, component refs, props, content fields, and revision. The running Xuan editor syncs the document automatically.

On a revision conflict, re-read context, rebuild against the latest document, and retry with a new mutation ID. Stop after three failed attempts.

## Operation boundaries

Use only:

- `set_rect`, `set_shape`, `auto_layout`
- `bind_component`, `unbind_component`
- `set_prop`, `remove_prop`
- `set_content`, `set_content_field`, `remove_content_field`

Use props for component behavior or variants. Use content fields for copy and representative data, with field names such as `text`, `label`, `title`, `description`, `items`, `placeholder`, or `emptyState`.

Bind components selectively; semantic containers may remain unbound. Do not rename nodes, change roles, reparent, reorder, add, or remove IA nodes in this stage.

