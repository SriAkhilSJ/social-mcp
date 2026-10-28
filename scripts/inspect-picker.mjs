import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const dialog = document.querySelector('[role="dialog"], mat-dialog-container, flow-asset-picker, .asset-picker, .drawer');
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], flow-asset-card, .asset-card'))
          .map(b => ({
            tag: b.tagName,
            text: (b.innerText || '').trim().replace(/\\n/g, ' ').slice(0, 50),
            class: b.className
          }))
          .filter(b => b.text);
        return JSON.stringify({
          dialogFound: Boolean(dialog),
          buttons: buttons.slice(0, 30)
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
