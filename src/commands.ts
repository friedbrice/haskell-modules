import * as vscode from 'vscode'

import { Config } from './config'
import { Index } from './index'
import { Module } from './module'
import { Tells } from './tells'

export type Commands = {
  /** Search the workspace for Haskell module files. */
  populate: () => Promise<boolean>

  /** Add a submodule to the given module. */
  addSubmodule: (m: Module) => Promise<boolean>

  /** Create a module file for the given virtual module. */
  createModuleFile: (m: Module, content?: string) => Promise<boolean>

  /** Duplicate a module under a different name. Does not remove the original file. */
  renameModule: (m: Module) => Promise<boolean>

  /** Open the module under cursor in an editor. */
  jumpToModule: (editor: vscode.TextEditor) => Promise<boolean>

  /** Add qualified imports to a module. */
  hydrateModule: (editor: vscode.TextEditor) => Promise<boolean>

  /** Change qualified imports to minimal imports. */
  dehydrateModule: (editor: vscode.TextEditor) => Promise<boolean>

  /** Focus and highlight in the tree view the module in the current editor. */
  focusModule: (editor: vscode.TextEditor | undefined) => Promise<boolean>

  /** Update the configuration from the workspace settings. */
  updateConfig: () => Promise<boolean>
}

const moduleIdentifierRegex = /([A-Z][A-Za-z0-9_\.]+)/

const moduleImportRegex = /^import\s+(qualified\s+)?([A-Z][A-Za-z0-9_\.]+)/

function hydratedImport(prefix: string, moduleId: string, sequence: number): string {
  return `import qualified ${moduleId} as ${prefix}${sequence}`
}

function hydratedImportRegex(prefix: string): RegExp {
  return new RegExp(`^import qualified ([A-Z][A-Za-z0-9_\\.]+) as ${prefix}_(\\d+)`)
}

function hydratedReferenceRegex(prefix: string): RegExp {
  return new RegExp(`${prefix}_(\\d+)\\.([a-z_][A-Za-z0-9_]+)`)
}

function textAtCursor(editor: vscode.TextEditor): string | undefined {
  const { document, selection } = editor
  const wordRange = document.getWordRangeAtPosition(selection.start)
  const text =
    !selection.isEmpty
      ? document.getText(selection)
      : wordRange
        ? document.getText(wordRange)
        : undefined
  return text
}

export namespace Commands {
  export function create(
    tells: Tells,
    initialConfig: Config,
    index: Index,
    changeEvents: vscode.EventEmitter<Module | undefined>,
    view: vscode.TreeView<Module>
  ): Commands {

    // PRIVATE

    let config = initialConfig

    async function getModuleContents(m: Module): Promise<string | undefined> {
      const tell = tells('getModuleContents')
      tell(undefined, m)

      if (!m.uri) {
        tell('Module is missing `uri` field')
        return
      }

      const exists = await fileExists(m.uri)
      if (!exists) {
        tell('Module is missing source file', m.uri.fsPath)
        return
      }

      const bytes = await vscode.workspace.fs.readFile(m.uri)
      const contents = new TextDecoder().decode(bytes)

      return contents
    }

    async function askSourceDirPath(): Promise<vscode.Uri | undefined> {
      const tell = tells('askSourceDirPath')
      tell()
      const srcDirs = index.getSourceDirs()
      if (srcDirs.length === 0) {
        tell('No Haskell source directories')
        return
      }
      if (srcDirs.length === 1) {
        const dir = srcDirs[1]
        tell('Found one Haskell source directory', dir)
        return vscode.Uri.file(dir)
      }
      tell('Found Haskell source directories', srcDirs)

      tell('Prompting user selection..')
      const path = await vscode.window.showQuickPick(srcDirs)
      if (!path) {
        tell('Could not get user input')
        return
      }

      const sourceDir = vscode.Uri.file(path)
      tell('Selected Haskell source directory', sourceDir)
      return sourceDir
    }

    async function fileExists(uri: vscode.Uri): Promise<boolean> {
      const tell = tells('fileExists')
      tell(undefined, uri)
      try {
        await vscode.workspace.fs.stat(uri)
      } catch {
        tell('No such file')
        return false
      }
      tell('Found file')
      return true
    }

    // PUBLIC

    async function populate(): Promise<boolean> {
      const tell = tells('populate')
      tell('Looking for Haskell files..')

      const haskellFiles = await vscode.workspace
        .findFiles('**/*.hs')
        .then(files => files.filter(file => !config.excludesRegExp.test(file.fsPath)))
      tell('Found Haskell files', haskellFiles)

      const physicalModules = await Promise.all(haskellFiles.map(Module.fromSourceFile))
      for (const module of physicalModules) {
        tell('Adding module', module)
        index.insert(module)
      }

      changeEvents.fire(undefined)

      tell('Done')
      return true
    }

    async function addSubmodule(m: Module): Promise<boolean> {
      const tell = tells('addSubmodule')
      tell(undefined, m)
      const shortname = await vscode.window.showInputBox({ placeHolder: 'Submodule name' })
      if (!shortname) {
        tell('Could not get user input')
        return populate()
      }
      const fullname = [...m.name, shortname]
      tell('Creating submodule', fullname)
      return createModuleFile(Module.create(fullname))
    }

    async function createModuleFile(m: Module, content?: string): Promise<boolean> {
      const tell = tells('createModuleFile')
      tell(undefined, m)

      const sourcedir = await askSourceDirPath()
      if (!sourcedir) {
        tell('Could not get user input')
        return populate()
      }
      await vscode.workspace.fs.createDirectory(sourcedir)

      const path = Module.path(sourcedir, m.name)

      const exists = await fileExists(path)
      if (exists) {
        tell('File already exists', path.fsPath)
        return populate()
      }

      tell('Creating file', path.fsPath)
      content && tell('File content', content)
      await vscode.workspace.fs.writeFile(path, new TextEncoder().encode(content || `module ${m.name.join('.')} where\n`))
      await vscode.window.showTextDocument(path)

      return populate()
    }

    async function renameModule(m: Module): Promise<boolean> {
      // TODO: find and replace references to the original module in the workspace.
      const tell = tells('renameModule')
      tell(undefined, m)

      const oldContent = await getModuleContents(m)
      if (!oldContent) {
        tell('Could not get module contents')
        return populate()
      }

      const name = await vscode.window
        .showInputBox({ placeHolder: 'New full module name (with dots)' })
        .then(x => x?.split('.'))
      if (!name) {
        tell('Could not get user input')
        return populate()
      }

      const newContent = oldContent.replace(`${m.name.join('.')}`, `${name.join('.')}`)
      return createModuleFile(Module.create(name), newContent)
    }

    async function jumpToModule(editor: vscode.TextEditor): Promise<boolean> {
      const tell = tells('jumpToModule')
      tell(undefined, editor)

      const text = textAtCursor(editor)
      if (!text) {
        tell('Could not get text at cursor')
        return populate()
      }

      const res = moduleIdentifierRegex.exec(text)
      if (!res) {
        tell('Could not find module identifier in text', text)
        return populate()
      }

      const moduleId = res[0]
      const module = index.get(moduleId)
      if (!module || !module.uri) {
        tell('Could not find module for identifier', moduleId)
        return populate()
      }

      const moduleUri = module.uri
      vscode.window.showTextDocument(moduleUri)

      return populate()
    }

    async function hydrateModule(editor: vscode.TextEditor): Promise<boolean> {
      // TODO: implement this.
      const tell = tells('hydrateModule')
      tell(undefined, editor)

      const lines = editor.document.getText().split('\n')
      const imports: Array<string> = []

      for (const line of lines) {
        const match = moduleImportRegex.exec(line)
        if (match) {
          imports.push(match[2])
        }
      }

      const hydtratedImports = imports.map((moduleId, i) => hydratedImport(config.hydratePrefix, moduleId, i + 1))
      const textToInsert = '\n' + hydtratedImports.join('\n') + '\n\n'

      const insertPosition = lines.findIndex(line => moduleImportRegex.test(line))

      if (insertPosition === -1) { return populate() }

      editor.edit(builder => {
        builder.insert(
          new vscode.Position(insertPosition, 0),
          textToInsert
        )
      })

      return populate()
    }

    async function dehydrateModule(editor: vscode.TextEditor): Promise<boolean> {
      // TODO: implement this.
      const tell = tells('dehydrateModule')
      tell(undefined, editor)

      return populate()
    }

    async function focusModule(editor: vscode.TextEditor | undefined): Promise<boolean> {
      const tell = tells('focusModule')
      tell(undefined, editor)

      if (!config.revealFocused || !view.visible || !editor || editor.document.languageId !== 'haskell') {
        return populate()
      }

      tell('Searching for module for file', editor.document.uri.fsPath)
      const module = index.getByEditor(editor)

      if (!module) {
        tell('Could not find module')
        return populate()
      }
      tell('Found module', module)
      view.reveal(module)
      return populate()
    }

    async function updateConfig(): Promise<boolean> {
      const tell = tells('updateConfig')
      tell('Previous config', config)
      config = Config.create()
      tell('Updated config', config)
      return populate()
    }

    return {
      populate,
      addSubmodule,
      createModuleFile,
      renameModule,
      jumpToModule,
      hydrateModule,
      dehydrateModule,
      focusModule,
      updateConfig
    }
  }
}
