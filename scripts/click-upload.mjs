import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const btn = document.querySelector('.sidebar-upload-btn, button[aria-label*="upload"], button[aria-label*="Upload"]');
        if (!btn) return 'no upload button';
        btn.click();
        return 'clicked upload button';
      })()`
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    console.log(msg.result.result.value);
    process.exit(0);
  }
});
