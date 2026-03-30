// neutralino-bridge.js
// Stub for web/Vercel builds - only used in Neutralino desktop app
// The actual implementation is only needed when window.NL_MODE is true

export const events = {
  on: () => {},
  off: () => {},
  emit: () => {},
};

export const updater = {
  checkForUpdates: async () => null,
  install: async () => {},
};
