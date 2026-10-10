import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Star, ShoppingCart, ArrowLeft, BookOpen, Calendar } from 'lucide-react';
import type { Book } from '@anycompanyread/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';

/** Single book detail page with full metadata and an add-to-cart action. */
export function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    api
      .getBook(bookId)
      .then((res) => setBook(res.book))
      .catch(() => setBook(null))
      .finally(() => setLoading(false));
  }, [bookId]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.info('Please log in to add items to your cart.');
      navigate('/login');
      return;
    }
    if (!book) return;
    setAdding(true);
    try {
      await addToCart(book.bookId, 1);
      toast.success(`Added "${book.title}" to your cart.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add to cart.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-8 md:grid-cols-[300px_1fr]">
        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">Book not found.</p>
        <Button asChild variant="link" className="mt-2">
          <Link to="/books">Back to catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-8 md:grid-cols-[300px_1fr]">
        <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted shadow-md">
          <img
            src={book.coverImageUrl}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="space-y-4">
          <Badge variant="secondary">{book.genre}</Badge>
          <h1 className="text-3xl font-bold">{book.title}</h1>
          <p className="text-xl text-muted-foreground">by {book.author}</p>

          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {book.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {book.pageCount} pages
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {book.publishedYear}
            </span>
          </div>

          <p className="leading-relaxed text-foreground/90">{book.description}</p>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-3xl font-bold text-primary">
                  {formatPrice(book.price)}
                </p>
              </div>
              <Button size="lg" onClick={handleAddToCart} disabled={adding}>
                <ShoppingCart className="h-5 w-5" />
                {adding ? 'Adding...' : 'Add to Cart'}
              </Button>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">ISBN: {book.isbn}</p>
        </div>
      </div>
    </div>
  );
}
