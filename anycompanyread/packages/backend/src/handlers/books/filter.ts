import type { Book } from '@anycompanyread/shared';

/**
 * Pure catalog filtering + sorting logic (no AWS dependencies) so it can be
 * unit-tested in isolation. Applies optional genre and search filters and
 * returns books sorted by title.
 */
export function filterBooks(
  books: Book[],
  search?: string,
  genre?: string
): Book[] {
  let result = [...books];

  const g = (genre || '').trim();
  if (g && g.toLowerCase() !== 'all') {
    result = result.filter((b) => b.genre === g);
  }

  const s = (search || '').toLowerCase().trim();
  if (s) {
    result = result.filter(
      (b) =>
        b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s)
    );
  }

  result.sort((a, b) => a.title.localeCompare(b.title));
  return result;
}
