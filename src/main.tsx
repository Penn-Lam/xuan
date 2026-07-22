// ============================================================
//  xuan 入口 —— Geist 字体 + Phosphor 图标全局 weight + Tooltip
// ============================================================
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { IconContext } from "@phosphor-icons/react"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/lib/i18n"

// Geist 字体（Vite 用 Fontsource variable 包，非 Next.js geist 包）
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"
// React Flow v12 样式
import "@xyflow/react/dist/style.css"

import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <IconContext.Provider value={{ weight: "light" }}>
          <TooltipProvider delay={300}>
            <App />
          </TooltipProvider>
        </IconContext.Provider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
