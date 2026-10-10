import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import type { Order, OrderDetail } from '@anycompanyread/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatPrice, formatDate } from '@/lib/utils';

/** Order history list + expandable order detail (FR-3.9, FR-3.10). */
export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api
      .listOrders()
      .then((res) => setOrders(res.orders))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const openOrder = async (orderId: string) => {
    setDetailLoading(true);
    try {
      const detail = await api.getOrder(orderId);
      setSelected(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed p-12 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No orders yet</h2>
        <p className="mt-1 text-muted-foreground">
          When you place an order, it will appear here.
        </p>
        <Button asChild className="mt-4">
          <Link to="/books">Browse books</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Orders</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.orderId}
                  className="cursor-pointer"
                  onClick={() => openOrder(order.orderId)}
                >
                  <TableCell className="font-mono text-xs">
                    #{order.orderId.slice(0, 8)}
                  </TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>{order.itemCount}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(order.totalPrice)}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selected order detail */}
      {detailLoading && <Skeleton className="h-40 w-full" />}
      {selected && !detailLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Order #{selected.order.orderId.slice(0, 8)}</CardTitle>
            <CardDescription>
              Placed {formatDate(selected.order.createdAt)} ·{' '}
              <Badge variant="secondary">{selected.order.status}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selected.items.map((item) => (
                <div key={item.bookId} className="flex items-center gap-3">
                  <img
                    src={item.coverImageUrl}
                    alt={item.title}
                    className="h-16 w-11 rounded object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3 font-bold">
                <span>Total</span>
                <span className="text-primary">
                  {formatPrice(selected.order.totalPrice)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
