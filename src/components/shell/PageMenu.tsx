// ============================================================
//  PageMenu —— 多页面切换/创建/删除下拉
//  每页 = DropdownMenuSub：trigger 显示页名（点击切换），
//  hover 展开子菜单「复制 / 删除」
//  base-ui Submenu 自带安全三角区 + delay/closeDelay 防误触
// ============================================================
import { Plus, File, Trash } from "@phosphor-icons/react"
import { useEditorStore } from "@/store/useEditorStore"
import { buttonVariants } from "@/components/ui/button-variants"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
            <DropdownMenuSub key={id}>
              <DropdownMenuSubTrigger
                data-active={id === activePageId}
                onClick={() => switchPage(id)}
              >
                <span className="truncate">{doc.meta.name}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {pageList.length > 1 && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => deletePage(id)}
                  >
                    <Trash />
                    {t("Delete")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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

