import re

with open("App.tsx", "r") as f:
    content = f.read()

# Replace the File List section
old_pattern = r"\{/\* File List \*/\}.*?(?=\s*</div\s*>\s*</div\s*>\s*\{/\* Editor Container \*/\})"

new_tree = """{/* File Tree */}
                <div className="flex-1 overflow-y-auto py-1 space-y-0.5 font-mono text-xs">
                  {Object.entries(buildTree(files))
                    .sort(([aName, aNode]: any, [bName, bNode]: any) => {
                      if (aNode.type !== bNode.type) return aNode.type === folder ? -1 : 1;
                      return aName.localeCompare(bName);
                    })
                    .map(([childName, childNode]: any) => (
                    <FileTreeNode
                      key={childNode.path || childName}
                      name={childName}
                      node={childNode}
                      activeFile={activeFile}
                      setActiveFile={setActiveFile}
                      files={files}
                      setFiles={setFiles}
                      onNewFile={(prefix: string) => {
                        setNewFileName(prefix);
                        setIsCreatingFile(true);
                      }}
                    />
                  ))}
                </div>"""

# Ensure we do a proper regex sub
content = re.sub(r"\{\/\* File List \*\/\}.*?\}\)\}\s*<\/div>", new_tree, content, flags=re.DOTALL)

with open("App.tsx", "w") as f:
    f.write(content)
