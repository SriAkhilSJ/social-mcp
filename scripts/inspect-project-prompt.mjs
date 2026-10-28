import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const pm = document.querySelector('.ProseMirror[contenteditable="true"]');
        if (!pm) return JSON.stringify({ found: false });
        const container = pm.closest('form, flow-prompt-input, .prompt-input-container, .base-prompt-box, div');
        const nearbyButtons = Array.from(document.querySelectorAll('button'))
          .map(b => ({
            text: (b.innerText || '').trim(),
            ariaLabel: b.getAttribute('aria-label') || '',
            className: b.className
          }))
          .filter(b => b.text || b.ariaLabel);
        return JSON.stringify({
          ariaLabel: pm.getAttribute('aria-label'),
          html: pm.outerHTML.slice(0, 300),
          nearbyButtons: nearbyButtons.slice(0, 30)
        });
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
