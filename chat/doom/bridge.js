// The network, for a Doom that thinks it is talking to a WebSocket relay.
//
// cloudflare/doom-wasm sends every packet through one WebSocket as [to uid][from uid][payload],
// and receives [from uid][payload]. That framing is all a relay does, so the page embedding
// this game can be the relay: this file replaces `WebSocket` with a stand-in that hands each
// outgoing frame to the parent window and delivers whatever the parent sends back. The parent
// carries them over WebRTC data channels to the other players.
//
//   parent → game   { type: 'doom:packet', data: ArrayBuffer }   [from][payload]
//   game → parent   { type: 'doom:packet', data: ArrayBuffer }   [to][from][payload]
//   game → parent   { type: 'doom:status', code, text }          doom's "doom: N, …" stdout lines
//
// Emscripten's glue constructs this with `new WebSocket(url)` and reads readyState, binaryType
// and the on* handlers, so a plain object with those fields is enough — returned from a
// function called with `new`, which JavaScript permits.
(() => {
  const parentOrigin = location.origin;
  const sockets = new Set();

  window.addEventListener('message', (event) => {
    if (event.origin !== parentOrigin || event.source !== window.parent) return;
    const message = event.data;
    if (message?.type !== 'doom:packet' || !(message.data instanceof ArrayBuffer)) return;
    sockets.forEach((socket) => socket.onmessage?.({ data: message.data }));
  });

  const RelaySocket = function (url) {
    const socket = {
      url,
      readyState: 0,
      binaryType: 'arraybuffer',
      protocol: '',
      extensions: '',
      bufferedAmount: 0,
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      send: (view) => {
        // A view into the wasm heap: copy it out before the heap moves on.
        const bytes = view instanceof ArrayBuffer ? view.slice(0) : view.slice().buffer;
        window.parent.postMessage({ type: 'doom:packet', data: bytes }, parentOrigin, [bytes]);
      },
      close: () => {
        socket.readyState = 3;
        sockets.delete(socket);
        socket.onclose?.({ wasClean: true, code: 1000, reason: '' });
      },
    };
    sockets.add(socket);
    // Open on the next tick, the way a real socket would, after handlers are attached.
    setTimeout(() => {
      socket.readyState = 1;
      socket.onopen?.({});
    }, 0);
    return socket;
  };
  RelaySocket.CONNECTING = 0;
  RelaySocket.OPEN = 1;
  RelaySocket.CLOSING = 2;
  RelaySocket.CLOSED = 3;
  window.WebSocket = RelaySocket;

  window.doomStatus = (text) => {
    const match = /^doom: (\d+), (.*)$/.exec(String(text));
    if (match) window.parent.postMessage({ type: 'doom:status', code: Number(match[1]), text: match[2] }, parentOrigin);
  };
})();
