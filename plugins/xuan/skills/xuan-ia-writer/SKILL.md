---
name: xuan-ia-writer
description: Create or update Xuan information architecture as a semantic mind map from an existing Feature Map. Use when the user asks to build pages, sections, navigation hierarchy, content groups, roles, parent-child relationships, or otherwise operate the Xuan IA without deciding visual layout.
---

# Xuan IA Writer

Translate feature intent into semantic information architecture. IA defines **what exists and how it is organized**, not how it looks.

## Required workflow

1. Read `.xuan/feature-map.md` when present. If the request starts from vague source material and no Feature Map exists, use `xuan-feature-map` first.
2. Call `get_xuan_document_context` with the active project root. If the user requested a new page, call `create_xuan_page`; if they are continuing a missing document, call `initialize_xuan_document`. Then read context again.
3. Identify the smallest IA branch needed to support the selected P0/P1 features. Preserve unaffected nodes and stable IDs.
4. Call `apply_xuan_ia_operations` with the current `expectedRevision`, a new stable `clientMutationId`, and one atomic operation batch.
5. Read context again and verify names, roles, parent-child order, feature coverage, and the returned revision.

On a revision conflict, re-read context, rebuild against the latest tree, and retry with a new mutation ID. Stop after three failed attempts.

## Operation boundaries

Use only:

- `set_document_name`
- `add_node`
- `rename_node`
- `set_role`
- `move_node`
- `reorder_node`
- `remove_node`

Choose semantic roles such as `page`, `navigation`, `header`, `main`, `section`, `form`, `search`, `list`, `card`, or `cta`. Names should describe user meaning, not geometry.

Do not bind components, edit props/content intent, set shapes, or place coordinates. New nodes receive neutral placeholder geometry until the Canvas stage.

Never write an export JSON for manual import. A running editor automatically adds pages created by `create_xuan_page` and switches to them.
