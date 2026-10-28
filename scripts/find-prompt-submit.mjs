import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const pm = document.querySelector('.ProseMirror[contenteditable="true"]');
        let p = pm;
        while (p && !p.querySelector('button[aria-label*="Generate"], button[aria-label*="Send"], button.send-button, button.generate-button, button[type="submit"]')) {
          p = p.parentElement;
          if (p === document.body) break;
        }
        const btns = p ? Array.from(p.querySelectorAll('button')).map(b => ({
          text: (b.innerText || '').trim(),
          ariaLabel: b.getAttribute('aria-label') || '',
          class: b.className
        })) : [];
        return JSON.stringify({
          containerTag: p ? p.tagName : null,
          containerClass: p ? p.className : null,
          btns
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
