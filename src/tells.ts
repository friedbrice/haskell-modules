import * as vscode from 'vscode'

export type Tells = ((trace: string) => ((message?: string, value?: any) => void)) & vscode.Disposable

export namespace Tells {
  export function _new(): Tells {
    const output = vscode.window.createOutputChannel('haskell-modules')
    const tells: Tells = (trace: string) => {
      return (message?: string, value?: any) => {
        const msg = `(${trace})` + (message ? ` ${message}` : '') + (value ? `: ${JSON.stringify(value)}` : (message ? '.' : ''))
        output.appendLine(msg)
        return
      }
    }
    tells.dispose = () => output.dispose()
    return tells
  }
}
