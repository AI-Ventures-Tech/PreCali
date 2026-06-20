// PreCali AI conversation memory.
// In-memory only: Vercel can clear it on cold starts.

const TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGES = 16;

const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (!value || now - value.ts > TTL_MS) store.delete(key);
  }
}

function getHistory(phone) {
  if (!phone) return [];
  cleanup();
  const entry = store.get(String(phone));
  return entry ? entry.history.slice() : [];
}

function saveHistory(phone, history) {
  if (!phone) return;
  cleanup();
  const trimmed = Array.isArray(history) ? history.slice(-MAX_MESSAGES) : [];
  store.set(String(phone), { history: trimmed, ts: Date.now() });
}

function resetHistory(phone) {
  if (!phone) return;
  store.delete(String(phone));
}

module.exports = {
  getHistory,
  saveHistory,
  resetHistory,
};
