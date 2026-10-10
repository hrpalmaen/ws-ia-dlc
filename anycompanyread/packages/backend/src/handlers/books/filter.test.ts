import { describe, it, expect } from 'vitest';
import type { Book } from '@anycompanyread/shared';
import { filterBooks } from './filter';

function makeBook(partial: Partial<Book>): Book {
  return {
    bookId: 'id',
    title: 'Title',
    author: 'Author',
    isbn: '000',
    genre: 'Fiction',
    description: '',
    price: 10,
    coverImageUrl: '',
    rating: 4,
    pageCount: 100,
    publishedYear: 2020,
    createdAt: '2020-01-01T00:00:00Z',
    ...partial,
  };
}

const catalog: Book[] = [
  makeBook({ bookId: '1', title: 'Dune', author: 'Frank Herbert', genre: 'Science Fiction' }),
  makeBook({ bookId: '2', title: 'Clean Code', author: 'Robert Martin', genre: 'Technology' }),
  makeBook({ bookId: '3', title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy' }),
  makeBook({ bookId: '4', title: 'Atomic Habits', author: 'James Clear', genre: 'Self-Help' }),
];

describe('backend/books/filterBooks', () => {
  it('returns all books sorted by title when no filters are given', () => {
    const result = filterBooks(catalog);
    expect(result.map((b) => b.title)).toEqual([
      'Atomic Habits',
      'Clean Code',
      'Dune',
      'The Hobbit',
    ]);
  });

  it('filters by genre', () => {
    const result = filterBooks(catalog, undefined, 'Technology');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Clean Code');
  });

  it('treats genre "all" as no genre filter', () => {
    expect(filterBooks(catalog, undefined, 'all')).toHaveLength(4);
  });

  it('searches by title (case-insensitive)', () => {
    const result = filterBooks(catalog, 'dune');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Dune');
  });

  it('searches by author', () => {
    const result = filterBooks(catalog, 'tolkien');
    expect(result).toHaveLength(1);
    expect(result[0].author).toBe('J.R.R. Tolkien');
  });

  it('combines search and genre filters', () => {
    const result = filterBooks(catalog, 'code', 'Technology');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Clean Code');
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterBooks(catalog, 'nonexistent')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const copy = [...catalog];
    filterBooks(catalog, 'dune');
    expect(catalog).toEqual(copy);
  });
});
