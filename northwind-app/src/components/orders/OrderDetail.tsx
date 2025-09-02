import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Edit, 
  Ship, 
  Printer, 
  ArrowLeft,
  Package,
  User,
  Calendar,
  MapPin,
  DollarSign
} from 'lucide-react'
import { useOrderWithDetails, useOrderManagement } from '@/hooks/useOrders'
import { OrderStatusBadge } from './OrderStatusBadge'
import { OrderSummary } from './OrderSummary'
import { toast } from 'sonner'

interface OrderDetailProps {
  orderId: number
  onEdit?: (orderId: number) => void
  onBack?: () => void
  className?: string
}

export function OrderDetail({ orderId, onEdit, onBack, className = '' }: OrderDetailProps) {
  const { data: orderWithDetails, isLoading, error } = useOrderWithDetails(orderId)
  const { ship, updateStatus, isLoading: isActionLoading } = useOrderManagement()

  const handleShipOrder = async () => {
    try {
      await ship({ orderId, shippedDate: new Date() })
      toast.success('Order shipped successfully')
    } catch (error) {
      toast.error('Failed to ship order')
      console.error('Ship order error:', error)
    }
  }

  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  const formatDateTime = (date?: Date) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !orderWithDetails) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            {error ? `Error: ${error.message}` : 'Order not found'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">Order #{orderWithDetails.order_id}</h1>
            <p className="text-muted-foreground">
              Ordered on {formatDate(orderWithDetails.order_date)}
            </p>
          </div>
          <OrderStatusBadge order={orderWithDetails} />
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {!orderWithDetails.shipped_date && (
            <Button 
              size="sm" 
              onClick={handleShipOrder}
              disabled={isActionLoading}
            >
              <Ship className="h-4 w-4 mr-2" />
              Mark as Shipped
            </Button>
          )}
          <Button 
            size="sm" 
            onClick={() => onEdit?.(orderWithDetails.order_id)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Order
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Order Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(orderWithDetails.order_date)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Required Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(orderWithDetails.required_date)}
                      </div>
                    </div>
                  </div>
                  
                  {orderWithDetails.shipped_date && (
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Shipped Date</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(orderWithDetails.shipped_date)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Customer</div>
                      <div className="text-sm text-muted-foreground">
                        {orderWithDetails.customer_name || orderWithDetails.customer_id}
                      </div>
                    </div>
                  </div>
                  
                  {orderWithDetails.employee_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Sales Rep</div>
                        <div className="text-sm text-muted-foreground">
                          {orderWithDetails.employee_name}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {orderWithDetails.shipper_name && (
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Shipper</div>
                        <div className="text-sm text-muted-foreground">
                          {orderWithDetails.shipper_name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="font-medium mb-2">Ship To</div>
                  <div className="text-sm space-y-1">
                    {orderWithDetails.ship_name && (
                      <div className="font-medium">{orderWithDetails.ship_name}</div>
                    )}
                    {orderWithDetails.ship_address && (
                      <div>{orderWithDetails.ship_address}</div>
                    )}
                    <div>
                      {orderWithDetails.ship_city && `${orderWithDetails.ship_city}, `}
                      {orderWithDetails.ship_region && `${orderWithDetails.ship_region} `}
                      {orderWithDetails.ship_postal_code}
                    </div>
                    {orderWithDetails.ship_country && (
                      <div>{orderWithDetails.ship_country}</div>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="font-medium mb-2">Shipping Cost</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(orderWithDetails.freight)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              {orderWithDetails.order_details && orderWithDetails.order_details.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderWithDetails.order_details.map((detail) => {
                        const lineTotal = detail.unit_price * detail.quantity * (1 - detail.discount)
                        
                        return (
                          <TableRow key={detail.product_id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {detail.product_name || `Product #${detail.product_id}`}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {detail.product_id}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(detail.unit_price)}
                            </TableCell>
                            <TableCell className="text-right">
                              {detail.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {detail.discount > 0 ? (
                                <Badge variant="secondary">
                                  {Math.round(detail.discount * 100)}% off
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(lineTotal)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No items in this order
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          {orderWithDetails.order_details && (
            <OrderSummary 
              orderDetails={orderWithDetails.order_details}
              freight={orderWithDetails.freight}
              showCard={true}
            />
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => onEdit?.(orderWithDetails.order_id)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Order
              </Button>
              
              {!orderWithDetails.shipped_date && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleShipOrder}
                  disabled={isActionLoading}
                >
                  <Ship className="h-4 w-4 mr-2" />
                  Mark as Shipped
                </Button>
              )}
              
              <Button variant="outline" className="w-full justify-start">
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
            </CardContent>
          </Card>

          {/* Order Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Items Count</span>
                <span className="font-medium">
                  {orderWithDetails.order_details?.length || 0}
                </span>
              </div>
              
              {orderWithDetails.total_amount && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Order Value</span>
                  <span className="font-medium">
                    {formatCurrency(orderWithDetails.total_amount)}
                  </span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <OrderStatusBadge order={orderWithDetails} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}