import { readFile, stat } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve as resolvePath, extname } from 'node:path'
import ts from 'typescript'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
const projectRoot = fileURLToPath(new URL('.', import.meta.url))
let pathAliasesPromise = null

function hasTsExtension(specifier) {
  return TS_EXTENSIONS.some(ext => specifier.endsWith(ext))
}

function isPathSpecifier(specifier) {
  return specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')
}

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs']

function stripKnownExtension(specifier) {
  for (const ext of [...TS_EXTENSIONS, ...JS_EXTENSIONS]) {
    if (specifier.endsWith(ext)) {
      return specifier.slice(0, -ext.length)
    }
  }
  return specifier
}

async function tryResolveWithExtensions(specifier, context, defaultResolve) {
  const bases = new Set([specifier, stripKnownExtension(specifier)])

  for (const base of bases) {
    for (const ext of [...TS_EXTENSIONS, ...JS_EXTENSIONS]) {
      try {
        return await defaultResolve(`${base}${ext}`, context, defaultResolve)
      } catch {
        // try next
      }
    }

    for (const ext of [...TS_EXTENSIONS, ...JS_EXTENSIONS]) {
      try {
        return await defaultResolve(`${base}/index${ext}`, context, defaultResolve)
      } catch {
        // try next
      }
    }
  }

  return null
}

async function loadPathAliases() {
  if (pathAliasesPromise) {
    return pathAliasesPromise
  }

  pathAliasesPromise = (async () => {
    try {
      const configPath = resolvePath(projectRoot, 'tsconfig.app.json')
      const configText = await readFile(configPath, 'utf8')
      const parsed = ts.parseConfigFileTextToJson(configPath, configText)
      if (parsed.error) {
        return []
      }
      const config = parsed.config ?? {}
      const compilerOptions = config?.compilerOptions ?? {}
      const baseUrl = compilerOptions.baseUrl ?? '.'
      const paths = compilerOptions.paths ?? {}

      const aliases = []
      for (const [pattern, targets] of Object.entries(paths)) {
        const prefix = pattern.replace(/\*$/, '')
        for (const target of targets) {
          const targetBase = target.replace(/\*$/, '')
          const resolvedTarget = resolvePath(projectRoot, baseUrl, targetBase)
          aliases.push({ prefix, target: resolvedTarget })
        }
      }

      return aliases
    } catch {
      return []
    }
  })()

  return pathAliasesPromise
}
async function resolveMatchedFile(matchedPath) {
  const currentExt = extname(matchedPath)
  const basePath = currentExt ? matchedPath.slice(0, -currentExt.length) : matchedPath

  if (currentExt) {
    try {
      const stats = await stat(matchedPath)
      if (stats.isFile()) {
        return matchedPath
      }
    } catch {
      // fall through to try alternative extensions
    }
  }

  for (const ext of [...TS_EXTENSIONS, ...JS_EXTENSIONS]) {
    const candidate = `${basePath}${ext}`
    try {
      const stats = await stat(candidate)
      if (stats.isFile()) {
        return candidate
      }
    } catch {
      // try next
    }
  }

  for (const ext of [...TS_EXTENSIONS, ...JS_EXTENSIONS]) {
    const candidate = resolvePath(basePath, `index${ext}`)
    try {
      const stats = await stat(candidate)
      if (stats.isFile()) {
        return candidate
      }
    } catch {
      // try next
    }
  }

  return matchedPath
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return defaultResolve(specifier, context, defaultResolve)
  }

  if (hasTsExtension(specifier)) {
    try {
      const resolved = await defaultResolve(specifier, context, defaultResolve)
      return { ...resolved, shortCircuit: true }
    } catch (error) {
      if (isPathSpecifier(specifier)) {
        const parentURL = context.parentURL ?? pathToFileURL(process.cwd() + '/').href
        const url = new URL(specifier, parentURL).href
        return { url, shortCircuit: true }
      }
      throw error
    }
  }

  if (!isPathSpecifier(specifier)) {
    const pathAliases = await loadPathAliases()

    for (const alias of pathAliases) {
      if (alias.prefix && specifier.startsWith(alias.prefix)) {
        const remainder = specifier.slice(alias.prefix.length)
        const candidatePath = resolvePath(alias.target, remainder)
        const actualPath = await resolveMatchedFile(candidatePath)
        const url = pathToFileURL(actualPath).href
        return { url, shortCircuit: true }
      }
    }
  }

  if (isPathSpecifier(specifier)) {
    try {
      return await defaultResolve(specifier, context, defaultResolve)
    } catch (error) {
      const resolved = await tryResolveWithExtensions(specifier, context, defaultResolve)
      if (resolved) {
        return { ...resolved, shortCircuit: true }
      }
      throw error
    }
  }

  return defaultResolve(specifier, context, defaultResolve)
}

export async function load(url, context, defaultLoad) {
  if (hasTsExtension(url)) {
    const filePath = fileURLToPath(url)
    const source = await readFile(filePath, 'utf8')
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        importHelpers: false,
        sourceMap: false,
        resolveJsonModule: true
      },
      fileName: filePath
    })

    return {
      format: 'module',
      source: transpiled.outputText,
      shortCircuit: true
    }
  }

  return defaultLoad(url, context, defaultLoad)
}
