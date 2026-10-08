import re

with open('/root/wednes-cp/ui/src/App.tsx', 'r') as f:
    content = f.read()

deploy_new = """const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch(`/api/deploy/${functionName}`, {
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
  }"""

run_new = """const handleRunTest = async () => {
    setIsExecuting(true);
    setTestOutput(null);
    try {
      let bodyData = null;
      try {
        bodyData = JSON.parse(testPayload);
      } catch (e) {
        bodyData = testPayload;
      }
      
      const res = await fetch(`/api/run/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData || {})
      });
      
      const data = await res.json();
      setTestOutput({
        status: data.status || res.status,
        latency_us: data.latency_us || 0,
        memory_used_kb: data.memory_used_kb || 0,
        headers: data.headers || {},
        body: data.output || data
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
  }"""

content = re.sub(r'const handleDeploy = \(\) => \{.*?\}, 1200\)\s*\}', deploy_new, content, flags=re.DOTALL)
content = re.sub(r'const handleRunTest = \(\) => \{.*?\}\)\s*\}, 450\)\s*\}', run_new, content, flags=re.DOTALL)

with open('/root/wednes-cp/ui/src/App.tsx', 'w') as f:
    f.write(content)
