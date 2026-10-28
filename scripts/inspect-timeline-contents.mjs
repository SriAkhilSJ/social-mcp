import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const contents = document.querySelector('.timeline-contents');
        if (!contents) return 'no contents';
        return JSON.stringify({
          innerHtml: contents.innerHTML.slice(0, 500),
          childrenCount: contents.children.length
        });
      })()`
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id === 1) {
    console.log(JSON.parse(msg.result.result.value));
    process.exit(0);
  }
});
