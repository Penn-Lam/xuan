---
name: xuan
description: Xuan plugin index for schema-first product prototyping. Use when the user explicitly mentions Xuan, asks to start from a feature instead of a layout, or requests a workflow spanning feature discovery, IA mind maps, and Canvas layout/component binding.
---

# Xuan

Route work through the shortest applicable stage:

1. Use `xuan-feature-map` to turn vague ideas, research, or meeting notes into `.xuan/feature-map.md`.
2. Use `xuan-ia-writer` to turn the Feature Map into semantic information architecture.
3. Use `xuan-canvas-layout` only after IA exists, to arrange layout and bind shadcn/ui components and content intent.

Preserve the order: **schema first, then layout**. Start with a feature, not a layout. Do not combine IA and Canvas writes in one mutation batch.

Use the active project root as `projectPath` for every Xuan MCP tool. Never operate the editor through DOM clicks or clipboard automation.

## Editor handoff

- Never create a standalone `*.json` file for the user to import. Xuan MCP writes `.xuan/document.json`; the editor bridge loads it.
- When the user asks for a new editor page, call `create_xuan_page`. When they ask for a region inside the current page, use an IA `add_node` operation.
- After creating or changing a page, reuse or open the returned `editorUrl` in the built-in browser so the result is visible. Do not click Import or use a file picker.
- If the editor URL is unavailable and the active checkout is the Xuan editor, start it with `bun run dev`, then open the URL. Otherwise report that the editor host is not running; keep the document ready for automatic loading when it starts.
