import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught application error", error, info)
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children
  }
}

function ErrorFallback() {
  const { t } = useI18n()
  const retry = () => window.location.reload()

  return (
    <main
      role="alert"
      className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground"
    >
      <h1 className="text-lg font-semibold">{t("Something went wrong")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("Reload the editor to recover your saved work.")}
      </p>
      <Button type="button" onClick={retry}>
        {t("Reload")}
      </Button>
    </main>
  )
}
