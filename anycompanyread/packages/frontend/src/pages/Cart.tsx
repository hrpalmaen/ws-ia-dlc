import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';

/** Shopping cart: item table, quantity controls, remove dialog, and checkout. */
export function Cart() {
  const navigate = useNavigate();
  const { items, totalPrice, updateQuantity, removeItem, checkout, loading } =
    useCart();
  const [checkingOut, setCheckingOut] = useState(false);

  const handleQuantity = async (bookId: string, next: number) => {
    if (next < 1) return;
    try {
      await updateQuantity(bookId, next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update quantity.');
    }
  };

  const handleRemove = async (bookId: string, title: string) => {
    try {
      await removeItem(bookId);
      toast.success(`Removed "${title}" from cart.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove item.');
    }
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      await checkout();
      toast.success('Order placed! Thank you for your purchase.');
      navigate('/orders');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setCheckingOut(false);
    }
  };

  if (!loading && items.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed p-12 text-center">
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Your cart is empty</h2>
        <p className="mt-1 text-muted-foreground">
          Browse the catalog and add some books.
        </p>
        <Button asChild className="mt-4">
          <Link to="/books">Browse books</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Cart</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.bookId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={item.coverImageUrl}
                          alt={item.title}
                          className="h-16 w-11 rounded object-cover"
                        />
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.author}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantity(item.bookId, item.quantity - 1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantity(item.bookId, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(item.price * item.quantity)}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove "{item.title}" from your cart?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemove(item.bookId, item.title)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(totalPrice)}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={checkingOut}
            >
              {checkingOut ? 'Placing order...' : 'Checkout'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
