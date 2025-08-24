import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card'
import { Skeleton } from '../../../ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table'
import { Badge } from '../../../ui/badge'
import { useNorthwindData } from '../../../../hooks/useNorthwindData'
import { ShoppingCart, Calendar, User, DollarSign } from 'lucide-react'

export default function Orders() {
  const { orders, ordersLoading, error } = useNorthwindData()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <ShoppingCart className="h-8 w-8 mr-3 text-green-600" />
            Orders
          </h1>
          <p className="text-muted-foreground">
            Track and manage customer orders
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : orders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Ship Country</TableHead>
                  <TableHead className="text-right">Freight</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell className="font-medium">
                      #{order.order_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-muted-foreground" />
                        {order.customer_name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.employee_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(order.order_date)}
                      </div>
                    </TableCell>
                    <TableCell>{order.ship_country}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                        {formatCurrency(order.freight)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={order.shipped_date ? "default" : "secondary"}>
                        {order.shipped_date ? 'Shipped' : 'Processing'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No orders found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}