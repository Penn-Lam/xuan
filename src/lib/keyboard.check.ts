import assert from "node:assert/strict"
import { isEditableTarget } from "./keyboard"

const target = (tagName: string, isContentEditable = false) =>
  ({ tagName, isContentEditable }) as unknown as EventTarget

assert.equal(isEditableTarget(target("INPUT")), true)
assert.equal(isEditableTarget(target("TEXTAREA")), true)
assert.equal(isEditableTarget(target("SELECT")), true)
assert.equal(isEditableTarget(target("DIV", true)), true)
assert.equal(isEditableTarget(target("BUTTON")), false)
