'use client';

const SEARCH_HISTORY_KEY = 'locostock_recent_searches';
const MAX_HISTORY_ITEMS = 10;

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch (err) {
    console.error('Error reading search history:', err);
    return [];
  }
}

export function addRecentSearch(query: string): string[] {
  if (typeof window === 'undefined') return [];
  const clean = query.trim();
  if (!clean) return getRecentSearches();

  try {
    const current = getRecentSearches();
    const filtered = current.filter(item => item.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error saving search history:', err);
    return [];
  }
}

export function removeRecentSearch(query: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getRecentSearches();
    const updated = current.filter(item => item.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error removing from search history:', err);
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing search history:', err);
  }
}
