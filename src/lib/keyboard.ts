export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return Boolean(
    element &&
      (["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) ||
        element.isContentEditable),
  )
}
