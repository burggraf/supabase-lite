import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Ship, 
  Calendar, 
  DollarSign, 
  Truck,
  CheckCircle,
  Clock
} from 'lucide-react'
import { Order } from '@/lib/database/repositories'
import { OrderStatusBadge } from './OrderStatusBadge'
import { useOrderManagement } from '@/hooks/useOrders'
import { toast } from 'sonner'

interface OrderStatusProps {
  order: Order
  onUpdate?: () => void
  className?: string
}

export function OrderStatus({ order, onUpdate, className = '' }: OrderStatusProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [requiredDate, setRequiredDate] = useState(
    order.required_date ? order.required_date.toISOString().split('T')[0] : ''
  )
  const [shippedDate, setShippedDate] = useState(
    order.shipped_date ? order.shipped_date.toISOString().split('T')[0] : ''
  )
  const [freight, setFreight] = useState(order.freight || 0)
  const [shipVia, setShipVia] = useState(order.ship_via?.toString() || '')

  const { updateStatus, ship, isLoading } = useOrderManagement()

  const formatDate = (date?: Date) => {
    if (!date) return 'Not set'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
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

  const handleSave = async () => {
    try {
      await updateStatus({
        orderId: order.order_id,
        requiredDate: requiredDate ? new Date(requiredDate) : undefined,
        shippedDate: shippedDate ? new Date(shippedDate) : null,
        freight,
        shipVia: shipVia ? parseInt(shipVia) : undefined
      })

      toast.success('Order status updated successfully')
      setIsEditing(false)
      onUpdate?.()
    } catch (error) {
      toast.error('Failed to update order status')
      console.error('Update order status error:', error)
    }
  }

  const handleCancel = () => {
    // Reset form values
    setRequiredDate(order.required_date ? order.required_date.toISOString().split('T')[0] : '')
    setShippedDate(order.shipped_date ? order.shipped_date.toISOString().split('T')[0] : '')
    setFreight(order.freight || 0)
    setShipVia(order.ship_via?.toString() || '')
    setIsEditing(false)
  }

  const handleShipNow = async () => {
    try {
      await ship({ orderId: order.order_id, shippedDate: new Date() })
      toast.success('Order marked as shipped')
      onUpdate?.()
    } catch (error) {
      toast.error('Failed to ship order')
      console.error('Ship order error:', error)
    }
  }

  const getStatusIcon = () => {
    if (order.shipped_date) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    }
    
    if (order.required_date && new Date() > order.required_date) {
      return <Clock className="h-5 w-5 text-red-600" />
    }
    
    return <Clock className="h-5 w-5 text-yellow-600" />
  }

  const getStatusDescription = () => {
    if (order.shipped_date) {
      return `Shipped on ${formatDate(order.shipped_date)}`
    }
    
    if (order.required_date) {
      const isOverdue = new Date() > order.required_date
      return isOverdue 
        ? `Overdue (required ${formatDate(order.required_date)})`
        : `Due ${formatDate(order.required_date)}`
    }
    
    return 'Pending - no required date set'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            Order Status
          </div>
          <OrderStatusBadge order={order} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status Display */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Current Status:</span>
            <span className="font-medium">{getStatusDescription()}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Freight Cost:</span>
            <span className="font-medium">{formatCurrency(order.freight)}</span>
          </div>
        </div>

        {/* Quick Actions */}
        {!isEditing && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Update Status
            </Button>
            
            {!order.shipped_date && (
              <Button
                size="sm"
                onClick={handleShipNow}
                disabled={isLoading}
              >
                <Ship className="h-4 w-4 mr-2" />
                Ship Now
              </Button>
            )}
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium flex items-center gap-2">
              <Ship className="h-4 w-4" />
              Update Order Status
            </h4>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="required-date">Required Date</Label>
                <Input
                  id="required-date"
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipped-date">Shipped Date</Label>
                <Input
                  id="shipped-date"
                  type="date"
                  value={shippedDate}
                  onChange={(e) => setShippedDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if not shipped yet
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="freight">Freight Cost</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="freight"
                    type="number"
                    step="0.01"
                    min="0"
                    value={freight}
                    onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipper">Shipper</Label>
                <Select value={shipVia} onValueChange={setShipVia}>
                  <SelectTrigger id="shipper">
                    <SelectValue placeholder="Select shipper" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No shipper selected</SelectItem>
                    <SelectItem value="1">Speedy Express</SelectItem>
                    <SelectItem value="2">United Package</SelectItem>
                    <SelectItem value="3">Federal Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                size="sm"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Status Timeline */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="font-medium text-sm">Order Timeline</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              <span className="text-muted-foreground">Ordered:</span>
              <span>{formatDate(order.order_date)}</span>
            </div>
            
            {order.required_date && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-600"></div>
                <span className="text-muted-foreground">Required:</span>
                <span>{formatDate(order.required_date)}</span>
              </div>
            )}
            
            {order.shipped_date ? (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                <span className="text-muted-foreground">Shipped:</span>
                <span>{formatDate(order.shipped_date)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-300 border-2 border-gray-400"></div>
                <span className="text-muted-foreground">Pending shipment</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}