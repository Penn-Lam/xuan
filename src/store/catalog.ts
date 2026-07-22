// ============================================================
//  Semantic catalog —— vocabulary for components, props, and content
// ============================================================

export const ROLES: string[] = [
  "page",
  "navigation",
  "header",
  "main",
  "content",
  "branding",
  "heading",
  "search",
  "actions",
  "action",
  "cta",
  "stats",
  "stat-card",
  "charts",
  "chart",
  "table",
  "data-table",
  "toolbar",
  "filters",
  "filter",
  "filter-tabs",
  "pagination",
  "caption",
  "user-profile",
  "form",
  "field",
  "list",
  "list-item",
  "card",
  "footer",
  "section",
  "sidebar",
  "hero",
  "feature",
  "testimonial",
]

export type SemanticFieldType = "string" | "number" | "boolean" | "string-list"

export interface SemanticField {
  key: string
  label: string
  type: SemanticFieldType
  placeholder?: string
  options?: string[]
}

export interface ComponentDefinition {
  description: string
  props: SemanticField[]
  content?: SemanticField[]
  acceptsChildren?: boolean
}

const stringField = (
  key: string,
  label: string,
  placeholder?: string,
  options?: string[],
): SemanticField => ({ key, label, type: "string", placeholder, options })

const numberField = (key: string, label: string, placeholder?: string): SemanticField => ({
  key,
  label,
  type: "number",
  placeholder,
})

const booleanField = (key: string, label: string): SemanticField => ({
  key,
  label,
  type: "boolean",
  placeholder: "true or false",
  options: ["true", "false"],
})

const listField = (key: string, label: string, placeholder?: string): SemanticField => ({
  key,
  label,
  type: "string-list",
  placeholder: placeholder ?? "Comma-separated values",
})

export const COMPONENT_CATALOG: Record<string, ComponentDefinition> = {
  Button: {
    description: "Clickable action",
    props: [
      stringField("variant", "Variant", "default", ["default", "secondary", "outline", "ghost", "destructive", "link"]),
      stringField("size", "Size", "default", ["default", "sm", "lg", "icon"]),
      booleanField("disabled", "Disabled"),
    ],
    content: [stringField("label", "Label", "Continue"), stringField("href", "Target", "/")],
  },
  Input: {
    description: "Single-line form input",
    props: [
      stringField("type", "Type", "text", ["text", "email", "password", "search", "number", "date"]),
      stringField("placeholder", "Placeholder", "Enter a value…"),
      booleanField("disabled", "Disabled"),
      booleanField("required", "Required"),
    ],
    content: [stringField("label", "Label", "Email"), stringField("value", "Example value")],
  },
  Textarea: {
    description: "Multi-line form input",
    props: [numberField("rows", "Rows", "4"), stringField("placeholder", "Placeholder")],
    content: [stringField("label", "Label"), stringField("value", "Example value")],
  },
  Select: {
    description: "Choice input",
    props: [stringField("placeholder", "Placeholder", "Choose an option…"), booleanField("disabled", "Disabled")],
    content: [stringField("label", "Label"), listField("options", "Options")],
  },
  Checkbox: { description: "Boolean choice", props: [booleanField("checked", "Checked"), booleanField("disabled", "Disabled")], content: [stringField("label", "Label")] },
  RadioGroup: { description: "Single choice group", props: [stringField("orientation", "Orientation", "vertical", ["vertical", "horizontal"])], content: [stringField("label", "Label"), listField("options", "Options")] },
  Switch: { description: "On/off control", props: [booleanField("checked", "Checked"), booleanField("disabled", "Disabled")], content: [stringField("label", "Label")] },
  Slider: { description: "Numeric range input", props: [numberField("min", "Minimum", "0"), numberField("max", "Maximum", "100"), numberField("step", "Step", "1")], content: [stringField("label", "Label"), numberField("value", "Value", "50")] },
  Card: { description: "Content container", props: [stringField("size", "Size", "default", ["default", "sm"])], content: [stringField("label", "Title"), stringField("description", "Description"), stringField("value", "Value"), stringField("delta", "Delta")], acceptsChildren: true },
  Badge: { description: "Compact status label", props: [stringField("variant", "Variant", "secondary", ["default", "secondary", "outline", "destructive"])], content: [stringField("text", "Text", "Status")] },
  Avatar: { description: "User identity image", props: [stringField("size", "Size", "md", ["sm", "md", "lg"]), stringField("src", "Image URL")], content: [stringField("name", "Name", "Ada Lovelace"), stringField("initials", "Initials", "AL")] },
  Table: { description: "Structured tabular data", props: [booleanField("striped", "Striped")], content: [listField("columns", "Columns", "Order, Customer, Status"), numberField("itemCount", "Row count", "5"), stringField("itemRole", "Row role", "order-row")] },
  Tabs: { description: "Tabbed navigation", props: [stringField("defaultValue", "Default tab")], content: [listField("items", "Tabs", "Overview, Analytics, Reports")] },
  Accordion: { description: "Collapsible content groups", props: [stringField("type", "Type", "single", ["single", "multiple"])], content: [listField("items", "Sections")] },
  Alert: { description: "Prominent status message", props: [stringField("variant", "Variant", "default", ["default", "destructive"])], content: [stringField("title", "Title"), stringField("message", "Message")] },
  Dialog: { description: "Modal surface", props: [booleanField("open", "Open")], content: [stringField("title", "Title"), stringField("description", "Description")] },
  DropdownMenu: { description: "Action menu", props: [], content: [stringField("label", "Trigger label", "Actions"), listField("items", "Menu items")] },
  Popover: { description: "Anchored floating content", props: [], content: [stringField("label", "Trigger label"), stringField("text", "Content")] },
  Tooltip: { description: "Short contextual hint", props: [stringField("side", "Side", "top", ["top", "right", "bottom", "left"])], content: [stringField("text", "Text")] },
  Calendar: { description: "Date picker", props: [stringField("mode", "Mode", "single", ["single", "range"])] },
  Pagination: { description: "Paged navigation", props: [numberField("totalPages", "Total pages", "10"), numberField("page", "Current page", "1")] },
  Separator: { description: "Visual separator", props: [stringField("orientation", "Orientation", "horizontal", ["horizontal", "vertical"])] },
  Skeleton: { description: "Loading placeholder", props: [stringField("width", "Width", "100%"), stringField("height", "Height", "20px")] },
  Sidebar: {
    description: "Primary application navigation",
    props: [
      stringField("side", "Side", "left", ["left", "right"]),
      stringField("variant", "Variant", "sidebar", ["sidebar", "floating", "inset"]),
      stringField("collapsible", "Collapsible", "icon", ["offcanvas", "icon", "none"]),
    ],
    content: [stringField("brand", "Brand", "Acme"), listField("items", "Navigation items", "Overview, Orders, Settings"), stringField("footer", "Footer", "Account")],
    acceptsChildren: true,
  },
  SidebarMenu: { description: "Navigation items inside a sidebar", props: [stringField("activeItem", "Active item")], content: [listField("items", "Navigation items", "Overview, Orders, Settings")] },
  Breadcrumb: { description: "Hierarchy trail", props: [], content: [listField("items", "Segments", "Home, Projects, Current")] },
  ChartContainer: { description: "Data visualization frame", props: [stringField("type", "Chart type", "line", ["line", "bar", "area", "pie"])], content: [stringField("title", "Title"), stringField("range", "Range", "Last 30 days"), listField("series", "Series", "Revenue, Orders")] },
}

export const COMPONENTS = Object.keys(COMPONENT_CATALOG)

const GENERIC_CONTENT_FIELDS: SemanticField[] = [
  stringField("text", "Text"),
  stringField("label", "Label"),
  stringField("description", "Description"),
]

const ROLE_CONTENT_FIELDS: Partial<Record<string, SemanticField[]>> = {
  branding: [stringField("text", "Brand name")],
  heading: [stringField("text", "Heading")],
  search: [stringField("placeholder", "Placeholder", "Search…")],
  cta: [stringField("label", "Label"), stringField("href", "Target")],
  "stat-card": [stringField("label", "Label"), stringField("value", "Value"), stringField("delta", "Delta")],
  navigation: [stringField("brand", "Brand"), listField("items", "Navigation items")],
  sidebar: [stringField("brand", "Brand"), listField("items", "Navigation items"), stringField("footer", "Footer")],
  chart: [stringField("title", "Title"), stringField("range", "Range"), listField("series", "Series")],
  "data-table": [listField("columns", "Columns"), numberField("itemCount", "Row count"), stringField("itemRole", "Row role")],
  table: [listField("columns", "Columns"), numberField("itemCount", "Row count")],
  list: [listField("items", "Items")],
}

function uniqueFields(fields: SemanticField[]): SemanticField[] {
  return fields.filter((field, index) => fields.findIndex(({ key }) => key === field.key) === index)
}

export function getPropFields(componentRef: string): SemanticField[] {
  return COMPONENT_CATALOG[componentRef]?.props ?? []
}

export function getContentFields(role: string, componentRef?: string): SemanticField[] {
  return uniqueFields([
    ...(componentRef ? COMPONENT_CATALOG[componentRef]?.content ?? [] : []),
    ...(ROLE_CONTENT_FIELDS[role] ?? []),
    ...GENERIC_CONTENT_FIELDS,
  ])
}
