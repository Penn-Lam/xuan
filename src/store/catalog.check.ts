import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  COMPONENT_CATALOG,
  COMPONENTS,
  getContentFields,
  getPropFields,
} from "./catalog"
import { translate } from "../lib/i18n"

assert.equal(translate("zh", "Theme"), "主题")
assert.equal(translate("en", "Theme"), "Theme")
assert.equal(translate("zh", "Unknown key"), "Unknown key")

assert.deepEqual(
  getPropFields("Sidebar").map(({ key }) => key),
  ["side", "variant", "collapsible"],
)
assert(getContentFields("navigation", "Sidebar").some(({ key }) => key === "items"))
assert.equal(COMPONENTS.length, Object.keys(COMPONENT_CATALOG).length)

for (const component of Object.values(COMPONENT_CATALOG)) {
  const keys = component.props.map(({ key }) => key)
  assert.equal(new Set(keys).size, keys.length)
}

interface ExampleNode {
  role: string
  component: { ref: string; props: Record<string, unknown> } | null
  content: Record<string, unknown> | null
  children: ExampleNode[]
}

const example = JSON.parse(
  readFileSync(new URL("../model/default-document.json", import.meta.url), "utf8"),
) as { tree: ExampleNode }
const exampleTypes = new Set<string>()

function checkExampleFields(node: ExampleNode) {
  for (const [key] of Object.entries(node.component?.props ?? {})) {
    const field = getPropFields(node.component!.ref).find((candidate) => candidate.key === key)
    assert(field, `Missing prop definition: ${node.component!.ref}.${key}`)
    exampleTypes.add(field.type)
  }
  for (const [key] of Object.entries(node.content ?? {})) {
    const field = getContentFields(node.role, node.component?.ref).find((candidate) => candidate.key === key)
    assert(field, `Missing content definition: ${node.role}.${key}`)
    exampleTypes.add(field.type)
  }
  node.children.forEach(checkExampleFields)
}

checkExampleFields(example.tree)
assert.deepEqual([...exampleTypes].sort(), ["boolean", "number", "string", "string-list"])

console.log("semantic catalog: ok")
