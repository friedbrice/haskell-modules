import * as vscode from 'vscode'

export type Module = {
  name: Array<string>
  id: string
  shortname: string
  parent?: string
  uri?: vscode.Uri
  sourcedir?: vscode.Uri
}

const moduleDeclRegex = /^module\s+([A-Za-z0-9_\.]+)/

export namespace Module {
  export function path(sourcedir: vscode.Uri, name: Array<string>): vscode.Uri {
    const relPath = [...name.slice(0, -1), `${name.at(-1)}.hs`]
    return vscode.Uri.joinPath(sourcedir, ...relPath)
  }

  export function compare(l: Module, r: Module): number {
    const LT = -1
    const EQ = 0
    const GT = 1

    return l.id < r.id ? LT : l.id > r.id ? GT : EQ
  }

  export function create(fakeName: Array<string>, uri?: vscode.Uri): Module {
    const isMain = fakeName.length === 1 && fakeName[0] === 'Main'
    const name = isMain && uri ? ['Main', uri.fsPath] : fakeName
    const id = name.join('.')
    const shortname = name.at(-1) || ''
    const parent = name.length > 1 ? name.slice(0, -1).join('.') : undefined
    const sourcedir = uri
      ? vscode.Uri.file(
        uri.fsPath.split('/').slice(0, name[0] === 'Main' ? -1 : -1 * name.length).join('/')
      )
      : undefined
    const module = { name, shortname, id, parent, uri, sourcedir }
    return module
  }

  export function ancestors(leafname: Array<string>): Array<Module> {
    const ancestors: Array<Module> = []
    for (let i = 1; i < leafname.length; i++) {
      ancestors.push(create(leafname.slice(0, i)))
    }
    return ancestors
  }

  export async function fromSourceFile(uri: vscode.Uri): Promise<Module> {
    const bytes = await vscode.workspace.fs.readFile(uri)
    const content = new TextDecoder().decode(bytes)
    let maybeName
    for (const line of content.split('\n')) {
      const res = moduleDeclRegex.exec(line)
      if (res && res[1]) {
        maybeName = res[1]
        break;
      }
    }

    const name = maybeName?.split(/\./) || ['Main']

    return create(name, uri)
  }
}
