import * as vscode from 'vscode'

export type Config = {
  revealFocused: boolean
  hydratePrefix: string
  excludesRegExp: RegExp
}

export namespace Config {
  const revealFocusedPath = 'revealFocused'
  const defaultRevealFocused = true

  const hydratePrefixPath = 'hydratePrefix'
  const defaultHydratePrefix = 'HM_'

  const excludesRegExpPath = 'excludesRegEx'
  const defaultExcludesRegExpRaw = '(.stack-work\\/|dist\\/|dist-newstyle\\/)'

  export function create(): Config {
    const hsModsSection = vscode.workspace.getConfiguration('haskell-modules')
    const revealFocused = hsModsSection.get<boolean>(revealFocusedPath, defaultRevealFocused)
    const hydratePrefix = hsModsSection.get<string>(hydratePrefixPath, defaultHydratePrefix)
    const excludesRegExpRaw = hsModsSection.get<string>(excludesRegExpPath, defaultExcludesRegExpRaw)
    const excludesRegExp = new RegExp(excludesRegExpRaw)
    return { revealFocused, hydratePrefix, excludesRegExp }
  }
}
