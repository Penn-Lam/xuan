// ============================================================
//  PageMenu —— 多页面切换/创建/删除下拉
// ============================================================
import { Plus, File, Trash } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/lib/i18n"

export function PageMenu() {
  const { t } = useI18n()
  const pages = useEditorStore((s) => s.pages)
  const activePageId = useEditorStore((s) => s.activePageId)
  const switchPage = useEditorStore((s) => s.switchPage)
  const createPage = useEditorStore((s) => s.createPage)
  const deletePage = useEditorStore((s) => s.deletePage)

  const pageList = Object.entries(pages)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <File />
        {t("Pages")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          {pageList.map(([id, doc]) => (
            <DropdownMenuItem
              key={id}
              onClick={() => switchPage(id)}
              className="justify-between"
              data-active={id === activePageId}
            >
              <span className="truncate">{doc.meta.name}</span>
              {pageList.length > 1 && (
                <Trash
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePage(id)
                  }}
                />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => createPage()}>
            <Plus />
            {t("New Page")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
