const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let commitSha = process.env.RENDER_GIT_COMMIT || '';
try {
  if (!commitSha) {
    commitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  }
} catch {
  commitSha = 'unknown';
}

const srcStatic = path.join(__dirname, '..', '.next', 'static');
const destStatic = path.join(__dirname, '..', '.next', 'standalone', '.next', 'static');
if (fs.existsSync(srcStatic)) {
  fs.cpSync(srcStatic, destStatic, { recursive: true });
}

const srcPublic = path.join(__dirname, '..', 'public');
const destPublic = path.join(__dirname, '..', '.next', 'standalone', 'public');
if (fs.existsSync(srcPublic)) {
  fs.cpSync(srcPublic, destPublic, { recursive: true });
}

const buildInfo = {
  commitSha,
  builtAt: new Date().toISOString(),
  renderDeployId: process.env.RENDER_DEPLOY_ID || null,
  renderServiceId: process.env.RENDER_SERVICE_ID || 'srv-dbh689mc6qcc7380j32g',
};

fs.mkdirSync(destPublic, { recursive: true });
fs.mkdirSync(srcPublic, { recursive: true });
fs.writeFileSync(path.join(destPublic, 'build-info.json'), JSON.stringify(buildInfo, null, 2), 'utf-8');
fs.writeFileSync(path.join(srcPublic, 'build-info.json'), JSON.stringify(buildInfo, null, 2), 'utf-8');

console.log('Standalone assets and build-info.json copied successfully (Commit:', commitSha, ')');
