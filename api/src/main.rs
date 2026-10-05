use axum::{
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct NodeHealth {
    id: &'static str,
    ip: &'static str,
    status: &'static str,
    engine: &'static str,
    rss_mib: f32,
    active_sandboxes: u32,
}

#[derive(Serialize)]
struct FunctionMeta {
    id: &'static str,
    name: &'static str,
    runtime: &'static str,
    version: &'static str,
    memory_mb: u32,
    p95_ms: f32,
}

#[derive(Deserialize)]
struct DeployRequest {
    name: String,
    runtime: String,
    code: String,
}

#[derive(Serialize)]
struct DeployResponse {
    status: &'static str,
    function_id: String,
    ingress_url: String,
    assigned_node: &'static str,
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "wednes-control-plane-api",
        "version": "1.0.0"
    }))
}

async fn list_nodes() -> Json<Vec<NodeHealth>> {
    Json(vec![NodeHealth {
        id: "node-kvm-primary",
        ip: "192.168.122.10:8080",
        status: "healthy",
        engine: "wasmtime-v25.0.0",
        rss_mib: 20.33,
        active_sandboxes: 4,
    }])
}

async fn list_functions() -> Json<Vec<FunctionMeta>> {
    Json(vec![
        FunctionMeta {
            id: "fn_1",
            name: "payment-webhook",
            runtime: "rust",
            version: "v1.4.0",
            memory_mb: 128,
            p95_ms: 1.45,
        },
        FunctionMeta {
            id: "fn_2",
            name: "auth-validator",
            runtime: "typescript",
            version: "v0.9.2",
            memory_mb: 64,
            p95_ms: 0.98,
        },
    ])
}

async fn deploy_function(Json(payload): Json<DeployRequest>) -> Json<DeployResponse> {
    Json(DeployResponse {
        status: "deployed",
        function_id: format!("fn_{}", payload.name),
        ingress_url: format!("http://192.168.122.10:8080/fn/{}", payload.name),
        assigned_node: "192.168.122.10",
    })
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/nodes", get(list_nodes))
        .route("/api/functions", get(list_functions))
        .route("/api/functions/deploy", post(deploy_function))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Control Plane API running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
