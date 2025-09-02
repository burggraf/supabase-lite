import { useState } from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Eye, 
  Edit, 
  Trash2, 
  Ship, 
  MoreHorizontal, 
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react'
import { useOrders, useOrderManagement } from '@/hooks/useOrders'
import { OrderSearchFilters, type Order } from '@/lib/database/repositories'
import { OrderStatusBadge } from './OrderStatusBadge'
import { OrderFilters } from './OrderFilters'
import { toast } from 'sonner'

interface OrderTableProps {
  onViewOrder?: (order: Order) => void
  onEditOrder?: (order: Order) => void
  onCreateOrder?: () => void
}

export function OrderTable({ onViewOrder, onEditOrder, onCreateOrder }: OrderTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<OrderSearchFilters>({})
  const [sortField, setSortField] = useState<keyof Order>('order_id')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC')
  
  const pageSize = 20

  const { data: ordersData, isLoading, error } = useOrders({
    pagination: { page: currentPage, limit: pageSize },
    search: searchQuery ? {
      query: searchQuery,
      fields: ['customer_id', 'ship_name', 'ship_city', 'ship_country']
    } : undefined,
    filters,
    sort: [{ field: sortField, direction: sortDirection }]
  })

  const { ship, delete: deleteOrder, isLoading: isActionLoading } = useOrderManagement()

  const orders = ordersData?.data || []
  const totalPages = ordersData?.totalPages || 0
  const total = ordersData?.total || 0

  const handleSort = (field: keyof Order) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortField(field)
      setSortDirection('ASC')
    }
  }

  const handleShipOrder = async (orderId: number) => {
    try {
      await ship({ orderId, shippedDate: new Date() })
      toast.success('Order shipped successfully')
    } catch (error) {
      toast.error('Failed to ship order')
      console.error('Ship order error:', error)
    }
  }

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to delete this order?')) {
      return
    }

    try {
      await deleteOrder(orderId)
      toast.success('Order deleted successfully')
    } catch (error) {
      toast.error('Failed to delete order')
      console.error('Delete order error:', error)
    }
  }

  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handleFiltersChange = (newFilters: OrderSearchFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
    setCurrentPage(1)
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load orders: {error.message}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders by customer, ship name, city, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={onCreateOrder} className="shrink-0">
            Create Order
          </Button>
        </div>

        {/* Filters */}
        <OrderFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={clearFilters}
        />
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total > 0 ? `${total} order${total === 1 ? '' : 's'} found` : 'No orders found'}
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders found matching your criteria.
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('order_id')}
                          className="h-auto p-0 font-semibold"
                        >
                          Order #
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('customer_id')}
                          className="h-auto p-0 font-semibold"
                        >
                          Customer
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('order_date')}
                          className="h-auto p-0 font-semibold"
                        >
                          Order Date
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort('required_date')}
                          className="h-auto p-0 font-semibold"
                        >
                          Required Date
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Ship To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Freight</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.order_id}>
                        <TableCell className="font-medium">
                          #{order.order_id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customer_id}</div>
                            {order.ship_name && (
                              <div className="text-sm text-muted-foreground">
                                {order.ship_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(order.order_date)}</TableCell>
                        <TableCell>{formatDate(order.required_date)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {order.ship_city && order.ship_country && (
                              <div>{order.ship_city}, {order.ship_country}</div>
                            )}
                            {order.ship_address && (
                              <div className="text-muted-foreground text-xs">
                                {order.ship_address}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge order={order} />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(order.freight)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onViewOrder?.(order)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEditOrder?.(order)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Order
                              </DropdownMenuItem>
                              {!order.shipped_date && (
                                <DropdownMenuItem 
                                  onClick={() => handleShipOrder(order.order_id)}
                                  disabled={isActionLoading}
                                >
                                  <Ship className="mr-2 h-4 w-4" />
                                  Mark as Shipped
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteOrder(order.order_id)}
                                className="text-red-600"
                                disabled={isActionLoading}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to{' '}
                    {Math.min(currentPage * pageSize, total)} of {total} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = Math.max(1, Math.min(
                          currentPage - 2 + i,
                          totalPages - 4 + i
                        ))
                        return (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        )
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}