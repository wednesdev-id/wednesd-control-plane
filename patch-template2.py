import re

with open("/root/wednes-cp/ui/src/App.tsx", "r") as f:
    content = f.read()

new_rust_template = """wit_bindgen::generate!({
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

export!(MyHandler);"""

content = re.sub(
    r"wit_bindgen::generate!.*?export!\(MyHandler\);", 
    new_rust_template, 
    content, 
    flags=re.DOTALL
)

with open("/root/wednes-cp/ui/src/App.tsx", "w") as f:
    f.write(content)
