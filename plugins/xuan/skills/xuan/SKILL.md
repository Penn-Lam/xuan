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

