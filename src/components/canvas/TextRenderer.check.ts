import assert from "node:assert/strict"
import { getTextConstraint } from "./TextRenderer"

assert.deepEqual(getTextConstraint("heading", 48), {
  kind: "ellipsis",
  maxLines: 1,
})
assert.deepEqual(getTextConstraint("branding", 48), {
  kind: "ellipsis",
  maxLines: 1,
})
assert.deepEqual(getTextConstraint("caption", 20), {
  kind: "clamp",
  maxLines: 1,
})
assert.deepEqual(getTextConstraint("caption", 48), {
  kind: "clamp",
  maxLines: 2,
})
assert.deepEqual(getTextConstraint("description", 64), {
  kind: "clamp",
  maxLines: 3,
})
assert.deepEqual(getTextConstraint("action", 64), {
  kind: "ellipsis",
  maxLines: 1,
})

console.log("canvas text constraints: ok")
