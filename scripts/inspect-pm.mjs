import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const pm = document.querySelector('.ProseMirror');
        if (!pm) return JSON.stringify({ found: false });
        let p = pm;
        const parents = [];
        for (let i = 0; i < 4; i++) {
          p = p.parentElement;
          if (p) parents.push({ tag: p.tagName, class: p.className, html: p.innerHTML.slice(0, 200) });
        }
        return JSON.stringify({
          pmHtml: pm.outerHTML.slice(0, 300),
          parents
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
