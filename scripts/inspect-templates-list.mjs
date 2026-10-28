import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const cards = Array.from(document.querySelectorAll('[class*="tool-card"], [class*="card"], [class*="template"], flow-tool-card'))
          .map(c => ({
            title: (c.querySelector('h1, h2, h3, h4, .title, .name') || {}).innerText || '',
            desc: (c.querySelector('p, .description') || {}).innerText || '',
            full: c.innerText.trim().replace(/\\n/g, ' ').slice(0, 80)
          }))
          .filter(c => c.full.length > 5);
        return JSON.stringify(cards.slice(0, 30));
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
