// Keyboard and pointer input. Held keys give a steering direction; the mouse
// steers the ship toward the pointer's x (and y, within the ship's band).
// One-shot presses (start, restart, pause, fire) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or
// counted twice. Firing is held: mouse down or Space held keeps shooting.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const FIRE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target, toField) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let firing = false;
  let actions = 0;
  let pointerX = null;
  let pointerY = null;
  let pointerActive = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (FIRE.has(event.code)) {
      firing = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (FIRE.has(event.code)) firing = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
    firing = false;
    pointerActive = false;
  });

  target.addEventListener('pointermove', (event) => {
    const point = toField(event.clientX, event.clientY);
    pointerX = point.x;
    pointerY = point.y;
    pointerActive = true;
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    pointerX = point.x;
    pointerY = point.y;
    pointerActive = true;
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    firing = false;
  });
  target.addEventListener('pointerleave', () => {
    pointerActive = false;
  });

  return {
    /** -1/0/1 on each axis, from the held keys. */
    direction() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },
    /** Pointer target in field coordinates, or null when the mouse is away. */
    pointer() {
      if (!pointerActive) return null;
      return { x: pointerX, y: pointerY };
    },
    isFiring() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
