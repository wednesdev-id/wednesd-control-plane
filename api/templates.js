module.exports = {
  "python-fastapi": {
    name: "Python FastAPI Microservice",
    lang: "python",
    desc: "Lightweight FastAPI adapter pattern with decorator routes (@app.get, @app.post) and JSON parsing.",
    badge: "FastAPI Pattern",
    files: {
      "wednes.yaml": `version: "1.0"
name: "fastapi-order-service"

functions:
  api:
    handler: app.py
    lang: python
    route: /
    runtime:
      memory_mb: 64
      timeout_ms: 5000
`,
      "app.py": `# Wednes Serverless - FastAPI Adapter Pattern
# Emulates FastAPI/Mangum style routing on top of Wasmtime Component Model
import json
from typing import Callable, Dict, Any
from wit_world.imports.types import Request, Response, Header

class WednesFastAPI:
    def __init__(self, title: str = "Wednes FastAPI"):
        self.title = title
        self.routes: Dict[str, Dict[str, Callable]] = {}

    def get(self, path: str):
        def decorator(func: Callable):
            self.routes.setdefault(path, {})["GET"] = func
            return func
        return decorator

    def post(self, path: str):
        def decorator(func: Callable):
            self.routes.setdefault(path, {})["POST"] = func
            return func
        return decorator

    def handle(self, req: Request) -> Response:
        path = req.path or "/"
        method = (req.method or "GET").upper()

        handler = self.routes.get(path, {}).get(method)
        if not handler and "/" in self.routes and method in self.routes["/"]:
            handler = self.routes["/"][method]

        if not handler:
            return Response(
                status=404,
                headers=[Header(name="content-type", value="application/json")],
                body=json.dumps({"error": "Route Not Found", "path": path, "method": method}).encode("utf-8")
            )

        try:
            body_data = {}
            if req.body:
                try:
                    body_data = json.loads(bytes(req.body).decode("utf-8"))
                except Exception:
                    body_data = {}

            result = handler(body_data, req)
            return Response(
                status=200,
                headers=[Header(name="content-type", value="application/json")],
                body=json.dumps(result).encode("utf-8")
            )
        except Exception as e:
            return Response(
                status=500,
                headers=[Header(name="content-type", value="application/json")],
                body=json.dumps({"error": str(e)}).encode("utf-8")
            )

app = WednesFastAPI("Wednes Order Service")

@app.get("/")
def get_root(body: Dict[str, Any], req: Request):
    return {
        "status": "online",
        "app": app.title,
        "runtime": "Wednes WASM Python Component",
        "latency_cold_start": "< 2ms"
    }

@app.post("/")
@app.post("/api/orders")
def create_order(body: Dict[str, Any], req: Request):
    order_id = body.get("order_id", "WDN-8821")
    amount = body.get("amount", 250000)
    return {
        "status": "success",
        "order_id": order_id,
        "amount": amount,
        "tax": amount * 0.11,
        "total": amount * 1.11,
        "settled": True
    }

class WitWorld:
    def handle(self, req: Request) -> Response:
        return app.handle(req)
`,
      "README.md": `# Python FastAPI Microservice on Wednes Serverless

Pola ini meniru arsitektur Mangum/AWS Lambda, memungkinkan developer menggunakan decorator route \`@app.get\` dan \`@app.post\` yang umum di FastAPI tanpa perlu repot menangani low-level byte stream.

### Struktur Proyek:
- \`wednes.yaml\`: Manifest spesifikasi runtime & alokasi memori
- \`app.py\`: Aplikasi utama dengan class \`WednesFastAPI\`
`
    }
  },
  "typescript-express": {
    name: "TypeScript Express REST API",
    lang: "typescript",
    desc: "Express-style mini-framework with router, JSON middleware, and res.json() / res.status() pattern.",
    badge: "Express Pattern",
    files: {
      "wednes.yaml": `version: "1.0"
name: "express-crm-api"

functions:
  main:
    handler: src/index.ts
    lang: typescript
    route: /
    runtime:
      memory_mb: 64
      timeout_ms: 5000
`,
      "package.json": `{
  "name": "express-crm-api",
  "version": "1.0.0",
  "dependencies": {
    "@bytecodealliance/componentize-js": "^0.11"
  }
}
`,
      "src/index.ts": `// Wednes Serverless - Express Adapter Pattern
class WednesExpress {
  private routes: Record<string, Record<string, (req: any, res: any) => void>> = {};

  get(path: string, handler: (req: any, res: any) => void) {
    if (!this.routes[path]) this.routes[path] = {};
    this.routes[path]["GET"] = handler;
  }

  post(path: string, handler: (req: any, res: any) => void) {
    if (!this.routes[path]) this.routes[path] = {};
    this.routes[path]["POST"] = handler;
  }

  handle(rawReq: { method: string; path: string; headers: { name: string; value: string }[]; body?: Uint8Array }) {
    let body = {};
    if (rawReq.body && rawReq.body.length > 0) {
      try {
        const text = new TextDecoder().decode(rawReq.body);
        body = JSON.parse(text);
      } catch (_) {}
    }

    const req = {
      method: rawReq.method || "GET",
      path: rawReq.path || "/",
      headers: rawReq.headers || [],
      body
    };

    let statusCode = 200;
    let headers: { name: string; value: string }[] = [{ name: "content-type", value: "application/json" }];
    let responseBody: any = null;

    const res = {
      status: (code: number) => { statusCode = code; return res; },
      setHeader: (name: string, value: string) => { headers.push({ name, value }); return res; },
      json: (data: any) => { responseBody = data; }
    };

    const handler = this.routes[req.path]?.[req.method] || this.routes["/"]?.[req.method];
    if (handler) {
      handler(req, res);
    } else {
      res.status(404).json({ error: "Cannot " + req.method + " " + req.path });
    }

    const jsonStr = JSON.stringify(responseBody || {});
    return {
      status: statusCode,
      headers,
      body: new TextEncoder().encode(jsonStr)
    };
  }
}

const app = new WednesExpress();

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Wednes TypeScript Express API",
    engine: "Wasmtime Component Model (Zero Cold-Start)",
    uptime: "99.99%"
  });
});

app.post("/webhook/crm", (req, res) => {
  const { lead_name, email, plan } = req.body;
  res.status(201).json({
    status: "lead_registered",
    lead_name: lead_name || "Guest Lead",
    email: email || "unknown@wednesdev.id",
    tier: plan || "Managed Cloud",
    assigned_node: "node-kvm-primary"
  });
});

export function handle(req: any) {
  return app.handle(req);
}
`,
      "README.md": `# TypeScript Express REST API on Wednes

Boilerplate ini menyediakan routing ala Express.js (\`app.get\`, \`app.post\`, \`res.json()\`) yang berjalan secara native di WebAssembly Component Model.
`
    }
  },
  "go-fiber": {
    name: "Go Fiber Micro-Gateway",
    lang: "go",
    desc: "Fiber/Echo-style micro router in Go using TinyGo WASI compilation for ultra-low latency.",
    badge: "Fiber Pattern",
    files: {
      "wednes.yaml": `version: "1.0"
name: "go-fiber-gateway"

functions:
  main:
    handler: main.go
    lang: golang
    route: /
    runtime:
      memory_mb: 32
      timeout_ms: 3000
`,
      "go.mod": `module active-function

go 1.22
`,
      "main.go": `package main

import (
	"encoding/json"
	"strings"
	"active-function/function"
)

type Ctx struct {
	Req  function.FunctionRequest
	Code int
	Body []byte
}

func (c *Ctx) JSON(status int, data interface{}) function.FunctionResponse {
	bytes, _ := json.Marshal(data)
	return function.FunctionResponse{
		Status: uint16(status),
		Headers: []function.WednesFunction0_1_0_TypesHeader{
			{Name: "content-type", Value: "application/json"},
			{Name: "x-powered-by", Value: "Wednes-Fiber-TinyGo"},
		},
		Body: bytes,
	}
}

func (c *Ctx) BodyParser(out interface{}) error {
	return json.Unmarshal(c.Req.Body, out)
}

type MyHandler struct{}

func (h MyHandler) Handle(req function.FunctionRequest) function.FunctionResponse {
	c := &Ctx{Req: req, Code: 200}
	path := strings.ToLower(req.Path)
	method := strings.ToUpper(req.Method)

	if (path == "/" || path == "") && method == "GET" {
		return c.JSON(200, map[string]interface{}{
			"status":   "ok",
			"provider": "Wednes Go Fiber Micro-Gateway",
			"latency":  "sub-millisecond",
		})
	}

	if strings.HasPrefix(path, "/telemetry") && method == "POST" {
		var payload map[string]interface{}
		_ = c.BodyParser(&payload)
		return c.JSON(200, map[string]interface{}{
			"status":    "acknowledged",
			"received":  payload,
			"processed": true,
		})
	}

	return c.JSON(404, map[string]interface{}{
		"error": "Route Not Found",
		"path":  req.Path,
	})
}

func init() {
	function.SetFunction(MyHandler{})
}

func main() {}
`,
      "README.md": `# Go Fiber Micro-Gateway on Wednes Serverless

Template ini mengimplementasikan konsep Context (\`c.JSON\`, \`c.BodyParser\`) layaknya Fiber/Echo menggunakan compiler TinyGo WASM.
`
    }
  },
  "rust-axum": {
    name: "Rust Axum High-Performance Engine",
    lang: "rust",
    desc: "Axum-style match router with strictly typed Serde JSON serialization and 32MB memory boundary.",
    badge: "Axum Pattern",
    files: {
      "wednes.yaml": `version: "1.0"
name: "rust-axum-service"

functions:
  main:
    handler: src/lib.rs
    lang: rust
    route: /
    runtime:
      memory_mb: 32
      timeout_ms: 2000
`,
      "Cargo.toml": `[package]
name = "active-function"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wit-bindgen = "0.32"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`,
      "src/lib.rs": `wit_bindgen::generate!({
    world: "function",
    path: "../../wit",
});

use wednes::function::types::Header;
// Request and Response are in the current scope from generate!
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Deserialize)]
struct PaymentPayload {
    order_id: Option<String>,
    amount: Option<u64>,
}

struct AxumRouter;

impl Guest for AxumRouter {
    fn handle(req: Request) -> Response {
        let path = req.path.as_str();
        let method = req.method.to_uppercase();

        match (method.as_str(), path) {
            ("GET", "/") => json_response(200, json!({
                "status": "online",
                "framework": "Wednes Axum Pattern",
                "engine": "Wasmtime 25 Native",
                "memory_budget": "32 MiB"
            })),

            ("POST", "/checkout") | ("POST", "/") => {
                let parsed: PaymentPayload = serde_json::from_slice(&req.body).unwrap_or(PaymentPayload {
                    order_id: Some("WDN-AUTO".into()),
                    amount: Some(0),
                });

                let order_id = parsed.order_id.unwrap_or_else(|| "WDN-NONE".into());
                let amount = parsed.amount.unwrap_or(0);

                json_response(200, json!({
                    "status": "PAID",
                    "order_id": order_id,
                    "amount": amount,
                    "engine_latency_us": 1420
                }))
            }

            _ => json_response(404, json!({
                "error": "Route Not Found",
                "path": path
            }))
        }
    }
}

fn json_response(status: u16, data: serde_json::Value) -> Response {
    let body = serde_json::to_vec(&data).unwrap_or_default();
    Response {
        status,
        headers: vec![
            Header { name: "content-type".to_string(), value: "application/json".to_string() },
            Header { name: "x-powered-by".to_string(), value: "Wednes-Axum-Wasm".to_string() }
        ],
        body,
    }
}

export!(AxumRouter);
`,
      "README.md": `# Rust Axum High-Performance Engine on Wednes

Pola ini mencontohkan router Axum dengan \`serde_json\` deserialization, pencocokan pola \`match (method, path)\`, serta performa eksekusi < 1.5ms.
`
    }
  }
};
