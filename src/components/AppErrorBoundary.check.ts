import assert from "node:assert/strict"
import { AppErrorBoundary } from "./AppErrorBoundary"

assert.deepEqual(AppErrorBoundary.getDerivedStateFromError(), { hasError: true })
