import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Book } from '@anycompanyread/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

/** A single book catalog card with cover, title, author, rating, and price. */
export function BookCard({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.bookId}`} className="group">
      <Card className="overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col">
        <div className="aspect-[2/3] overflow-hidden bg-muted">
          <img
            src={book.coverImageUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <CardContent className="flex flex-1 flex-col gap-1 p-4">
          <Badge variant="secondary" className="w-fit mb-1">
            {book.genre}
          </Badge>
          <h3 className="font-semibold leading-tight line-clamp-2">{book.title}</h3>
          <p className="text-sm text-muted-foreground">{book.author}</p>
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="font-bold text-primary">
              {formatPrice(book.price)}
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {book.rating.toFixed(1)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
