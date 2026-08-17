import '@testing-library/jest-dom';

const memoryStore = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem(key: string) {
      return memoryStore.has(key) ? memoryStore.get(key)! : null;
    },
    setItem(key: string, value: string) {
      memoryStore.set(key, value);
    },
    removeItem(key: string) {
      memoryStore.delete(key);
    },
    clear() {
      memoryStore.clear();
    },
    key(index: number) {
      const keys = [...memoryStore.keys()];
      return keys[index] ?? null;
    },
    get length() {
      return memoryStore.size;
    },
  },
  configurable: true,
});

if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  HTMLElement.prototype.scrollIntoView = function () {
    /* noop — jsdom stub for chat auto-scroll */
  };
}