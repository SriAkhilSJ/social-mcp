import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const tBtn = btns.find(b => b.innerText.includes('Templates'));
        if (tBtn) {
          tBtn.click();
          return 'clicked Templates';
        }
        return 'no templates button';
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
