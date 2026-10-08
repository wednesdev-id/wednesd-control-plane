# Wednes Engine Control Plane

Web UI dan API Gateway untuk manajemen dan eksekusi serverless WebAssembly (WASM) di Wednes Engine KVM.

## Arsitektur
- **Frontend (UI)**: React + Vite, IDE berbasis browser dengan tree-view.
- **Backend (API)**: Express.js (Port 3000), bertindak sebagai gateway ke runtime `wednesd`.
- **Builder Daemon**: Daemon Python (Port 8089) untuk kompilasi Rust dan Go menjadi component WASM.
- **Runtime**: `wednesd` (Wasmtime engine, Port 8080).

## Fitur Utama
- **Zero-Config WASM Build**: Mendukung bahasa Rust dan Golang out-of-the-box.
- **Component Model**: Menggunakan ABI `wednes:function@0.1.0`.
- **Incremental Compilation**: Cache Rust target dan Go module dipertahankan untuk mempercepat kompilasi (~3 detik).

## REST API Docs

### 1. `GET /api/functions`
Mendapatkan daftar semua function WASM yang ter-deploy di Wednes Engine.
**Response (200 OK):**
```json
[
  {
    "id": "hello-world",
    "name": "hello-world",
    "abi": "wednes:function@0.1.0",
    "status": "active",
    "memoryMb": 32
  }
]
```

### 2. `POST /api/deploy/:name`
Mengirim kode sumber untuk dikompilasi oleh Builder Node. Payload berisi hierarki file flat.
**Request Body:**
```json
{
  "files": {
    "src/lib.rs": "...",
    "Cargo.toml": "..."
  }
}
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "function": "hello-world",
  "message": "Successfully compiled and deployed"
}
```

### 3. `POST /api/run/:name`
Menjalankan fungsi spesifik yang sudah ter-deploy ke engine.
**Response (200 OK):**
```json
{
  "status": 200,
  "latency_us": 3500.50,
  "output": {
    "message": "Hello from Wednes WASM Engine!"
  }
}
```
