import * as vscode from 'vscode'

import { Commands } from './commands'
import { Config } from './config'
import { Index } from './index'
import { Module } from './module'
import { Tells } from './tells'

export async function activate(context: vscode.ExtensionContext) {
  const provider = await initProvider()
  context.subscriptions.push(provider)
}

export function deactivate() { }

async function initProvider(): Promise<vscode.Disposable> {
  const disposables: Array<vscode.Disposable> = []

  const tells = Tells._new()
  const tell = tells('initProvider')
  disposables.push(tells)
  const index = Index.create()

  tell('Starting haskell-modules')

  let initialConfig = Config.create()
  tell('Found initial config', initialConfig)

  const changeEvents = new vscode.EventEmitter<Module | undefined>()
  disposables.push(changeEvents)

  const view = vscode.window.createTreeView('haskell-modules', {
    showCollapseAll: true,
    treeDataProvider: (() => {

      function getTreeItem(module: Module): vscode.TreeItem {
        const collapseState = !module.uri || index.getChildren(module)[0]
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri
        let name = module.shortname
        if (module.name[0] === 'Main') {
          if (workspaceRoot) {
            name = name.replace(workspaceRoot.fsPath, '')
          }
        }
        const item = new vscode.TreeItem(name, collapseState)
        item.id = module.id
        item.tooltip = module.id
        item.resourceUri = module.uri
        item.iconPath = module.uri ? vscode.ThemeIcon.File : new vscode.ThemeIcon('circle-outline')
        item.command = module.uri ? {
          title: `Open ${module.uri.toString()}`,
          command: 'vscode.open',
          arguments: [module.uri]
        } : undefined
        item.contextValue = !module.uri ? 'virtual' : module.name[0] === 'Main' ? 'main' : 'physical'
        return item
      }

      return {
        onDidChangeTreeData: changeEvents.event,
        getChildren: index.getChildren,
        getParent: index.getParent,
        getTreeItem
      }
    })()
  })
  disposables.push(view)

  async function dispose(): Promise<void> {
    const tell = tells('dispose')
    tell('Disposing haskell-modules..')
    disposables.map(x => x.dispose())
    tell('haskell-modules is disposed')
  }

  const commands = Commands.create(tells, initialConfig, index, changeEvents, view)

  disposables.push(
    vscode.commands.registerCommand('haskell-modules.refresh', commands.populate),
    vscode.commands.registerCommand('haskell-modules.add', commands.addSubmodule),
    vscode.commands.registerCommand('haskell-modules.create', commands.createModuleFile),
    vscode.commands.registerCommand('haskell-modules.rename', commands.renameModule),
    vscode.commands.registerTextEditorCommand('haskell-modules.jump', commands.jumpToModule),
    vscode.commands.registerTextEditorCommand('haskell-modules.hydrate', commands.hydrateModule),
    vscode.commands.registerTextEditorCommand('haskell-modules.dehydrate', commands.dehydrateModule),
    vscode.window.onDidChangeActiveTextEditor(commands.focusModule),
    vscode.workspace.onDidChangeConfiguration(commands.updateConfig)
  )

  await commands.populate()

  tell('Done with initial setup')

  return { dispose }
}
