import { resolve as resolveTs } from 'ts-node/esm'
import * as tsConfigPaths from 'tsconfig-paths'
import { pathToFileURL } from 'url'

const tsConfig = tsConfigPaths.loadConfig()
if (tsConfig.resultType !== "success") {
  console.error('Failed to load tsconfig.json')
  process.exit(1)
}

const { absoluteBaseUrl, paths } = tsConfig
const matchPath = tsConfigPaths.createMatchPath(absoluteBaseUrl, paths)

export async function resolve(specifier, context, nextResolve) {
  try {
    const match = matchPath(specifier)
    if (match) {
      return nextResolve(pathToFileURL(match).href)
    }
    return nextResolve(specifier)
  } catch (error) {
    console.error('Error in module resolution:', error)
    return nextResolve(specifier)
  }
}

export const load = (url, context, nextLoad) => nextLoad(url, context) 