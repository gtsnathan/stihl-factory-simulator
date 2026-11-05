import { GAME } from '../config.js';

export function save(s) {
  try { localStorage.setItem(GAME.saveKey, JSON.stringify({ at: Date.now(), state: s })); return true; } catch { return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.state && d.state.v === 1 ? d : null;
  } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(GAME.saveKey); } catch { /* armazenamento bloqueado */ } }
