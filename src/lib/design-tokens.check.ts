import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"

const componentRoot = new URL("../components", import.meta.url).pathname
const colorLiteral = /#[\da-f]{3,8}|(?:rgb|hsl|oklch)a?\(/i
const paletteUtility = /(?:text|bg|border|ring|fill|stroke)-(?:red|blue|green|amber|yellow|orange|purple|pink|teal|cyan|indigo|violet|rose|lime|emerald|sky|slate|gray|zinc|neutral|stone)-\d+/

function checkDirectory(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) checkDirectory(path)
    else if ([".ts", ".tsx", ".css"].includes(extname(path))) {
      const source = readFileSync(path, "utf8")
      assert(!colorLiteral.test(source), `Use a color token in ${path}`)
      assert(!paletteUtility.test(source), `Use a semantic color token in ${path}`)
    }
  }
}

checkDirectory(componentRoot)
console.log("design tokens: ok")
