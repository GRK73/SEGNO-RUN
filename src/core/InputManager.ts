export const InputType = {
  KEYBOARD_ANY: 'KEYBOARD_ANY',
  KEYBOARD_UP: 'KEYBOARD_UP',
  MOUSE_CLICK: 'MOUSE_CLICK',
  MOUSE_UP: 'MOUSE_UP',
  WHEEL_UP: 'WHEEL_UP',
  WHEEL_DOWN: 'WHEEL_DOWN',
} as const;

export type InputType = typeof InputType[keyof typeof InputType];

export type InputCallback = (type: InputType) => void;

export class InputManager {
  private static instance: InputManager;
  private callbacks: InputCallback[] = [];
  private lastWheelTime: number = 0;
  private readonly WHEEL_DEBOUNCE = 150;

  private constructor() {}

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  public init(_container: HTMLElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;
    this.trigger(InputType.KEYBOARD_ANY);
  };

  private handleKeyUp = (_e: KeyboardEvent) => {
    this.trigger(InputType.KEYBOARD_UP);
  };

  private handleMouseDown = (_e: MouseEvent) => {
    this.trigger(InputType.MOUSE_CLICK);
  };

  private handleMouseUp = (_e: MouseEvent) => {
    this.trigger(InputType.MOUSE_UP);
  };

  private handleWheel = (e: WheelEvent) => {
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    if (now - this.lastWheelTime < this.WHEEL_DEBOUNCE) return;
    if (e.deltaY < 0) this.trigger(InputType.WHEEL_UP);
    else if (e.deltaY > 0) this.trigger(InputType.WHEEL_DOWN);
    this.lastWheelTime = now;
  };

  private trigger(type: InputType) {
    this.callbacks.forEach(cb => cb(type));
  }

  public onInput(callback: InputCallback) {
    this.callbacks.push(callback);
  }

  public destroy(_container: HTMLElement) {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    this.callbacks = [];
  }
}
