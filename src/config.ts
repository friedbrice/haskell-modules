import * as vscode from 'vscode'

export type Config = {
  revealFocused: boolean
  hydratePrefix: string
  excludesRegExp: RegExp
}

export namespace Config {
  const defaultRevealFocused = true
  const defaultHydratePrefix = 'HM_'
  const defaultExcludesRegExpRaw = '(.stack-work\\/|dist\\/|dist-newstyle\\/)'

  export function create(): Config {
    const hsModsSection = vscode.workspace.getConfiguration('haskell-modules')
    const revealFocused = hsModsSection.get<boolean>('revealFocused', defaultRevealFocused)
    const hydratePrefix = hsModsSection.get<string>('hydratePrefix', defaultHydratePrefix)
    const excludesRegExpRaw = hsModsSection.get<string>('excludeRegex', defaultExcludesRegExpRaw)
    const excludesRegExp = new RegExp(excludesRegExpRaw)
    return { revealFocused, hydratePrefix, excludesRegExp }
  }
}
