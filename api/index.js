const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const http = require('http');
const { Pool } = require('pg');
const archiver = require('archiver');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const crypto = require('crypto');

// --- AUTH middleware ---
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const { rows } = await pool.query('SELECT id, username FROM users WHERE token = $1', [token]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = rows[0];
        next();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const token = crypto.randomBytes(32).toString('hex');
    try {
        const { rows } = await pool.query(
            'INSERT INTO users (username, password, token) VALUES ($1, $2, $3) RETURNING id, username, token',
            [username, hash, token]
        );
        res.json(rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'Username already exists' });
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    try {
        const { rows } = await pool.query('SELECT id, username FROM users WHERE username = $1 AND password = $2', [username, hash]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = crypto.randomBytes(32).toString('hex');
        await pool.query('UPDATE users SET token = $1 WHERE id = $2', [token, rows[0].id]);
        
        res.json({ id: rows[0].id, username: rows[0].username, token });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/logout', authenticate, async (req, res) => {
    try {
        await pool.query('UPDATE users SET token = NULL WHERE id = $1', [req.user.id]);
        res.json({ status: 'ok' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});


// ---- PROJECT CRUD ----

// List all projects

const templates = require('./templates.js');

app.get('/api/templates', (req, res) => {
    res.json(templates);
});

app.get('/api/projects', authenticate, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, name, lang, deployed_at, created_at, updated_at FROM projects WHERE user_id = ORDER BY updated_at DESC, [req.user.id]');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get single project with files
app.get('/api/projects/:name', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM projects WHERE name = $1', [req.params.name]);
        if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create or update project (upsert)
app.post('/api/projects', authenticate, async (req, res) => {
    const { name, lang, files } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO projects (name, lang, files, updated_at, user_id) VALUES ($1, $2, $3, NOW(), $4)
             ON CONFLICT (name) DO UPDATE SET files = $3, lang = COALESCE($2, projects.lang), updated_at = NOW(), user_id = $4
             RETURNING id, name, lang, created_at, updated_at`,
            [name, lang || 'rust', JSON.stringify(files || {}), req.user.id]
        );
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Save project files
app.put('/api/projects/:name', authenticate, async (req, res) => {
    const { files, lang } = req.body;
    try {
        const updates = [];
        const params = [req.params.name];
        let idx = 2;
        if (files !== undefined) { updates.push(`files = $${idx}`); params.push(JSON.stringify(files)); idx++; }
        if (lang !== undefined) { updates.push(`lang = $${idx}`); params.push(lang); idx++; }
        updates.push('updated_at = NOW()');
        const { rowCount } = await pool.query(`UPDATE projects SET ${updates.join(', ')} WHERE name = $1`, params);
        if (rowCount === 0) return res.status(404).json({ error: 'Project not found' });
        res.json({ status: 'ok' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Delete project
app.delete('/api/projects/:name', authenticate, async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE name = $1', [req.params.name]);
        res.json({ status: 'ok', message: `Project ${req.params.name} deleted` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// Push project to Github
app.post('/api/projects/:name/github', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token, repo, branch, commit_message } = req.body;
    
    if (!token || !repo) return res.status(400).json({ error: 'token and repo are required (e.g. repo: "username/repo")' });
    
    try {
        const { rows } = await pool.query('SELECT * FROM projects WHERE name = $1', [name]);
        if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });
        
        const project = rows[0];
        const files = project.files || {};
        
        const tmpDir = os.tmpdir() + '/wednes_github_' + name + '_' + Date.now();
        fs.mkdirSync(tmpDir, { recursive: true });
        
        for (const [path, content] of Object.entries(files)) {
            const destPath = tmpDir + '/' + path;
            const dir = destPath.substring(0, destPath.lastIndexOf('/'));
            if (dir !== tmpDir) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(destPath, content);
        }
        
        if (!files['README.md']) {
            fs.writeFileSync(tmpDir + '/README.md', `# ${name}\n\nWednes Serverless Function exported from Control Plane.`);
        }
        
        const cmds = [
            `cd ${tmpDir}`,
            `git init`,
            `git config user.name "Wednes Control Plane"`,
            `git config user.email "bot@wednesdev.id"`,
            `git add .`,
            `git commit -m "${commit_message || 'Update function from Control Plane'}"`,
            `git branch -M ${branch || 'main'}`,
            `git remote add origin https://${token}@github.com/${repo}.git`,
            `git push -u origin ${branch || 'main'} --force`
        ];
        
        exec(cmds.join(' && '), (error, stdout, stderr) => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            if (error) {
                return res.status(500).json({ error: 'Git push failed', details: stderr || error.message });
            }
            res.json({ status: 'ok', message: `Successfully pushed to ${repo}` });
        });
        
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Download project as .zip
app.get('/api/projects/:name/download', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM projects WHERE name = $1', [req.params.name]);
        if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });

        const project = rows[0];
        const files = project.files || {};

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${project.name}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        for (const [path, content] of Object.entries(files)) {
            archive.append(content, { name: `${project.name}/${path}` });
        }

        // Include WIT definition
        try {
            const wit = fs.readFileSync('/wednes-engine/wit/function.wit', 'utf8');
            archive.append(wit, { name: `${project.name}/wit/function.wit` });
        } catch (_) {}

        await archive.finalize();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---- FUNCTIONS (from registry) ----

app.get('/api/functions', (req, res) => {
    try {
        const registryRaw = fs.readFileSync('/artifacts/registry.json', 'utf8');
        const registry = JSON.parse(registryRaw);
        const fns = Object.values(registry.functions || {}).map(f => ({
            id: f.name, name: f.name,
            abi: f.abi || "wednes:function@0.1.0",
            artifact: f.artifact, runtime: "wasm", version: "0.1.0",
            memoryMb: f.runtime?.memory_mb || 32,
            timeoutMs: f.runtime?.timeout_ms || 5000,
            status: "active"
        }));
        res.json(fns);
    } catch (e) { res.json([]); }
});

app.delete('/api/functions/:name', (req, res) => {
    const fnName = req.params.name;
    const registryPath = '/artifacts/registry.json';
    try {
        if (!fs.existsSync(registryPath)) return res.status(404).json({ error: 'Registry not found' });
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        if (registry.functions && registry.functions[fnName]) {
            delete registry.functions[fnName];
            fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
            exec('systemctl restart wednesd', () => {
                res.json({ status: 'ok', message: 'Function ' + fnName + ' removed' });
            });
        } else {
            res.status(404).json({ error: 'Function not found' });
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ---- NODES ----

app.get('/api/nodes', (req, res) => {
    const totalMem = os.totalmem() / (1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024);
    res.json([{
        id: "node-kvm-primary", ip: "192.168.122.10:8080",
        status: "healthy", engine: "wednesd Wasmtime Native",
        rss_mib: (totalMem - freeMem).toFixed(2), active_sandboxes: 10
    }]);
});

// ---- RUN FUNCTION ----

app.all(['/api/run/:name', '/api/run/:name/*'], (req, res) => {
    const fnName = req.params.name;
    const subPath = req.params[0] ? '/' + req.params[0] : '';
    const bodyData = (req.body && Object.keys(req.body).length > 0) ? JSON.stringify(req.body) : '';


    let targetFn = fnName;
    try {
        const fs = require('fs');
        const reg = JSON.parse(fs.readFileSync('/artifacts/registry.json', 'utf8'));
        if (reg && reg.functions) {
            if (reg.functions[fnName + '-main']) {
                targetFn = fnName + '-main';
            } else if (!reg.functions[fnName]) {
                const keys = Object.keys(reg.functions);
                const match = keys.find(k => k.startsWith(fnName + '-'));
                if (match) targetFn = match;
            }
        }
        console.log(`[API /run] fnName="${fnName}" resolved to targetFn="${targetFn}"`);
    } catch(e) {
        console.log(`[API /run error]`, e.message);
    }

    const options = {
        hostname: '172.17.0.1', port: 8080,
        path: '/fn/' + targetFn + subPath,
        method: req.method,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyData) }
    };

    const startTime = process.hrtime();
    const proxyReq = http.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
            const diff = process.hrtime(startTime);
            const latencyUs = (diff[0] * 1e6 + diff[1] / 1e3).toFixed(2);
            let parsedBody = data;
            try { parsedBody = JSON.parse(data); } catch(_) {}
            res.status(proxyRes.statusCode).json({
                status: proxyRes.statusCode, latency_us: Number(latencyUs),
                headers: proxyRes.headers, output: parsedBody
            });
        });
    });
    proxyReq.on('error', (err) => res.status(502).json({ error: 'Failed to contact wednesd gateway: ' + err.message }));
    if (bodyData) proxyReq.write(bodyData);
    proxyReq.end();
});


// ---- WORKFLOWS (DAG Engine) ----

app.get('/api/workflows', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM workflows ORDER BY updated_at DESC');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/workflows', authenticate, async (req, res) => {
    const { name, description, trigger, steps } = req.body;
    if (!name || !steps) return res.status(400).json({ error: 'name and steps are required' });
    try {
        const { rows } = await pool.query(
            `INSERT INTO workflows (name, description, trigger, steps, user_id, updated_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (name) DO UPDATE SET 
                description = $2, trigger = $3, steps = $4, user_id = $5, updated_at = NOW()
             RETURNING *`,
            [name, description, JSON.stringify(trigger || {}), JSON.stringify(steps), req.user.id]
        );
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/workflows/:name/runs', authenticate, async (req, res) => {
    try {
        const { rows: wfRows } = await pool.query('SELECT id FROM workflows WHERE name = $1', [req.params.name]);
        if (wfRows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
        
        const { rows } = await pool.query('SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY executed_at DESC LIMIT 20', [wfRows[0].id]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/workflows/:name/run', async (req, res) => {
    const { name } = req.params;
    const initialInput = req.body || {};
    
    try {
        const { rows } = await pool.query('SELECT * FROM workflows WHERE name = $1', [name]);
        if (rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
        
        const workflow = rows[0];
        const steps = workflow.steps || [];
        
        const trace = [];
        let currentContext = { trigger: { body: initialInput }, steps: {} };
        let hasFailed = false;
        
        const wfStartTime = process.hrtime();
        let lastOutput = null;

        const regRaw = require('fs').readFileSync('/artifacts/registry.json', 'utf8');
        const reg = JSON.parse(regRaw);
        
        for (const step of steps) {
            const stepStartTime = process.hrtime();
            try {
                // Determine target function
                let targetFn = step.function;
                if (reg.functions) {
                    if (reg.functions[targetFn + '-main']) targetFn += '-main';
                    else if (!reg.functions[targetFn]) {
                        const match = Object.keys(reg.functions).find(k => k.startsWith(targetFn + '-'));
                        if (match) targetFn = match;
                    }
                }

                // Compile step input by evaluating mapping code
                // e.g. mappingCode = "return { order_id: context.steps.step1.output.id };"
                let stepInput = {};
                if (step.input_mapping) {
                    // Safe evaluation
                    const vm = require('vm');
                    const sandbox = { context: currentContext };
                    vm.createContext(sandbox);
                    stepInput = vm.runInContext(`(function() { ${step.input_mapping} })()`, sandbox);
                } else {
                    stepInput = currentContext.trigger.body;
                }
                
                // Execute HTTP Request to wednesd gateway
                const bodyData = JSON.stringify(stepInput);
                const stepPath = step.path ? (step.path.startsWith('/') ? step.path : '/' + step.path) : '/';
                const options = {
                    hostname: '172.17.0.1', port: 8080,
                    path: '/fn/' + targetFn + stepPath,
                    method: step.method || 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyData) }
                };

                const proxyRes = await new Promise((resolve, reject) => {
                    const req = http.request(options, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
                    });
                    req.on('error', reject);
                    req.write(bodyData);
                    req.end();
                });

                const diff = process.hrtime(stepStartTime);
                const latencyMs = Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2));
                
                let parsedOutput = proxyRes.data;
                try { parsedOutput = JSON.parse(proxyRes.data); } catch(_) {}
                
                const isSuccess = proxyRes.statusCode >= 200 && proxyRes.statusCode < 300;
                
                const stepResult = {
                    id: step.id,
                    name: step.name,
                    function: targetFn,
                    status: isSuccess ? 'success' : 'failed',
                    latency_ms: latencyMs,
                    http_status: proxyRes.statusCode,
                    input: stepInput,
                    output: parsedOutput
                };
                
                trace.push(stepResult);
                currentContext.steps[step.id] = stepResult;
                lastOutput = parsedOutput;

                if (!isSuccess) {
                    hasFailed = true;
                    break; // Stop DAG on failure
                }

            } catch (err) {
                const diff = process.hrtime(stepStartTime);
                trace.push({
                    id: step.id,
                    name: step.name,
                    function: step.function,
                    status: 'error',
                    latency_ms: Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2)),
                    error: err.message
                });
                hasFailed = true;
                break; // Stop DAG on failure
            }
        }
        
        const wfDiff = process.hrtime(wfStartTime);
        const totalDurationMs = Number((wfDiff[0] * 1e3 + wfDiff[1] / 1e6).toFixed(2));
        const finalStatus = hasFailed ? 'failed' : 'success';
        
        // Save to workflow_runs
        await pool.query(
            'INSERT INTO workflow_runs (workflow_id, status, input, output, trace, total_duration_ms, executed_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            [workflow.id, finalStatus, JSON.stringify(initialInput), JSON.stringify(lastOutput), JSON.stringify(trace), totalDurationMs]
        );
        
        res.json({
            status: finalStatus,
            total_duration_ms: totalDurationMs,
            input: initialInput,
            output: lastOutput,
            trace
        });
        
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---- TERMINAL ----


app.post('/api/terminal', (req, res) => {
    const { cmd } = req.body;
    if (!cmd) return res.json({ output: '' });
    exec(cmd, { cwd: '/artifacts', timeout: 5000 }, (error, stdout, stderr) => {
        let output = stdout || '';
        if (stderr) output += '\n' + stderr;
        if (error && !output) output = error.message;
        res.json({ output: output.trim() });
    });
});

// ---- SCAFFOLD & DEPLOY ----

app.get('/api/scaffold', (req, res) => {
    http.get('http://172.17.0.1:8089/scaffold', (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => res.json(JSON.parse(data)));
    }).on('error', (err) => res.status(500).json({error: err.message}));
});

app.post('/api/deploy/:name', authenticate, async (req, res) => {
    const fnName = req.params.name;
    const files = req.body.files || {};
    const release = req.body.release || false;

    // Auto-save to DB before deploy
    try {
        const lang = req.body.lang || (files['Cargo.toml'] ? 'rust' : files['main.go'] ? 'golang' : files['app.py'] ? 'python' : 'typescript');
        await pool.query(
            `INSERT INTO projects (name, lang, files, deployed_at, updated_at, user_id) VALUES ($1, $2, $3, NOW(), NOW(), $4)
             ON CONFLICT (name) DO UPDATE SET files = $3, lang = $2, deployed_at = NOW(), updated_at = NOW(), user_id = $4`,
            [fnName, lang, JSON.stringify(files), req.user.id]
        );
    } catch (_) {}

    const postData = JSON.stringify({ name: fnName, files, release });
    const options = {
        hostname: '172.17.0.1', port: 8089, path: '/build', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const proxyReq = http.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
            try { res.status(proxyRes.statusCode).json(JSON.parse(data)); }
            catch(e) { res.status(proxyRes.statusCode).send(data); }
        });
    });
    proxyReq.on('error', (err) => res.status(502).json({ error: 'Failed to contact wednes builder daemon: ' + err.message }));
    proxyReq.write(postData);
    proxyReq.end();
});

app.listen(3000, () => { console.log('API v2 listening on port 3000'); });
