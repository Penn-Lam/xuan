import { useId, useState } from "react"
import { Plus, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SemanticField, SemanticFieldType } from "@/store/catalog"
import { useI18n } from "@/lib/i18n"

interface SemanticFieldsEditorProps {
  definitions: SemanticField[]
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  fieldKind: "prop" | "content"
}

function inferType(value: unknown): SemanticFieldType {
  if (Array.isArray(value)) return "string-list"
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  return "string"
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ")
  if (value && typeof value === "object") return JSON.stringify(value)
  return value == null ? "" : String(value)
}

function parseValue(value: string, type: SemanticFieldType): unknown {
  if (type === "number") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (type === "boolean") return value.toLowerCase() === "true"
  if (type === "string-list") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return value
}

interface ValueEditorProps {
  definition: SemanticField
  value: string
  onChange: (value: string) => void
  commitOnBlur?: boolean
  onEnter?: () => void
  ariaLabel: string
}

function ValueEditor({ definition, value, onChange, commitOnBlur, onEnter, ariaLabel }: ValueEditorProps) {
  const controlId = useId()

  if (definition.options) {
    return (
      <>
        <Label htmlFor={controlId} className="sr-only">{ariaLabel}</Label>
        <Select value={value} onValueChange={(next) => next && onChange(next)}>
          <SelectTrigger id={controlId} size="sm" className="flex-1">
            <SelectValue placeholder={definition.placeholder ?? "Value"} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {definition.options.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </>
    )
  }

  return (
    <>
      <Label htmlFor={controlId} className="sr-only">{ariaLabel}</Label>
      <Input
        id={controlId}
        type={definition.type === "number" ? "number" : "text"}
        placeholder={definition.placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.()
        }}
        className="h-7 flex-1 text-xs"
        {...(commitOnBlur
          ? { defaultValue: value, onBlur: (event) => onChange(event.target.value) }
          : { value, onChange: (event) => onChange(event.target.value) })}
      />
    </>
  )
}

export function SemanticFieldsEditor({
  definitions,
  value,
  onChange,
  fieldKind,
}: SemanticFieldsEditorProps) {
  const { t } = useI18n()
  const [draftField, setDraftField] = useState("")
  const [draftValue, setDraftValue] = useState("")
  const entries = Object.entries(value)
  const usedFields = new Set(entries.map(([key]) => key))
  const availableFields = definitions.filter(({ key }) => !usedFields.has(key))

  const definitionFor = (key: string, currentValue?: unknown): SemanticField =>
    definitions.find((field) => field.key === key) ?? {
      key,
      label: key,
      type: inferType(currentValue),
    }

  const renameField = (previousKey: string, nextKey: string) => {
    if (previousKey === nextKey) return
    const next = { ...value }
    next[nextKey] = next[previousKey]
    delete next[previousKey]
    onChange(next)
  }

  const updateField = (key: string, input: string) => {
    const definition = definitionFor(key, value[key])
    onChange({ ...value, [key]: parseValue(input, definition.type) })
  }

  const removeField = (key: string) => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }

  const addField = () => {
    if (!draftField) return
    const definition = definitionFor(draftField)
    onChange({ ...value, [draftField]: parseValue(draftValue, definition.type) })
    setDraftField("")
    setDraftValue("")
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([key, currentValue]) => {
        const definition = definitionFor(key, currentValue)
        const formattedValue = formatValue(currentValue)
        const options = [
          definition,
          ...definitions.filter(
            (field) => field.key !== key && !usedFields.has(field.key),
          ),
        ]
        return (
          <div key={key} className="flex items-center gap-1.5">
            <Label htmlFor={`semantic-field-${key}`} className="sr-only">
              {`${t(definition.label)} ${t(fieldKind)}`}
            </Label>
            <Select value={key} onValueChange={(nextKey) => nextKey && renameField(key, nextKey)}>
              <SelectTrigger
                id={`semantic-field-${key}`}
                size="sm"
                className="w-[42%]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {t(field.label)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <ValueEditor
              key={`${key}:${formattedValue}`}
              definition={definition}
              value={formattedValue}
              onChange={(nextValue) => {
                if (nextValue !== formattedValue) updateField(key, nextValue)
              }}
              commitOnBlur={!definition.options}
              ariaLabel={`${t(definition.label)} ${t("Value")}`}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => removeField(key)}
              aria-label={`${t("Remove")} ${t(definition.label)}`}
              title="Remove field"
            >
              <X />
            </Button>
          </div>
        )
      })}

      <div className="flex items-center gap-1.5">
        <Label htmlFor="new-semantic-field" className="sr-only">
          {`${t("Add")} ${t(fieldKind)}`}
        </Label>
        <Select value={draftField} onValueChange={(field) => setDraftField(field ?? "")}>
          <SelectTrigger
            id="new-semantic-field"
            size="sm"
            className="w-[42%]"
          >
            <SelectValue placeholder={t("Add field…")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableFields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {t(field.label)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <ValueEditor
          definition={definitionFor(draftField)}
          value={draftValue}
          onChange={setDraftValue}
          onEnter={addField}
          ariaLabel={t("New field value")}
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={addField}
          disabled={!draftField}
          aria-label={t("Add field")}
          title="Add field"
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}
