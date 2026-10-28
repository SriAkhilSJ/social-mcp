import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const inputs = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]'))
          .map((el, i) => ({
            index: i,
            tag: el.tagName,
            placeholder: el.placeholder || '',
            contentEditable: el.getAttribute('contenteditable'),
            value: el.value || el.innerText || '',
            className: el.className || ''
          }));
        return JSON.stringify(inputs);
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
