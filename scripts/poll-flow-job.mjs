import fs from 'fs';
import path from 'path';
import os from 'os';

const token = fs.readFileSync(path.join(os.homedir(), '.flow-mcp', 'token'), 'utf8').trim();

async function poll() {
  console.log('Polling Flow MCP for job babbc6af...');
  const res = await fetch('http://127.0.0.1:8787/api/wait', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-flow-token': token
    },
    body: JSON.stringify({
      job_ids: ['babbc6af'],
      timeout_seconds: 35
    })
  });
  const data = await res.json();
  console.log('Wait response:\n', JSON.stringify(data, null, 2));
}

poll().catch(console.error);
