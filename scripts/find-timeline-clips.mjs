import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const timelineItems = Array.from(document.querySelectorAll('[class*="clip"], [class*="track"], [class*="timeline"], [class*="segment"], [class*="cell"]'))
          .map((el, i) => ({
            index: i,
            tag: el.tagName,
            class: el.className,
            text: (el.innerText || '').slice(0, 40),
            rect: el.getBoundingClientRect()
          }))
          .filter(el => el.rect.width > 20 && el.rect.height > 10);
        return JSON.stringify(timelineItems.slice(0, 30));
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
