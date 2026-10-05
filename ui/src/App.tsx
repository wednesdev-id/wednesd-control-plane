import { useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  CommandLineIcon,
  ServerIcon,
  PlayIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  CpuChipIcon
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
  rust: `use wednes_sdk::{export, Guest, Request, Response};\n\nstruct MyHandler;\n\nimpl Guest for MyHandler {\n    fn handle(req: Request) -> Response {\n        let name = req.json::<serde_json::Value>()\n            .ok()\n            .and_then(|v| v.get("name")?.as_str().map(String::from))\n            .unwrap_or_else(|| "World".to_string());\n            \n        Response::json(&serde_json::json!({\n            "status": "ok",\n            "greeting": format!("Hello, {}!", name),\n            "runtime": "wednes-wasmtime-v0.1"\n        }))\n    }\n}\n\nexport!(MyHandler);`,
  python: `from typing import Dict, Any\nimport json\n\nclass WitWorld:\n    def handle(self, request: Dict[str, Any]) -> Dict[str, Any]:\n        body_raw = request.get("body", b"")\n        try:\n            payload = json.loads(body_raw.decode("utf-8")) if body_raw else {}\n        except Exception:\n            payload = {}\n            \n        res = {\n            "status": "success",\n            "runtime": "python-componentize",\n            "echo": payload\n        }\n        return {\n            "status": 200,\n            "headers": [["content-type", "application/json"]],\n            "body": json.dumps(res).encode("utf-8")\n        }`,
  typescript: `// Wednes Function TS Component\nexport function handle(req: { method: string; uri: string; headers: [string, string][]; body?: Uint8Array }) {\n    const text = req.body ? new TextDecoder().decode(req.body) : "{}";\n    let data = {};\n    try { data = JSON.parse(text); } catch (_) {}\n\n    const responsePayload = JSON.stringify({\n        message: "Engine execution passed",\n        input: data,\n        timestamp: Date.now()\n    });\n\n    return {\n        status: 200,\n        headers: [["content-type", "application/json"]],\n        body: new TextEncoder().encode(responsePayload)\n    };\n}`,
  go: `package main\n\nimport (\n    "encoding/json"\n    "sdk/go/bindings"\n)\n\nfunc init() {\n    bindings.SetHandle(func(req bindings.Request) bindings.Response {\n        out, _ := json.Marshal(map[string]interface{}{\n            "status": "handled",\n            "provider": "wednes-go-tinygo",\n        })\n        return bindings.Response{\n            Status: 200,\n            Headers: [][2]string{{"content-type", "application/json"}},\n            Body: out,\n        }\n    })\n}\n\nfunc main() {}`
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'functions' | 'nodes' | 'billing'>('editor')
  const [lang, setLang] = useState<'rust' | 'python' | 'typescript' | 'go'>('rust')
  const [code, setCode] = useState<string>(TEMPLATES.rust)
  const [functionName, setFunctionName] = useState('payment-webhook')
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<string | null>(null)
  const [testPayload, setTestPayload] = useState('{\n  "order_id": "WDN-8821",\n  "amount": 250000\n}')
  const [testOutput, setTestOutput] = useState<any>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const [functions] = useState<FunctionItem[]>([
    { id: 'fn_1', name: 'payment-webhook', lang: 'rust', version: 'v1.4.0', status: 'active', memoryMb: 128, invocations: 128400, p95Ms: 1.45 },
    { id: 'fn_2', name: 'auth-validator', lang: 'typescript', version: 'v0.9.2', status: 'active', memoryMb: 64, invocations: 890450, p95Ms: 0.98 },
    { id: 'fn_3', name: 'report-generator', lang: 'python', version: 'v2.1.0', status: 'idle', memoryMb: 256, invocations: 14200, p95Ms: 6.80 },
    { id: 'fn_4', name: 'data-sanitizer', lang: 'go', version: 'v1.0.1', status: 'active', memoryMb: 64, invocations: 430110, p95Ms: 1.12 }
  ])

  const handleLangChange = (newLang: 'rust' | 'python' | 'typescript' | 'go') => {
    setLang(newLang)
    setCode(TEMPLATES[newLang])
  }

  const handleDeploy = () => {
    setIsDeploying(true)
    setDeployResult(null)
    setTimeout(() => {
      setIsDeploying(false)
      setDeployResult(`Function [${functionName}] compiled to WASM component and synced to Worker Node (192.168.122.10). Ingress: /fn/${functionName}`)
    }, 1200)
  }

  const handleRunTest = () => {
    setIsExecuting(true)
    setTimeout(() => {
      setIsExecuting(false)
      setTestOutput({
        status: 200,
        latency_us: 1420,
        memory_used_kb: 4120,
        headers: { "content-type": "application/json", "x-wednes-engine": "wasmtime-25.0" },
        body: {
          status: "success",
          processed_at: new Date().toISOString(),
          input_echo: JSON.parse(testPayload || "{}")
        }
      })
    }, 450)
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
              <span>IDE & Playground</span>
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
              <span>Worker Nodes</span>
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
            <div className="text-xs text-slate-400 font-mono">Tenant: <span className="text-white font-medium">Enterprise Core</span></div>
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
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded text-xs font-medium transition-all shadow-sm shadow-blue-900/20"
                >
                  {isDeploying ? (
                    <>
                      <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                      <span>Compiling to WASM...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Deploy to Node</span>
                    </>
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

            {/* Workspace Split: Editor & Test Console */}
            <div className="flex-1 flex min-h-0">
              {/* Left: Monaco Editor */}
              <div className="flex-1 border-r border-slate-800 flex flex-col min-w-0 bg-[#0d1117]">
                <div className="h-8 bg-[#161b22]/70 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Source ({lang})</span>
                  <span>ABI: wednes:function@0.1.0</span>
                </div>
                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    language={lang === 'rust' ? 'rust' : lang === 'python' ? 'python' : lang === 'go' ? 'go' : 'typescript'}
                    theme="vs-dark"
                    value={code}
                    onChange={(val) => setCode(val || '')}
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
                      <>
                        <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span>Invoking WASM Sandbox...</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Execute Function</span>
                      </>
                    )}
                  </button>

                  {/* Output Display */}
                  {testOutput && (
                    <div className="flex-1 flex flex-col min-h-0 border border-slate-800 rounded bg-[#0d1117] overflow-hidden">
                      <div className="bg-slate-900/80 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-400 font-bold">STATUS 200 OK</span>
                        <span className="text-slate-400">{testOutput.latency_us} µs</span>
                      </div>
                      <div className="p-3 text-[11px] font-mono text-slate-300 overflow-auto flex-1">
                        <pre>{JSON.stringify(testOutput.body, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
    </div>
  )
}
