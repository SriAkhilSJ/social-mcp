import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9333/devtools/page/58981C7FE1D48B3F02EAA4F32B96E02D');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const editor = document.querySelector('.prompt-input, .prosemirror-editor, .ProseMirror');
        if (!editor) return 'no editor';
        editor.click();
        const pm = document.querySelector('.ProseMirror');
        return {
          clicked: true,
          contentEditable: pm ? pm.getAttribute('contenteditable') : null
        };
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
