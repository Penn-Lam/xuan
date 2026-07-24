import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const TEXT_LINE_HEIGHT = 16
const TEXT_VERTICAL_INSET = 8

interface TextConstraint {
  kind: "ellipsis" | "clamp"
  maxLines: number
}

interface TextRendererProps {
  children: string
  role: string
  height: number
  isEditing?: boolean
  leading?: ReactNode
}

export function getTextConstraint(role: string, height: number): TextConstraint {
  if (role === "caption") {
    return {
      kind: "clamp",
      maxLines: Math.min(2, Math.max(1, Math.floor((height - TEXT_VERTICAL_INSET) / TEXT_LINE_HEIGHT))),
    }
  }

  if (role === "description") {
    return {
      kind: "clamp",
      maxLines: Math.max(1, Math.floor((height - TEXT_VERTICAL_INSET) / TEXT_LINE_HEIGHT)),
    }
  }

  return { kind: "ellipsis", maxLines: 1 }
}

export function TextRenderer({
  children,
  role,
  height,
  isEditing = false,
  leading,
}: TextRendererProps) {
  const constraint = getTextConstraint(role, height)
  const clampStyle = constraint.kind === "clamp"
    ? {
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: constraint.maxLines,
        display: "-webkit-box",
      }
    : undefined

  return (
    <div
      className={cn(
        "absolute inset-x-1.5 bottom-1 top-1 flex min-h-0 min-w-0 items-start gap-1 overflow-hidden",
        isEditing && "pointer-events-auto overflow-y-auto overscroll-contain",
      )}
      data-text-mode={isEditing ? "edit" : "preview"}
    >
      {leading}
      <span
        className={cn(
          "min-w-0 flex-1 text-xs font-semibold leading-4 text-foreground drop-shadow-sm",
          isEditing
            ? "whitespace-pre-wrap break-words"
            : constraint.kind === "ellipsis"
              ? "truncate"
              : "overflow-hidden break-words",
        )}
        style={isEditing ? undefined : clampStyle}
        title={isEditing ? undefined : children}
      >
        {children}
      </span>
    </div>
  )
}
