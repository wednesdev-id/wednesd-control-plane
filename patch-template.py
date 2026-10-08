import re

with open("/root/wednes-cp/ui/src/App.tsx", "r") as f:
    content = f.read()

new_rust_template = """wit_bindgen::generate!({
    world: "function",
    path: "../../wit",
});

use wednes::function::types::{Header, Request, Response};
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
    r"rust: `use wednes_sdk::.*?export!\(MyHandler\);`,", 
    "rust: `" + new_rust_template.replace("`", "\\`") + "`,\n", 
    content, 
    flags=re.DOTALL
)

new_cargo = "'Cargo.toml': `[package]\\nname = \"active-function\"\\nversion = \"0.1.0\"\\nedition = \"2021\"\\n\\n[lib]\\ncrate-type = [\"cdylib\"]\\n\\n[dependencies]\\nwit-bindgen = \"0.32\"\\nserde_json = \"1.0\"`,\n"
content = content.replace("'src/lib.rs': TEMPLATES.rust,", new_cargo + "    'src/lib.rs': TEMPLATES.rust,")

with open("/root/wednes-cp/ui/src/App.tsx", "w") as f:
    f.write(content)
