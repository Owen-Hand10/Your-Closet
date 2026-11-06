const CLOSET_KEY = 'your-closet.items.v1';
const LOOKS_KEY = 'your-closet.looks.v1';

function readCollection(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function writeCollection(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const loadItems = () => readCollection(CLOSET_KEY);
export const saveItems = (items) => writeCollection(CLOSET_KEY, items);
export const loadLooks = () => readCollection(LOOKS_KEY);
export const saveLooks = (looks) => writeCollection(LOOKS_KEY, looks);

export function createUserProfile(preferences = {}) {
  return {
    sizing: preferences.sizing ?? null,
    fitPreferences: preferences.fitPreferences ?? null,
    region: preferences.region ?? null,
    currency: preferences.currency ?? null,
    budget: preferences.budget ?? null,
  };
}