/**
 * Seed script — populates the Books DynamoDB table with a sample catalog
 * so the demo has content immediately after deploy.
 *
 * Usage:
 *   BOOKS_TABLE=AnyCompanyRead-Books npx ts-node scripts/seed-data.ts
 *   (or `npm run seed` from this package)
 *
 * Cover images use Picsum placeholders (seeded for stable images per book).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import type { Book } from '@anycompanyread/shared';

const TABLE = process.env.BOOKS_TABLE || 'AnyCompanyRead-Books';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type SeedBook = Omit<Book, 'bookId' | 'createdAt' | 'coverImageUrl'>;

const seed: SeedBook[] = [
  {
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt & David Thomas',
    isbn: '978-0135957059',
    genre: 'Technology',
    description:
      'A classic guide to software craftsmanship, covering practical techniques for writing better code and growing as a developer.',
    price: 42.99,
    rating: 4.8,
    pageCount: 352,
    publishedYear: 2019,
  },
  {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '978-0132350884',
    genre: 'Technology',
    description:
      'A handbook of agile software craftsmanship that teaches principles for writing readable, maintainable code.',
    price: 39.99,
    rating: 4.7,
    pageCount: 464,
    publishedYear: 2008,
  },
  {
    title: 'Dune',
    author: 'Frank Herbert',
    isbn: '978-0441013593',
    genre: 'Science Fiction',
    description:
      'An epic saga of politics, religion, and survival on the desert planet Arrakis — one of the greatest science fiction novels ever written.',
    price: 18.99,
    rating: 4.9,
    pageCount: 688,
    publishedYear: 1965,
  },
  {
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    isbn: '978-0547928227',
    genre: 'Fantasy',
    description:
      'Bilbo Baggins embarks on an unexpected journey to help a group of dwarves reclaim their mountain home from the dragon Smaug.',
    price: 14.99,
    rating: 4.8,
    pageCount: 310,
    publishedYear: 1937,
  },
  {
    title: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    isbn: '978-0062316097',
    genre: 'History',
    description:
      'A sweeping narrative of human history, from the emergence of Homo sapiens to the present day.',
    price: 24.99,
    rating: 4.6,
    pageCount: 464,
    publishedYear: 2015,
  },
  {
    title: 'Gone Girl',
    author: 'Gillian Flynn',
    isbn: '978-0307588371',
    genre: 'Mystery',
    description:
      'A gripping psychological thriller about a marriage gone terribly wrong and the disappearance of Amy Dunne.',
    price: 16.99,
    rating: 4.4,
    pageCount: 432,
    publishedYear: 2012,
  },
  {
    title: 'Atomic Habits',
    author: 'James Clear',
    isbn: '978-0735211292',
    genre: 'Self-Help',
    description:
      'An easy and proven way to build good habits and break bad ones, with practical strategies for lasting change.',
    price: 21.99,
    rating: 4.8,
    pageCount: 320,
    publishedYear: 2018,
  },
  {
    title: 'Educated',
    author: 'Tara Westover',
    isbn: '978-0399590504',
    genre: 'Biography',
    description:
      'A memoir about a woman who grows up in a survivalist family and eventually earns a PhD from Cambridge University.',
    price: 19.99,
    rating: 4.7,
    pageCount: 352,
    publishedYear: 2018,
  },
  {
    title: 'The Midnight Library',
    author: 'Matt Haig',
    isbn: '978-0525559474',
    genre: 'Fiction',
    description:
      'Between life and death there is a library, and within it, the chance to try the lives you could have lived.',
    price: 17.99,
    rating: 4.5,
    pageCount: 304,
    publishedYear: 2020,
  },
  {
    title: 'Where the Crawdads Sing',
    author: 'Delia Owens',
    isbn: '978-0735219090',
    genre: 'Fiction',
    description:
      'A coming-of-age story and murder mystery set in the marshes of North Carolina.',
    price: 15.99,
    rating: 4.6,
    pageCount: 384,
    publishedYear: 2018,
  },
  {
    title: 'The Very Hungry Caterpillar',
    author: 'Eric Carle',
    isbn: '978-0399226908',
    genre: 'Children',
    description:
      'A beloved picture book following a caterpillar as it eats its way to becoming a beautiful butterfly.',
    price: 9.99,
    rating: 4.9,
    pageCount: 32,
    publishedYear: 1969,
  },
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    isbn: '978-0374533557',
    genre: 'Non-Fiction',
    description:
      'A Nobel laureate explores the two systems that drive the way we think and make decisions.',
    price: 22.99,
    rating: 4.5,
    pageCount: 499,
    publishedYear: 2011,
  },
];

async function main(): Promise<void> {
  console.log(`Seeding ${seed.length} books into table "${TABLE}"...`);

  const now = new Date().toISOString();
  const books: Book[] = seed.map((b) => {
    const bookId = randomUUID();
    return {
      ...b,
      bookId,
      createdAt: now,
      // Stable placeholder cover per book (seeded by bookId).
      coverImageUrl: `https://picsum.photos/seed/${bookId}/300/450`,
    };
  });

  // BatchWrite handles up to 25 items per request.
  for (let i = 0; i < books.length; i += 25) {
    const chunk = books.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      })
    );
  }

  console.log(`✅ Seeded ${books.length} books successfully.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
