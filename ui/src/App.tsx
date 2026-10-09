import { useState, useEffect, Fragment } from 'react'
import { buildTree, FileTreeNode } from "./FileTree";
import Editor from "@monaco-editor/react";
import { ArrowRightIcon, XCircleIcon, ClockIcon, CommandLineIcon, BookOpenIcon, ShareIcon, Squares2X2Icon, 
  ServerIcon,
  PlayIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  CpuChipIcon,
  FolderIcon, FolderPlusIcon,   DocumentIcon, DocumentPlusIcon,  ArrowUpTrayIcon
 } from '@heroicons/react/24/outline'

interface FunctionItem {
  id: string
  name: string
  lang: 'rust' | 'python' | 'typescript' | 'go'
  version: string
  status: 'active' | 'deploying' | 'idle'
  memoryMb: number
  invocations: number
  p95Ms: number
}

const TEMPLATES: Record<string, string> = {
  rust: `wit_bindgen::generate!({
    world: "function",
    path: "../../wit",
});

use wednes::function::types::Header;
use serde_json::json;

struct MyHandler;

impl Guest for MyHandler {
    fn handle(req: Request) -> Response {
        let mut name = "World".to_string();
        if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&req.body) {
            if let Some(n) = val.get("name").and_then(|v| v.as_str()) {
                name = n.to_string();
            }
        }
            
        let body = serde_json::to_vec(&json!({
            "status": "ok",
            "greeting": format!("Hello, {}!", name),
            "runtime": "wednes-wasmtime-v0.1"
        })).unwrap_or_default();
        
        Response {
            status: 200,
            headers: vec![Header { name: "content-type".to_string(), value: "application/json".to_string() }],
            body,
        }
    }
}

export!(MyHandler);`,

  python: `from typing import Dict, Any\nimport json\n\nclass WitWorld:\n    def handle(self, request: Dict[str, Any]) -> Dict[str, Any]:\n        body_raw = request.get("body", b"")\n        try:\n            payload = json.loads(body_raw.decode("utf-8")) if body_raw else {}\n        except Exception:\n            payload = {}\n            \n        res = {\n            "status": "success",\n            "runtime": "python-componentize",\n            "echo": payload\n        }\n        return {\n            "status": 200,\n            "headers": [["content-type", "application/json"]],\n            "body": json.dumps(res).encode("utf-8")\n        }`,
  typescript: `// Wednes Function TypeScript Component\nexport function handle(req: { method: string; path: string; headers: { name: string; value: string }[]; body?: Uint8Array }) {\n    const text = req.body ? new TextDecoder().decode(req.body) : "{}";\n    let data = {};\n    try { data = JSON.parse(text); } catch (_) {}\n\n    const responsePayload = JSON.stringify({\n        status: "ok",\n        runtime: "wednes-ts-componentize",\n        path: req.path,\n        echo: data\n    });\n\n    return {\n        status: 200,\n        headers: [{ name: "content-type", value: "application/json" }],\n        body: new TextEncoder().encode(responsePayload)\n    };\n}`,
  go: `package main\n\nimport (\n\t"encoding/json"\n\t"active-function/function"\n)\n\ntype MyFunction struct{}\n\nfunc (m MyFunction) Handle(req function.FunctionRequest) function.FunctionResponse {\n\tdata, _ := json.Marshal(map[string]interface{}{\n\t\t"status": "ok",\n\t\t"provider": "wednes-go-tinygo",\n\t\t"path": req.Path,\n\t})\n\treturn function.FunctionResponse{\n\t\tStatus: 200,\n\t\tHeaders: []function.WednesFunction0_1_0_TypesHeader{\n\t\t\t{Name: "content-type", Value: "application/json"},\n\t\t},\n\t\tBody: data,\n\t}\n}\n\nfunc init() {\n\tfunction.SetFunction(MyFunction{})\n}\n\nfunc main() {}`
}


export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('wednes_token'))
  const [authUser, setAuthUser] = useState<string | null>(localStorage.getItem('wednes_user'))
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')

  // Wrapper for authenticated fetch
  const fetchAuth = async (url: string, options: any = {}) => {
    if (!options.headers) options.headers = {}
    const token = localStorage.getItem('wednes_token')
    if (token) options.headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, options)
    if (res.status === 401) {
      setAuthToken(null)
      setAuthUser(null)
      localStorage.removeItem('wednes_token')
      localStorage.removeItem('wednes_user')
      setShowAuthModal(true)
    }
    return res
  }
  
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch(`/api/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      
      setAuthToken(data.token)
      setAuthUser(data.username)
      localStorage.setItem('wednes_token', data.token)
      localStorage.setItem('wednes_user', data.username)
      setShowAuthModal(false)
      setAuthPassword('')
      fetchProjects()
    } catch (err: any) {
      setAuthError(err.message)
    }
  }
  
  const handleLogout = async () => {
    try { await fetchAuth('/api/logout', { method: 'POST' }) } catch (_) {}
    setAuthToken(null)
    setAuthUser(null)
    localStorage.removeItem('wednes_token')
    localStorage.removeItem('wednes_user')
    setCloudProjects([])
    setShowAuthModal(true)
  }
  
  const fetchProjects = () => {
    if (!localStorage.getItem('wednes_token')) {
      setShowAuthModal(true)
      return
    }
    fetchAuth('/api/projects')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCloudProjects(data)
        const current = localStorage.getItem('wednes_current_project');
        if (current && data.some((p: any) => p.name === current)) {
          loadProject(current);
        } else if (data.length === 0) {
          setShowProjectsModal(true)
        }
      })
      .catch(() => {})
  }
  const [cloudProjects, setCloudProjects] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showProjectsModal, setShowProjectsModal] = useState(true)

  // Fetch projects on load
  useEffect(() => {
    fetchProjects()
  }, [authToken])

  const saveAndActivateProject = async (name: string, pLang: any, pFiles: Record<string, string>) => {
    setFunctionName(name);
    setLang(pLang);
    setFiles(pFiles);
    setActiveFile(Object.keys(pFiles)[0] || 'wednes.yaml');
    setShowProjectsModal(false);
    localStorage.setItem('wednes_current_project', name);
    try {
      await fetchAuth('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lang: pLang, files: pFiles })
      });
      fetchProjects();
    } catch(e) {}
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true)
    try {
      const res = await fetchAuth('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: functionName, lang, files })
      })
      if (res.ok) setDeployResult('Project saved to Cloud DB!')
      
      // Refresh list
      const listRes = await fetchAuth('/api/projects')
      const listData = await listRes.json()
      if (Array.isArray(listData)) setCloudProjects(listData)
    } catch (err) {
      setDeployResult('Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  const loadProject = async (name: string) => {
    try {
      const res = await fetchAuth(`/api/projects/${name}`)
      if (res.status === 404) {
        localStorage.removeItem('wednes_current_project')
        return;
      }
      const data = await res.json()
      if (data && data.files) {
        setFunctionName(data.name)
        setLang(data.lang as any)
        setFiles(typeof data.files === 'string' ? JSON.parse(data.files) : data.files)
        setActiveFile(Object.keys(typeof data.files === 'string' ? JSON.parse(data.files) : data.files)[0])
        setShowProjectsModal(false)
        localStorage.setItem('wednes_current_project', data.name)
      }
    } catch (e) { }
  }
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string, type: 'file' | 'folder' } | null>(null)

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder') => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, path, type })
  }

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return
    const { path, type } = contextMenu

    if (action === 'new_file') {
      const prefix = type === 'folder' ? (path ? path + '/' : '') : (path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '')
      setNewFileName(prefix)
      setIsCreatingFile(true)
    } else if (action === 'new_folder') {
      const prefix = type === 'folder' ? (path ? path + '/' : '') : (path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '')
      setNewFileName(prefix + 'new_folder/')
      setIsCreatingFile(true)
    } else if (action === 'delete') {
      if (Object.keys(files).length <= 1) return // Do not allow deleting last file
      const newFiles = { ...files }
      if (type === 'file') {
        delete newFiles[path]
      } else {
        // Delete all files in folder
        Object.keys(newFiles).forEach(f => {
          if (f.startsWith(path + '/')) delete newFiles[f]
        })
      }
      if (Object.keys(newFiles).length === 0) newFiles['untitled'] = '' // Fallback
      setFiles(newFiles)
      if (type === 'file' && activeFile === path) setActiveFile(Object.keys(newFiles)[0])
      if (type === 'folder' && activeFile.startsWith(path + '/')) setActiveFile(Object.keys(newFiles)[0])
    } else if (action === 'rename') {
      const newPath = prompt('Enter new name:', path)
      if (newPath && newPath !== path) {
        const newFiles = { ...files }
        if (type === 'file') {
          newFiles[newPath] = newFiles[path]
          delete newFiles[path]
          if (activeFile === path) setActiveFile(newPath)
        } else {
          // Rename folder
          Object.keys(newFiles).forEach(f => {
            if (f.startsWith(path + '/')) {
              const renamed = newPath + f.substring(path.length)
              newFiles[renamed] = newFiles[f]
              delete newFiles[f]
              if (activeFile === f) setActiveFile(renamed)
            }
          })
        }
        setFiles(newFiles)
      }
    }
    setContextMenu(null)
  }
  const [activeTab, setActiveTab] = useState<'editor' | 'workflows' | 'functions' | 'nodes' | 'docs' | 'billing'>('editor')
  const [lang, setLang] = useState<'rust' | 'python' | 'typescript' | 'go'>('python')
  const [files, setFiles] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState<string>('')
  const [newFileName, setNewFileName] = useState<string>('')
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false)
  const [functionName, setFunctionName] = useState('')
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<any>(null);
  const [workflowPayload, setWorkflowPayload] = useState('{\n  "order_id": "ORD-WSS-777",\n  "amount": 150000\n}');
  const [workflowRunState, setWorkflowRunState] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [workflowTrace, setWorkflowTrace] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'workflows') {
      fetchAuth('/api/workflows').then(r => r.json()).then(data => {
        setWorkflows(data);
        if (data.length > 0) setActiveWorkflow(data[0]);
      }).catch(()=>{})
    }
  }, [activeTab, authToken]);

  const handleRunWorkflow = async () => {
    if (!activeWorkflow) return;
    setWorkflowRunState('running');
    setWorkflowTrace(null);
    try {
      const res = await fetchAuth(`/api/workflows/${activeWorkflow.name}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: workflowPayload
      });
      const data = await res.json();
      setWorkflowTrace(data);
      setWorkflowRunState(data.status === 'success' ? 'success' : 'failed');
    } catch(e) {
      setWorkflowRunState('failed');
    }
  }

  const [githubRepo, setGithubRepo] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [githubBranch, setGithubBranch] = useState('main')
  const [isPushingGithub, setIsPushingGithub] = useState(false)
  const [githubPushStatus, setGithubPushStatus] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<string | null>(null)
  const [testPayload, setTestPayload] = useState('{}')
  const [httpMethod, _setHttpMethod] = useState<'GET' | 'POST'>('GET')
  const [testSubPath, _setTestSubPath] = useState('')
  const [testOutput, setTestOutput] = useState<any>(null)
  const [outputViewMode, setOutputViewMode] = useState<'raw' | 'preview'>('raw')
  const [isExecuting, setIsExecuting] = useState(false)

  const [templates, setTemplates] = useState<any>(null)
  
  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(data => setTemplates(data)).catch(()=>{})
  }, [])
  const [functions, setFunctions] = useState<FunctionItem[]>([])
  
  useEffect(() => {
    if (activeTab === 'functions') {
      fetch('/api/functions')
        .then(r => r.json())
        .then(data => {
          setFunctions(data.map((f:any) => ({
            id: f.id,
            name: f.name,
            lang: 'rust', // derived runtime usually
            version: f.version || '0.1.0',
            status: f.status,
            memoryMb: f.memoryMb || 32,
            invocations: Math.floor(Math.random() * 1000), // To be replaced with metrics DB
            p95Ms: 1.45
          })))
        })
        .catch(()=>{})
    }
  }, [activeTab])

  const handleLangChange = (newLang: 'rust' | 'python' | 'typescript' | 'go') => {
    setLang(newLang)
    let mainFile = 'src/lib.rs'
    if (newLang === 'python') mainFile = 'app.py'
    else if (newLang === 'typescript') mainFile = 'src/index.ts'
    else if (newLang === 'go') mainFile = 'main.go'

    setFiles(prev => ({
      ...prev,
      [mainFile]: TEMPLATES[newLang]
    }))
    setActiveFile(mainFile)
  }

  const handleCreateNewFile = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newFileName.trim()
    if (!trimmed) {
      setIsCreatingFile(false)
      return
    }
    if (!files[trimmed]) {
      setFiles(prev => ({
        ...prev,
        [trimmed]: ''
      }))
    }
    setActiveFile(trimmed)
    setNewFileName('')
    setIsCreatingFile(false)
  }

  const handlePushGithub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!githubRepo || !githubToken) return
    setIsPushingGithub(true)
    setGithubPushStatus(null)

    try {
      // 1. Save current files first
      await fetchAuth(`/api/projects/${functionName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, lang })
      })

      // 2. Trigger push to user's github repo
      const res = await fetch(`/api/projects/${functionName}/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: githubRepo,
          token: githubToken,
          branch: githubBranch || 'main',
          commit_message: `Deploy ${functionName} from Wednes Engine Control Plane`
        })
      })

      const data = await res.json()
      if (res.ok) {
        setGithubPushStatus(`Successfully pushed to https://github.com/${githubRepo}`)
        setTimeout(() => setShowGithubModal(false), 2000)
      } else {
        setGithubPushStatus(`Error: ${data.details || data.error}`)
      }
    } catch (err: any) {
      setGithubPushStatus(`Push failed: ${err.message}`)
    } finally {
      setIsPushingGithub(false)
    }
  }

  const _handleDeleteFile = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const fileList = Object.keys(files)
    if (fileList.length <= 1) return // Do not allow deleting last file
    const newFiles = { ...files }
    delete newFiles[fileName]
    setFiles(newFiles)
    if (activeFile === fileName) {
      setActiveFile(Object.keys(newFiles)[0])
    }
  }

  const handleDeploy = async () => {
    void _handleDeleteFile; setIsDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetchAuth(`/api/deploy/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, lang, release: true })
      });
      const data = await res.text();
      setDeployResult(data);
    } catch (e: any) {
      setDeployResult("Deploy failed: " + e.message);
    } finally {
      setIsDeploying(false);
    }
  }

  const handleRunTest = async () => {
    setIsExecuting(true);
    setTestOutput(null);
    try {
      // Auto-save to cloud
      fetchAuth('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: functionName, lang, files })
      }).catch(() => {});

      // Auto-compile in background before running (development mode)
      await fetchAuth(`/api/deploy/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, lang, release: false })
      });
      
      let bodyData = null;
      try {
        bodyData = JSON.parse(testPayload);
      } catch (e) {
        bodyData = testPayload;
      }
      
      const runUrl = testSubPath ? `/api/run/${functionName}${testSubPath.startsWith('/') ? testSubPath : '/' + testSubPath}` : `/api/run/${functionName}`;
      const res = await fetch(runUrl, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: httpMethod === 'GET' ? undefined : (typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData || {}))
      });
      
      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        data = {
          status: res.status,
          latency_us: 0,
          headers: { 'content-type': res.headers.get('content-type') || 'text/html' },
          output: rawText
        };
      }

      const finalBody = data.output !== undefined ? data.output : data;
      const isHtml = typeof finalBody === 'string' && (finalBody.trim().startsWith('<') || (data.headers && String(data.headers['content-type'] || '').includes('html')));
      
      if (isHtml) setOutputViewMode('preview');
      else setOutputViewMode('raw');

      setTestOutput({
        status: data.status || res.status,
        latency_us: data.latency_us || 0,
        memory_used_kb: data.memory_used_kb || 0,
        headers: data.headers || {},
        body: finalBody
      });
    } catch (e: any) {
      setTestOutput({
        status: 500,
        latency_us: 0,
        memory_used_kb: 0,
        headers: {},
        body: { error: e.message }
      });
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d1117] text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-[#161b22] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand */}
          <div className="h-14 flex items-center px-4 border-b border-slate-800 gap-3">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs tracking-wider">
              W
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-white">WEDNES ENGINE</div>
              <div className="text-[10px] text-slate-400 font-mono">CONTROL PLANE V1.0</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('editor')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === 'editor' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CommandLineIcon className="w-4 h-4" />
              <span>Web IDE (Workspace)</span>
            </button>
            <button
              onClick={() => setActiveTab('workflows')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === 'workflows' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ShareIcon className="w-4 h-4" />
              <span>Workflows (DAG)</span>
            </button>
            <button
              onClick={() => setActiveTab('functions')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === 'functions' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CpuChipIcon className="w-4 h-4" />
              <span>Registered Functions</span>
            </button>
            <button
              onClick={() => setActiveTab('nodes')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === 'nodes' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ServerIcon className="w-4 h-4" />
              <span>Worker Nodes & Fabric</span>
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === 'docs' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BookOpenIcon className="w-4 h-4" />
              <span>Docs & Architecture</span>
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeTab === 'billing' ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CreditCardIcon className="w-4 h-4" />
              <span>Quota & Billing</span>
            </button>
          </nav>
        </div>

        {/* Worker Node Health Info */}
        <div className="p-3 border-t border-slate-800 bg-[#0d1117]/60">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 font-mono">PRIMARY WORKER</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">192.168.122.10:8080</div>
          <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
            <span>RSS: 20.3 MiB</span>
            <span>Uptime: 99.98%</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-[#161b22]/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Environment:</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold">
              KVM-CLUSTER // PROD-ID-1
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              {authUser ? (
                <Fragment>User: <span className="text-white font-medium">{authUser}</span> <button onClick={handleLogout} className="px-1.5 py-0.5 ml-2 bg-slate-800 hover:bg-red-900 rounded border border-slate-700 text-[10px]">LOGOUT</button></Fragment>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold">LOGIN</button>
              )}
            </div>
            <div className="w-px h-4 bg-slate-700"></div>
            <div className="text-xs text-slate-400 font-mono">Engine: <span className="text-blue-400">v0.1.0-alpha (Wasmtime 25)</span></div>
          </div>
        </header>

        {/* Tab 1: IDE & Playground */}
        {activeTab === 'editor' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Editor Control Ribbon */}
            <div className="h-12 border-b border-slate-800 px-6 flex items-center justify-between bg-[#161b22] shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Function:</span>
                  <input
                    type="text"
                    value={functionName}
                    onChange={(e) => setFunctionName(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
                <div className="h-4 w-px bg-slate-700"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-slate-400 mr-1">Runtime:</span>
                  {(['rust', 'python', 'typescript', 'go'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => handleLangChange(item)}
                      className={`text-xs px-2.5 py-1 rounded font-mono uppercase transition-colors ${
                        lang === item
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowProjectsModal(true)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded text-xs font-medium transition-colors"
                >
                  <FolderIcon className="w-3.5 h-3.5 text-slate-300" />
                  <span>My Projects</span>
                </button>
                <button
                  onClick={handleSaveToCloud}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded text-xs font-medium transition-colors"
                >
                  {isSaving ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <DocumentIcon className="w-3.5 h-3.5 text-slate-300" />}
                  <span>Save to Cloud</span>
                </button>
                <button
                  onClick={() => setShowGithubModal(true)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded text-xs font-medium transition-colors"
                  title="Push source files to your personal GitHub repository"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5 text-slate-300" />
                  <span>Push to GitHub</span>
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded text-xs font-medium transition-all shadow-sm shadow-blue-900/20"
                >
                  {isDeploying ? (
                    <Fragment>
                      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>Compiling to WASM...</span>
                    </Fragment>
                  ) : (
                    <Fragment>
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Deploy to Node</span>
                    </Fragment>
                  )}
                </button>
              </div>
            </div>

            {/* Notification alert on deploy */}
            {deployResult && (
              <div className="bg-emerald-950/40 border-b border-emerald-800/50 px-6 py-2 flex items-center justify-between text-xs text-emerald-300 font-mono">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{deployResult}</span>
                </div>
                <button onClick={() => setDeployResult(null)} className="text-emerald-500 hover:text-white">✕</button>
              </div>
            )}

            {/* Workspace Split: File Explorer, Editor & Test Console */}
            <div className="flex-1 flex min-h-0">
              {/* VS Code File Explorer Sidebar */}
              <div className="w-56 border-r border-slate-800 bg-[#161b22]/80 flex flex-col shrink-0">
                <div className="h-8 border-b border-slate-800 px-3 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="font-semibold uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Squares2X2Icon className="w-3.5 h-3.5 text-blue-400" />
                    Workspace
                  </span>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => { setNewFileName(""); setIsCreatingFile(true); }}
                      title="New File"
                      className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white transition-colors"
                    >
                      <DocumentPlusIcon className="w-3.5 h-3.5 text-slate-300 hover:text-blue-400" />
                    </button>
                    <button
                      onClick={() => { setNewFileName("folder/"); setIsCreatingFile(true); }}
                      title="New Folder"
                      className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-white transition-colors"
                    >
                      <FolderPlusIcon className="w-3.5 h-3.5 text-slate-300 hover:text-blue-400" />
                    </button>
                  </div>
                </div>

                {/* File Creation Input */}
                {isCreatingFile && (
                  <form onSubmit={handleCreateNewFile} className="p-2 border-b border-slate-800 bg-slate-900/60 flex items-center gap-1.5">
                    {newFileName.endsWith("/") ? <FolderPlusIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <DocumentPlusIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    <input
                      type="text"
                      autoFocus
                      placeholder="path/to/file.ext"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      onBlur={() => handleCreateNewFile()}
                      className="w-full bg-slate-950 border border-blue-500/50 rounded px-1.5 py-0.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </form>
                )}

                                {/* File Tree */}
                <div 
                  className="flex-1 overflow-y-auto py-1 space-y-0.5 font-mono text-xs"
                  onContextMenu={(e) => handleContextMenu(e, "", "folder")}
                >
                  {Object.entries(buildTree(files))
                    .sort(([aName, aNode]: any, [bName, bNode]: any) => {
                      if (aNode.type !== bNode.type) return aNode.type === "folder" ? -1 : 1;
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
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 border-r border-slate-800 flex flex-col min-w-0 bg-[#0d1117]">
                <div className="h-8 bg-[#161b22]/70 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-2">
                    <DocumentIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-white font-medium">{activeFile}</span>
                  </div>
                  <span>ABI: wednes:function@0.1.0</span>
                </div>
                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    language={
                      activeFile.endsWith('.rs') ? 'rust' :
                      activeFile.endsWith('.py') ? 'python' :
                      activeFile.endsWith('.go') ? 'go' :
                      activeFile.endsWith('.ts') ? 'typescript' :
                      activeFile.endsWith('.js') ? 'javascript' :
                      activeFile.endsWith('.json') ? 'json' :
                      activeFile.endsWith('.yaml') || activeFile.endsWith('.yml') ? 'yaml' :
                      activeFile.endsWith('.md') ? 'markdown' : 'plaintext'
                    }
                    theme="vs-dark"
                    value={files[activeFile] || ''}
                    onChange={(val) => {
                      setFiles(prev => ({
                        ...prev,
                        [activeFile]: val || ''
                      }))
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      padding: { top: 12 }
                    }}
                  />
                </div>
              </div>

              {/* Right: Test Invocation & Output */}
              <div className="w-96 flex flex-col bg-[#161b22]/30 shrink-0">
                <div className="h-8 bg-[#161b22]/70 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Simulate Invocation</span>
                  <span className="text-emerald-400">POST /fn/{functionName}</span>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase">Request Payload (JSON)</label>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      rows={6}
                      className="w-full bg-[#0d1117] border border-slate-700 rounded p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleRunTest}
                    disabled={isExecuting}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded text-xs font-mono flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                  >
                    {isExecuting ? (
                      <Fragment>
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Invoking WASM Sandbox...</span>
                      </Fragment>
                    ) : (
                      <Fragment>
                        <PlayIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Execute Function</span>
                      </Fragment>
                    )}
                  </button>

                  {/* Output Display */}
                  {testOutput && (
                    <div className="flex-1 flex flex-col min-h-0 border border-slate-800 rounded bg-[#0d1117] overflow-hidden">
                      <div className="bg-slate-900/80 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${testOutput.status >= 200 && testOutput.status < 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            STATUS {testOutput.status}
                          </span>
                          <div className="flex bg-slate-800 rounded p-0.5 ml-2">
                            <button 
                              onClick={() => setOutputViewMode('raw')}
                              className={`px-2 py-0.5 rounded text-[10px] ${outputViewMode === 'raw' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                              Raw / JSON
                            </button>
                            <button 
                              onClick={() => setOutputViewMode('preview')}
                              className={`px-2 py-0.5 rounded text-[10px] ${outputViewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                              HTML Preview
                            </button>
                          </div>
                        </div>
                        <span className="text-slate-400">{testOutput.latency_us} µs</span>
                      </div>
                      <div className={`text-[11px] font-mono overflow-auto flex-1 ${outputViewMode === 'preview' ? 'bg-white' : 'p-3 text-slate-300'}`}>
                        {outputViewMode === 'preview' ? (
                          <iframe 
                            srcDoc={typeof testOutput.body === 'string' ? testOutput.body : JSON.stringify(testOutput.body, null, 2)}
                            className="w-full h-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                            title="HTML Preview"
                          />
                        ) : (
                          <pre>{typeof testOutput.body === 'string' ? testOutput.body : JSON.stringify(testOutput.body, null, 2)}</pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Workflows */}
        {activeTab === 'workflows' && (
          <div className="flex h-full">
            {/* Left Sidebar: Workflows List */}
            <div className="w-64 border-r border-slate-800 bg-[#0d1117]/80 flex flex-col">
              <div className="p-3 border-b border-slate-800">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Deployed DAGs</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {workflows.map(wf => (
                  <button 
                    key={wf.id}
                    onClick={() => { setActiveWorkflow(wf); setWorkflowTrace(null); setWorkflowRunState('idle'); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${activeWorkflow?.id === wf.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-300 hover:bg-slate-800/50'}`}
                  >
                    <ShareIcon className="w-4 h-4" />
                    <span className="truncate">{wf.name}</span>
                  </button>
                ))}
                {workflows.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-500">No workflows deployed.</div>
                )}
              </div>
            </div>

            {/* Right Pane: Execution Engine */}
            <div className="flex-1 overflow-y-auto bg-[#0d1117]">
              {activeWorkflow ? (
                <div className="p-6 max-w-5xl mx-auto space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{activeWorkflow.name}</h1>
                    <p className="text-sm text-slate-400">{activeWorkflow.description}</p>
                  </div>

                  {/* DAG Visualizer */}
                  <div className="bg-slate-900/50 border border-slate-700/60 rounded-xl p-8 overflow-x-auto">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-6 flex items-center gap-2">
                      <ShareIcon className="w-4 h-4" />
                      Execution Graph (DAG)
                    </h3>
                    <div className="flex items-center gap-4 min-w-max">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400">
                          <PlayIcon className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-slate-500 mt-2 font-mono">trigger</span>
                      </div>
                      <ArrowRightIcon className="w-5 h-5 text-slate-600" />
                      
                      {activeWorkflow.steps?.map((step: any, idx: number) => (
                        <Fragment key={step.id}>
                          <div className="flex flex-col items-center group relative">
                            <div className={`w-40 p-3 rounded-lg border ${workflowTrace?.trace?.find((t:any) => t.id === step.id)?.status === 'success' ? 'border-emerald-500/50 bg-emerald-900/10' : workflowTrace?.trace?.find((t:any) => t.id === step.id)?.status === 'failed' ? 'border-red-500/50 bg-red-900/10' : 'border-blue-500/30 bg-slate-800'}`}>
                              <h4 className="text-sm font-semibold text-white truncate text-center" title={step.name}>{step.name}</h4>
                              <p className="text-[10px] text-slate-400 text-center font-mono mt-1 truncate" title={step.function}>{step.function}</p>
                              
                              {/* Overlay trace latency if available */}
                              {workflowTrace?.trace?.find((t:any) => t.id === step.id) && (
                                <div className="absolute -top-3 -right-3">
                                  {workflowTrace.trace.find((t:any) => t.id === step.id).status === 'success' ? (
                                    <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 shadow-lg backdrop-blur-sm">
                                      <CheckCircleIcon className="w-3 h-3" />
                                      {workflowTrace.trace.find((t:any) => t.id === step.id).latency_ms}ms
                                    </div>
                                  ) : (
                                    <div className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-1 shadow-lg backdrop-blur-sm">
                                      <XCircleIcon className="w-3 h-3" />
                                      Failed
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 mt-2 font-mono bg-slate-900 px-1.5 py-0.5 rounded">{step.path || '/'}</span>
                          </div>
                          
                          {idx < activeWorkflow.steps.length - 1 && (
                            <ArrowRightIcon className="w-5 h-5 text-blue-500/50" />
                          )}
                        </Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Input Engine */}
                    <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-900/30 flex flex-col">
                      <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-300 tracking-wider">PAYLOAD INPUT</span>
                      </div>
                      <textarea 
                        className="w-full h-48 bg-transparent p-4 text-sm font-mono text-emerald-400 focus:outline-none resize-none"
                        value={workflowPayload}
                        onChange={(e) => setWorkflowPayload(e.target.value)}
                        spellCheck="false"
                      />
                      <div className="p-3 border-t border-slate-700/60 bg-slate-800/50 flex justify-between items-center">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><ClockIcon className="w-4 h-4" /> p95 1.5ms per node</span>
                        <button 
                          onClick={handleRunWorkflow}
                          disabled={workflowRunState === 'running'}
                          className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all shadow-lg ${workflowRunState === 'running' ? 'bg-slate-600 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'}`}
                        >
                          <PlayIcon className="w-4 h-4" />
                          {workflowRunState === 'running' ? 'Executing DAG...' : 'Run Workflow'}
                        </button>
                      </div>
                    </div>

                    {/* Output Trace Logs */}
                    <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-900/30 flex flex-col">
                      <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-300 tracking-wider">EXECUTION TRACE</span>
                        {workflowTrace && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${workflowTrace.status === 'success' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'}`}>
                            {workflowTrace.status.toUpperCase()} ({workflowTrace.total_duration_ms} ms)
                          </span>
                        )}
                      </div>
                      <div className="p-4 h-full overflow-y-auto bg-[#0a0c10] font-mono text-xs">
                        {workflowRunState === 'running' && (
                          <div className="text-slate-500 animate-pulse">Running functions across Wednes Fabric...</div>
                        )}
                        {!workflowTrace && workflowRunState !== 'running' && (
                          <div className="text-slate-600 flex items-center justify-center h-full">Waiting for execution...</div>
                        )}
                        {workflowTrace && (
                          <div className="space-y-4">
                            {workflowTrace.trace.map((t: any) => (
                              <div key={t.id} className="border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-blue-400 font-semibold">{t.id}</span>
                                  <span className="text-slate-500">{t.latency_ms} ms</span>
                                </div>
                                <div className="text-slate-400 mb-1">In: <span className="text-emerald-300">{JSON.stringify(t.input)}</span></div>
                                <div className="text-slate-400">Out: <span className="text-amber-300">{JSON.stringify(t.output)}</span></div>
                              </div>
                            ))}
                            {workflowTrace.status === 'success' && (
                              <div className="mt-4 pt-4 border-t border-dashed border-slate-700 text-purple-400 font-bold flex items-center justify-between">
                                <span>FINAL OUTPUT:</span>
                                <span className="text-right text-[10px] bg-purple-900/20 px-2 py-1 rounded">Return to Client</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-slate-500">
                    <ShareIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Select a workflow to view and execute its DAG.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Tab: Docs & Architecture */}
        {activeTab === 'docs' && (
          <div className="p-6 overflow-y-auto text-slate-300">
            <div className="max-w-4xl mx-auto space-y-10">
              <section>
                <h1 className="text-2xl font-bold text-white mb-3">Wednes Serverless Services (WSS)</h1>
                <p className="text-lg text-slate-400 mb-6">
                  WSS mengubah *existing hardware*—server Xeon tua, PC kantor Core i5, Mini PC gudang, maupun gateway ARM64 Edge—menjadi satu buah **Programmable Compute Fabric**.
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-emerald-400 text-xl font-bold mb-1"><span className="text-sm text-slate-400 font-normal block">Cold Start (p95)</span> 5.66 ms</div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-blue-400 text-xl font-bold mb-1"><span className="text-sm text-slate-400 font-normal block">Warm Execution (p95)</span> 1.47 ms</div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-purple-400 text-xl font-bold mb-1"><span className="text-sm text-slate-400 font-normal block">Idle Memory RSS</span> 20.33 MiB</div>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none text-sm leading-relaxed space-y-4">
                  <p>
                    WSS dirancang bukan sebagai peniru AWS Lambda, melainkan sebagai **Brownfield Infrastructure Orchestrator**. Alih-alih merancang klaster secara manual atau memindahkan seluruh data mentah Anda ke cloud pusat, Anda cukup mendefinisikan sebuah fungsi dan mendelegasikan aturan kebijakan datanya (*Data Locality / Replication Policy*). **Orchestrator Wednes yang akan memindahkan fungsi komputasi WASM ke server di mana data tersebut berada (Move Compute to Data).**
                  </p>
                  
                  <h3 className="text-white font-semibold text-lg mt-6">Execution Lifecycle</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-400">
                    <li><strong className="text-slate-300">wednes.yaml (Manifest):</strong> Mendefinisikan memori ketat (<code>memory_mb: 64</code>) dan aturan timeout yang mengunci Wasmtime sandbox dari memori bocor (*memory leak*) atau *infinite loop* (via Epoch Interruption Trap).</li>
                    <li><strong className="text-slate-300">Wasmtime Component Model:</strong> Fungsi dibangun mengikuti ABI <code>wednes:function@0.1.0</code>, menjamin keamanan eksekusi <em>zero-trust</em> antar penyewa dan di atas multi-node.</li>
                    <li><strong className="text-slate-300">wednesd (Runtime Daemon):</strong> Menyimpan cache prakompilasi (*Cranelift JIT*) di setiap <em>worker node</em> yang siap dipanggil kapan saja tanpa *container orchestration* bertele-tele.</li>
                  </ul>
                  
                  <h3 className="text-white font-semibold text-lg mt-6">Framework Adapter Patterns</h3>
                  <p>Wednes menyediakan *Boilerplate Scaffolding* bagi developer agar bisa menggunakan pola desain framework yang sudah sangat lazim di industri web, tanpa pusing mempelajari antarmuka perakitan WASM:</p>
                  <ul className="list-disc pl-5 space-y-2 text-slate-400">
                    <li><strong className="text-blue-300">Python FastAPI Pattern:</strong> <code>@app.get()</code> dan auto-JSON load pada Python (via <a href="https://github.com/bytecodealliance/componentize-py" className="text-blue-500" target="_blank">componentize-py</a>). Konsep persis Mangum AWS.</li>
                    <li><strong className="text-yellow-300">TypeScript Express Pattern:</strong> Routing modular <code>app.post()</code>, <code>req.body</code>, dan <code>res.json()</code> di TS.</li>
                    <li><strong className="text-cyan-400">Go Fiber Pattern:</strong> Context struct (<code>c.JSON</code>, <code>c.BodyParser</code>) menggunakan compiler TinyGo dan WASI preview-1 adapter.</li>
                    <li><strong className="text-orange-400">Rust Axum Pattern:</strong> Micro-routing berbasis <code>match (method, path)</code> ultra-cepat (latency eksekusi instan) dipadukan dengan <code>serde_json</code> payload validator.</li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Tab 2: Registered Functions */}
        {activeTab === 'functions' && (
          <div className="p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-base font-semibold text-white">Registered Functions</h1>
                <p className="text-xs text-slate-400 mt-1">Functions deployed to Wasmtime execution nodes.</p>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#161b22]/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#161b22] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Function Name</th>
                    <th className="px-4 py-3 font-medium">Language</th>
                    <th className="px-4 py-3 font-medium">Version</th>
                    <th className="px-4 py-3 font-medium">Memory</th>
                    <th className="px-4 py-3 font-medium">Invocations</th>
                    <th className="px-4 py-3 font-medium">P95 Latency</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {functions.map((fn) => (
                    <tr key={fn.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-white">{fn.name}</td>
                      <td className="px-4 py-3 uppercase text-slate-400">{fn.lang}</td>
                      <td className="px-4 py-3 text-slate-400">{fn.version}</td>
                      <td className="px-4 py-3 text-slate-300">{fn.memoryMb} MB</td>
                      <td className="px-4 py-3 text-slate-300">{fn.invocations.toLocaleString()}</td>
                      <td className="px-4 py-3 text-emerald-400">{fn.p95Ms} ms</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {fn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Worker Nodes */}
        {activeTab === 'nodes' && (
          <div className="p-6 overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-base font-semibold text-white">Execution Worker Nodes</h1>
              <p className="text-xs text-slate-400 mt-1">Lightweight native Linux nodes running wednesd daemon.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-800 rounded-lg p-5 bg-[#161b22]/40">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ServerIcon className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-white text-sm">node-kvm-primary</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">HEALTHY</span>
                </div>
                <div className="space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                    <span className="text-slate-500">IP Address:</span>
                    <span>192.168.122.10:8080</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                    <span className="text-slate-500">Daemon RSS:</span>
                    <span className="text-emerald-400">20.33 MiB (Target &lt; 150 MiB)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-1.5">
                    <span className="text-slate-500">Wasmtime Engine:</span>
                    <span>v25.0.0 (Native)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active WASM Sandboxes:</span>
                    <span>4 / 50</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800/60 rounded-lg p-5 bg-[#161b22]/20 border-dashed flex flex-col items-center justify-center text-center">
                <ServerIcon className="w-8 h-8 text-slate-600 mb-2" />
                <div className="text-xs font-medium text-slate-400">Join New Enterprise Node</div>
                <div className="text-[11px] font-mono text-slate-500 mt-1 max-w-xs">
                  Run: wednesd agent --controller https://cp.wednes.id --token &lt;KEY&gt;
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Billing & Quota */}
        {activeTab === 'billing' && (
          <div className="p-6 overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-base font-semibold text-white">Usage & Quotas</h1>
              <p className="text-xs text-slate-400 mt-1">Multi-tenant serverless resource consumption and invoicing.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border border-slate-800 rounded-lg p-4 bg-[#161b22]/40 font-mono">
                <div className="text-[11px] text-slate-400 uppercase">Monthly Invocations</div>
                <div className="text-xl font-bold text-white mt-2">1,462,960</div>
                <div className="text-[10px] text-emerald-400 mt-1">Quota: 10,000,000 / mo</div>
              </div>
              <div className="border border-slate-800 rounded-lg p-4 bg-[#161b22]/40 font-mono">
                <div className="text-[11px] text-slate-400 uppercase">GB-Seconds Consumed</div>
                <div className="text-xl font-bold text-white mt-2">18,420</div>
                <div className="text-[10px] text-slate-400 mt-1">Billed at Rp 0.28 / GB-s</div>
              </div>
              <div className="border border-slate-800 rounded-lg p-4 bg-[#161b22]/40 font-mono">
                <div className="text-[11px] text-slate-400 uppercase">Active Dedicated Nodes</div>
                <div className="text-xl font-bold text-blue-400 mt-2">1 Node (KVM)</div>
                <div className="text-[10px] text-slate-400 mt-1">Enterprise Plan</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* GitHub Sync Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-slate-800 rounded-lg max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-slate-800 text-slate-200">
                  <ArrowUpTrayIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Push to GitHub</h3>
                  <p className="text-[11px] text-slate-400">Sync function files to your personal GitHub repo</p>
                </div>
              </div>
              <button
                onClick={() => setShowGithubModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePushGithub} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GitHub Repository (username/repo)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. username/my-serverless-fn"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Branch
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  required
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Requires repo write scope. Never stored on disk.
                </p>
              </div>

              {githubPushStatus && (
                <div className={`p-2.5 rounded text-xs font-mono ${
                  githubPushStatus.startsWith('Successfully')
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
                    : 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
                }`}>
                  {githubPushStatus}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGithubModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPushingGithub}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-medium transition-colors"
                >
                  {isPushingGithub ? (
                    <Fragment>
                      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>Pushing to GitHub...</span>
                    </Fragment>
                  ) : (
                    <Fragment>
                      <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                      <span>Push Commits</span>
                    </Fragment>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 w-48 bg-slate-800 border border-slate-700 shadow-xl rounded-md py-1 text-sm font-sans text-slate-300"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-xs text-slate-500 font-mono border-b border-slate-700/50 mb-1 truncate">
            {contextMenu.path || "/"}
          </div>
          <button 
            className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors"
            onClick={() => handleContextMenuAction("new_file")}
          >
            New File...
          </button>
          <button 
            className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors"
            onClick={() => handleContextMenuAction("new_folder")}
          >
            New Folder...
          </button>
          <div className="my-1 border-t border-slate-700/50"></div>
          <button 
            className="w-full text-left px-4 py-1.5 hover:bg-blue-600 hover:text-white transition-colors"
            onClick={() => handleContextMenuAction("rename")}
          >
            Rename
          </button>
          <button 
            className="w-full text-left px-4 py-1.5 hover:bg-red-600 hover:text-white transition-colors"
            onClick={() => handleContextMenuAction("delete")}
          >
            Delete
          </button>
        </div>
      )}
      {/* Projects Modal */}
      {showProjectsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0d1117]">
              <div>
                <h2 className="text-lg font-semibold text-white">Cloud Projects</h2>
                <p className="text-xs text-slate-400 mt-1">Load an existing project or create a new one.</p>
              </div>
              {cloudProjects.length > 0 && (
                <button onClick={() => setShowProjectsModal(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
              )}
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {cloudProjects.length === 0 ? (
                <div className="text-center py-10">
                  <FolderIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">No Projects Found</h3>
                  <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">You don't have any projects saved in the Cloud DB yet. Let's create your first Serverless Function!</p>
                  
                  <div className="w-full text-left space-y-4">
                    {templates && Object.keys(templates).map(k => (
                      <div key={k} className="border border-slate-700 bg-slate-800/30 hover:bg-slate-800 hover:border-blue-500 transition-colors p-4 rounded-lg flex items-center justify-between cursor-pointer"
                        onClick={() => {
                          saveAndActivateProject(`my-${k}-app`, templates[k].lang, templates[k].files);
                        }}
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-medium text-sm">{templates[k].name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/50">{templates[k].badge}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{templates[k].desc}</p>
                        </div>
                        <div className="shrink-0">
                          <span className="text-xs font-mono bg-slate-900 text-slate-400 px-2 py-1 rounded uppercase border border-slate-700">{templates[k].lang}</span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="my-6 border-t border-slate-700/50 flex justify-center">
                      <span className="bg-[#161b22] px-4 text-xs font-mono text-slate-500 -mt-2">OR START BLANK</span>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={functionName} 
                        onChange={(e) => setFunctionName(e.target.value)}
                        placeholder="my-blank-workspace"
                        className="flex-1 bg-[#0d1117] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                      <select 
                        value={lang} 
                        onChange={(e) => handleLangChange(e.target.value as any)}
                        className="bg-[#0d1117] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 uppercase font-mono text-xs"
                      >
                        <option value="rust">RUST</option>
                        <option value="python">PYTHON</option>
                        <option value="typescript">TYPESCRIPT</option>
                        <option value="go">GO</option>
                      </select>
                      <button 
                        onClick={() => {
                          const projName = functionName.trim() || 'my-blank-workspace';
                          setFunctionName(projName);
                          
                          const handlerMap: any = {
                            rust: 'src/lib.rs',
                            python: 'app.py',
                            typescript: 'src/index.ts',
                            go: 'main.go'
                          };
                          const handler = handlerMap[lang] || 'src/lib.rs';
                          
                          const defaultYaml = `version: "1.0"\nname: "${projName}"\nruntime:\n  memory_mb: 64\n  timeout_ms: 5000\nfunctions:\n  main:\n    handler: "${handler}"\n    route: "/"\n`;
                          
                          const newFiles: any = {
                            'wednes.yaml': defaultYaml
                          };
                          
                          if (lang === 'rust') {
                            newFiles['Cargo.toml'] = `[package]\nname = "${projName}"\nversion = "0.1.0"\nedition = "2021"\n\n[lib]\ncrate-type = ["cdylib"]\n\n[dependencies]\nwit-bindgen = "0.32"\nserde_json = "1.0"`;
                            newFiles['src/lib.rs'] = TEMPLATES.rust || '';
                          } else if (lang === 'python') {
                            newFiles['app.py'] = TEMPLATES.python || '';
                          } else if (lang === 'typescript') {
                            newFiles['src/index.ts'] = TEMPLATES.typescript || 'export function handle(req: any) {\n  return { status: 200, headers: [], body: new TextEncoder().encode(\"{\\\"hello\\\": \\\"world\\\"}\") };\n}';
                          } else {
                            newFiles['main.go'] = TEMPLATES.go || 'package main\n\nfunc main() {}';
                          }
                          
                          saveAndActivateProject(projName, lang, newFiles);
                        }}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm transition-all"
                      >
                        Create Blank
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Create New Card */}
                  <div 
                    onClick={() => {
                      saveAndActivateProject('new-project', 'python', {
                        'wednes.yaml': `version: "1.0"\nname: "new-project"\nruntime:\n  memory_mb: 64\n  timeout_ms: 5000\nfunctions:\n  main:\n    handler: "app.py"\n    route: "/"\n`,
                        'app.py': TEMPLATES.python || ''
                      });
                    }}
                    className="border border-dashed border-slate-700 rounded-lg p-5 flex flex-col items-center justify-center text-slate-400 hover:text-white hover:border-blue-500 hover:bg-blue-900/10 cursor-pointer transition-all h-32"
                  >
                    <DocumentPlusIcon className="w-6 h-6 mb-2" />
                    <span className="font-medium text-sm">Create New Project</span>
                  </div>
                  
                  {/* Existing Projects */}
                  {cloudProjects.map(proj => (
                    <div 
                      key={proj.id}
                      onClick={() => loadProject(proj.name)}
                      className="border border-slate-700 bg-slate-800/30 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:bg-slate-800 transition-all h-32 flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium text-sm truncate">{proj.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 uppercase border border-slate-700">{proj.lang}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-auto">
                        Last updated: {new Date(proj.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0d1117] border border-slate-700 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6">
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-900/30 flex items-center justify-center border border-blue-500/30">
                <CommandLineIcon className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-white text-center mb-1">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-xs text-slate-400 text-center mb-6">
              {authMode === 'login' ? 'Login to access your Cloud Projects' : 'Register to save projects to Cloud DB'}
            </p>
            
            {authError && (
              <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2 rounded text-xs font-mono mb-4 text-center">
                {authError}
              </div>
            )}
            
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Username</label>
                <input 
                  type="text" 
                  value={authUsername}
                  onChange={e => setAuthUsername(e.target.value)}
                  className="bg-[#161b22] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Password</label>
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="bg-[#161b22] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full"
                  required
                />
              </div>
              <button 
                type="submit"
                className="mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded transition-all"
              >
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
            
            <div className="mt-6 text-center text-xs text-slate-500">
              {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                className="ml-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                {authMode === 'login' ? 'Register here' : 'Login here'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}