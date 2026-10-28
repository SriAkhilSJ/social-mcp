import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const overlay = document.querySelector('.cdk-overlay-container');
        if (!overlay) return 'no overlay';
        const items = Array.from(overlay.querySelectorAll('*'))
          .map(el => ({
            tag: el.tagName,
            text: (el.innerText || '').trim().replace(/\\n/g, ' '),
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || ''
          }))
          .filter(e => e.text && e.text.length < 60);
        return JSON.stringify(items.slice(30, 70));
      })()`
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    console.log(JSON.stringify(JSON.parse(msg.result.result.value), null, 2));
    process.exit(0);
  }
});
