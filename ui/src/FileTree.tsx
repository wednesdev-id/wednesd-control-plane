import React, { useState } from 'react'
import {
  FolderIcon,
  
  ChevronRightIcon,
  ChevronDownIcon,
  DocumentIcon,
  DocumentPlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

export type FileNode = {
  type: 'file' | 'folder'
  path: string
  children?: Record<string, FileNode>
}

export function buildTree(files: Record<string, string>): Record<string, FileNode> {
  const tree: Record<string, FileNode> = {}
  Object.keys(files).forEach((filePath) => {
    const parts = filePath.split('/')
    let current = tree
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = { type: 'file', path: filePath }
      } else {
        if (!current[part]) {
          current[part] = {
            type: 'folder',
            path: parts.slice(0, i + 1).join('/'),
            children: {}
          }
        }
        if (!current[part].children) {
          current[part].children = {}
        }
        current = current[part].children!
      }
    }
  })
  return tree
}

interface FileTreeNodeProps {
  name: string
  node: FileNode
  activeFile: string
  setActiveFile: (path: string) => void
  files: Record<string, string>
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>
  level?: number
  onNewFile: (prefix: string) => void
  onContextMenu?: (e: React.MouseEvent, path: string, type: "file" | "folder") => void
}

export function FileTreeNode({
  name,
  node,
  activeFile,
  setActiveFile,
  files,
  setFiles,
  level = 0,
  onNewFile,
  onContextMenu
}: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true)
  const isFile = node.type === 'file'
  const isActive = isFile && activeFile === node.path

  return (
    <div>
      <div
        onClick={() => (isFile ? setActiveFile(node.path) : setIsOpen(!isOpen))}
        onContextMenu={(e) => { if (onContextMenu) onContextMenu(e, node.path, node.type); }}
        className={`group px-3 py-1 flex items-center justify-between cursor-pointer transition-colors ${
          isActive
            ? 'bg-blue-600/15 text-blue-400 font-medium border-l-2 border-blue-500'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${12 + level * 12}px` }}
      >
        <div className="flex items-center gap-1.5 truncate">
          {!isFile && (
            isOpen ? (
              <ChevronDownIcon className="w-3 h-3 shrink-0 opacity-70" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 shrink-0 opacity-70" />
            )
          )}
          {isFile ? (
            <DocumentIcon
              className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}
            />
          ) : (
            <FolderIcon className="w-3.5 h-3.5 shrink-0 text-blue-400" />
          )}
          <span className="truncate">{name}</span>
        </div>

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFile && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(true)
                onNewFile(node.path + '/')
              }}
              className="text-slate-500 hover:text-blue-400 p-0.5"
              title="New File in Folder"
            >
              <DocumentPlusIcon className="w-3 h-3" />
            </button>
          )}
          {isFile && Object.keys(files).length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const newFiles = { ...files }
                delete newFiles[node.path]
                setFiles(newFiles)
                if (activeFile === node.path) {
                  setActiveFile(Object.keys(newFiles)[0] || '')
                }
              }}
              className="text-slate-500 hover:text-red-400 p-0.5 ml-1"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {!isFile && isOpen && node.children && (
        <div>
          {Object.entries(node.children)
            .sort(([aName, aNode], [bName, bNode]) => {
              if (aNode.type !== bNode.type) return aNode.type === 'folder' ? -1 : 1
              return aName.localeCompare(bName)
            })
            .map(([childName, childNode]) => (
              <FileTreeNode
                key={childNode.path || childName}
                name={childName}
                node={childNode}
                activeFile={activeFile}
                setActiveFile={setActiveFile}
                files={files}
                setFiles={setFiles}
                level={level + 1}
                onNewFile={onNewFile}
                onContextMenu={onContextMenu}
              />
            ))}
        </div>
      )}
    </div>
  )
}
