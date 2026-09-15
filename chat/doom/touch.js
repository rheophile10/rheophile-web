// Touch controls for phones: a joystick under the left thumb, Fire and Use under the right.
//
// The engine only understands keyboard input, so every control here is a key held down and let
// go — dispatched as the same KeyboardEvents a keyboard would produce, which SDL maps through the
// scancodes in default.cfg (W/S move, arrows turn, Shift runs, Space fires, E uses).
//
// The joystick is "floating": it appears wherever the left thumb lands, so nobody has to find a
// fixed spot without looking. Pushing up or down walks, left or right turns, and pushing past
// most of the radius runs. Everything is translucent and pressed to the edges, because the
// middle of the screen is the game.
(() => {
  const KEYS = {
    forward: { key: 'w', code: 'KeyW', keyCode: 87 },
    back: { key: 's', code: 'KeyS', keyCode: 83 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    run: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
    fire: { key: ' ', code: 'Space', keyCode: 32 },
    use: { key: 'e', code: 'KeyE', keyCode: 69 },
    menu: { key: 'Escape', code: 'Escape', keyCode: 27 },
    enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
  };

  const held = new Set();
  /** When each key went down. Doom samples input 35 times a second, so a tap shorter than a
   *  couple of tics would be pressed and released between two samples and never seen. */
  const downAt = new Map();
  const MIN_HOLD_MS = 70;

  const dispatch = (type, name) => {
    const { key, code, keyCode } = KEYS[name];
    const event = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
    // keyCode and which cannot be set through the constructor, and SDL still reads them.
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    Object.defineProperty(event, 'which', { get: () => keyCode });
    window.dispatchEvent(event);
  };

  const press = (name) => {
    if (held.has(name)) return;
    held.add(name);
    downAt.set(name, performance.now());
    dispatch('keydown', name);
  };
  const release = (name) => {
    if (!held.has(name)) return;
    const wait = MIN_HOLD_MS - (performance.now() - (downAt.get(name) ?? 0));
    if (wait > 0) return void setTimeout(() => release(name), wait);
    held.delete(name);
    dispatch('keyup', name);
  };
  const setHeld = (name, on) => (on ? press(name) : release(name));
  const releaseAll = () => [...held].forEach(release);

  const build = () => {
    const layer = document.createElement('div');
    layer.id = 'touch';
    layer.innerHTML = `
      <div class="stick-zone" data-zone="stick"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <button class="tbtn tbtn-use" data-key="use" aria-label="Use">USE</button>
      <button class="tbtn tbtn-fire" data-key="fire" aria-label="Fire">FIRE</button>
      <button class="tbtn tbtn-menu" data-key="menu" aria-label="Menu">☰</button>
      <div class="rotate-hint">Turn your phone sideways to play</div>`;
    document.body.append(layer);
    return layer;
  };

  const attachStick = (zone) => {
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    let touchId = null;
    let origin = { x: 0, y: 0 };
    const radius = () => base.offsetWidth / 2;

    const apply = (dx, dy) => {
      const r = radius();
      const distance = Math.min(Math.hypot(dx, dy), r);
      const angle = Math.atan2(dy, dx);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      const dead = r * 0.28;
      setHeld('forward', y < -dead);
      setHeld('back', y > dead);
      setHeld('left', x < -dead);
      setHeld('right', x > dead);
      setHeld('run', distance > r * 0.85 && Math.abs(y) > dead);
    };

    const end = () => {
      touchId = null;
      base.classList.remove('active');
      knob.style.transform = '';
      ['forward', 'back', 'left', 'right', 'run'].forEach(release);
    };

    zone.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (touchId !== null) return;
      const touch = event.changedTouches[0];
      touchId = touch.identifier;
      const box = zone.getBoundingClientRect();
      origin = { x: touch.clientX, y: touch.clientY };
      base.style.left = `${touch.clientX - box.left}px`;
      base.style.top = `${touch.clientY - box.top}px`;
      base.classList.add('active');
      apply(0, 0);
    }, { passive: false });

    zone.addEventListener('touchmove', (event) => {
      event.preventDefault();
      const touch = [...event.changedTouches].find((t) => t.identifier === touchId);
      if (touch) apply(touch.clientX - origin.x, touch.clientY - origin.y);
    }, { passive: false });

    ['touchend', 'touchcancel'].forEach((type) =>
      zone.addEventListener(type, (event) => {
        if ([...event.changedTouches].some((t) => t.identifier === touchId)) end();
      }),
    );
  };

  const attachButtons = (layer) =>
    layer.querySelectorAll('[data-key]').forEach((button) => {
      const name = button.dataset.key;
      const down = (event) => {
        event.preventDefault();
        button.classList.add('down');
        press(name);
        // The menu key also confirms, so the in-game menu is usable by touch alone.
        if (name === 'menu') setTimeout(() => release(name), 80);
      };
      const up = (event) => {
        event.preventDefault();
        button.classList.remove('down');
        if (name !== 'menu') release(name);
      };
      button.addEventListener('touchstart', down, { passive: false });
      button.addEventListener('touchend', up, { passive: false });
      button.addEventListener('touchcancel', up, { passive: false });
    });

  const start = () => {
    if (document.getElementById('touch')) return;
    const layer = build();
    attachStick(layer.querySelector('[data-zone="stick"]'));
    attachButtons(layer);
    document.documentElement.classList.add('touch');
  };

  const remove = () => {
    releaseAll();
    document.getElementById('touch')?.remove();
    document.documentElement.classList.remove('touch');
  };

  // Only on a real touch device with no mouse — a phone or tablet, not a touchscreen laptop and
  // never a desktop. `#touch=1` forces them on for testing.
  const isTouchDevice = () => matchMedia('(pointer: coarse) and (hover: none)').matches;
  const forced = () => new URLSearchParams(location.hash.slice(1)).get('touch') === '1';
  const update = () => (isTouchDevice() || forced() ? start() : remove());
  update();
  // A tablet can gain or lose a mouse, or rotate between layouts, so re-check.
  matchMedia('(pointer: coarse) and (hover: none)').addEventListener?.('change', update);
  // A key stuck down after the page loses focus would keep a player running into a wall.
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());

  window.doomTouch = { press, release, releaseAll };
})();
