import { readFile, stat } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve as resolvePath, extname } from 'node:path'
import ts from 'typescript'
import { loadConfig, createMatchPathAsync } from 'tsconfig-paths'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
const projectRoot = fileURLToPath(new URL('.', import.meta.url))

let matchPathAsync = null
const configResult = loadConfig(resolvePath(projectRoot, 'tsconfig.app.json'))
if (configResult.resultType === 'success') {
  matchPathAsync = createMatchPathAsync(configResult.absoluteBaseUrl, configResult.paths)
}

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

  if (!isPathSpecifier(specifier) && matchPathAsync) {
    const matchedPath = await new Promise((resolve, reject) => {
      matchPathAsync(
        specifier,
        undefined,
        undefined,
        [...TS_EXTENSIONS, ...JS_EXTENSIONS],
        (error, result) => {
          if (error) {
            reject(error)
            return
          }
          resolve(result ?? null)
        }
      )
    })

    if (matchedPath) {
      const actualPath = await resolveMatchedFile(matchedPath)
      const url = pathToFileURL(actualPath).href
      return { url, shortCircuit: true }
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
