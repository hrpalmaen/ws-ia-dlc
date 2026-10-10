import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import type { Book } from '@anycompanyread/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookCard } from '@/components/BookCard';

/** Landing page: hero section + a grid of featured books. */
export function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listBooks()
      .then((res) => setBooks(res.books.slice(0, 8)))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 md:p-16 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <BookOpen className="h-4 w-4" />
            Discover your next great read
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Books for every reader
          </h1>
          <p className="text-lg text-muted-foreground">
            Explore a curated catalog of fiction, technology, history and more —
            all in one beautifully simple bookstore.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link to="/books">
              Browse the catalog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Featured books */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Featured Books</h2>
          <Button asChild variant="link">
            <Link to="/books">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((book) => (
              <BookCard key={book.bookId} book={book} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
