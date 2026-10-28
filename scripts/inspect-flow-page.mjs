import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const textElements = Array.from(document.querySelectorAll('button, a, [role="button"], input, textarea'))
          .map(el => ({
            tag: el.tagName,
            text: (el.innerText || el.placeholder || el.value || '').trim().replace(/\\n/g, ' ').slice(0, 50),
            role: el.getAttribute('role') || '',
            href: el.getAttribute('href') || ''
          }))
          .filter(e => e.text || e.href);
        return JSON.stringify({
          url: window.location.href,
          title: document.title,
          elements: textElements.slice(0, 35)
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
