import * as vscode from 'vscode'

import { Module } from './module'

export type Index = {
  get(id: ModuleId): Module | undefined
  getByFilePath(filePath: FilePath): Module | undefined
  getByEditor(uri: vscode.TextEditor): Module | undefined
  getChildren(parent?: Module): Array<Module>
  getParent(child: Module): Module | undefined
  getSourceDirs(): Array<string>
  insert(module: Module): void
}

type ModuleId = string
type FilePath = string

export namespace Index {
  export function create(): Index {
    const modules = new Map<ModuleId, Module>()
    const filenames = new Map<FilePath, ModuleId>()
    const sourcedirs = new Set<string>()

    function get(id: ModuleId): Module | undefined {
      return modules.get(id)
    }

    function getByFilePath(filePath: FilePath): Module | undefined {
      const moduleId = filenames.get(filePath)
      return moduleId ? get(moduleId) : undefined
    }

    function getByEditor(editor: vscode.TextEditor): Module | undefined {
      return getByFilePath(editor.document.uri.fsPath)
    }

    function getChildren(parent?: Module): Array<Module> {
      if (!parent) {
        const topLevel = new Array<Module>()
        for (const module of modules.values()) {
          if (module.name.length === 1) topLevel.push(module)
        }
        topLevel.sort(Module.compare)
        return topLevel
      } else {
        const children = new Array<Module>()
        for (const module of modules.values()) {
          if (module.parent && module.parent === parent.id) { children.push(module) }
        }
        children.sort(Module.compare)
        return children
      }
    }

    function getParent(child: Module): Module | undefined {
      return child.parent
        ? modules.get(child.parent)
        : undefined
    }

    function getSourceDirs(): Array<string> {
      return [...sourcedirs].sort()
    }

    function insert(module: Module): void {
      modules.set(module.id, module)

      if (module.sourcedir) {
        sourcedirs.add(module.sourcedir.fsPath)
      }

      if (module.uri) {
        filenames.set(module.uri.fsPath, module.id)
      }

      for (const ancestor of Module.ancestors(module.name)) {
        if (!modules.get(ancestor.id)) {
          modules.set(ancestor.id, ancestor)
        }
      }
    }

    return { get, getByFilePath, getByEditor, getChildren, getParent, getSourceDirs, insert }
  }
}
