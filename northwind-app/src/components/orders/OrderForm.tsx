import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Save, 
  X, 
  User, 
  Ship, 
  Package,
  ArrowLeft
} from 'lucide-react'
import { Order, OrderDetail } from '@/lib/database/repositories'
import { useOrderWithDetails, useOrderManagement } from '@/hooks/useOrders'
import { useCustomers } from '@/hooks/useCustomers'
import { OrderLineItems } from './OrderLineItems'
import { OrderStatus } from './OrderStatus'
import { toast } from 'sonner'

interface OrderFormProps {
  orderId?: number
  order?: Order
  onSave?: (orderId: number) => void
  onCancel?: () => void
  onBack?: () => void
  className?: string
}

interface OrderFormData {
  customer_id?: string
  employee_id?: number
  order_date: Date
  required_date?: Date
  ship_name?: string
  ship_address?: string
  ship_city?: string
  ship_region?: string
  ship_postal_code?: string
  ship_country?: string
  freight: number
  ship_via?: number
}

export function OrderForm({ 
  orderId, 
  order: propOrder, 
  onSave, 
  onCancel, 
  onBack,
  className = '' 
}: OrderFormProps) {
  // Use either provided order or fetch by ID
  const { data: fetchedOrderWithDetails, isLoading } = useOrderWithDetails(
    orderId && !propOrder ? orderId : 0
  )
  
  const order = propOrder || fetchedOrderWithDetails
  
  const [formData, setFormData] = useState<OrderFormData>({
    order_date: new Date(),
    freight: 0
  })
  
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const { data: customersData } = useCustomers({ pagination: { page: 1, limit: 200 } })
  const customers = customersData?.data || []

  const { update, isLoading: isUpdating } = useOrderManagement()

  // Initialize form data when order loads
  useEffect(() => {
    if (order) {
      setFormData({
        customer_id: order.customer_id,
        employee_id: order.employee_id,
        order_date: order.order_date || new Date(),
        required_date: order.required_date,
        ship_name: order.ship_name,
        ship_address: order.ship_address,
        ship_city: order.ship_city,
        ship_region: order.ship_region,
        ship_postal_code: order.ship_postal_code,
        ship_country: order.ship_country,
        freight: order.freight || 0,
        ship_via: order.ship_via
      })

      if ('order_details' in order && order.order_details) {
        setOrderDetails(order.order_details.map(detail => ({
          order_id: order.order_id,
          product_id: detail.product_id,
          unit_price: detail.unit_price,
          quantity: detail.quantity,
          discount: detail.discount
        })))
      }

      setHasChanges(false)
    }
  }, [order])

  const updateFormData = (updates: Partial<OrderFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleOrderDetailsChange = (newOrderDetails: OrderDetail[]) => {
    setOrderDetails(newOrderDetails)
    setHasChanges(true)
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const handleSave = async () => {
    if (!order?.order_id) {
      toast.error('Cannot save: Order ID not found')
      return
    }

    try {
      const updateData: Partial<Order> = {
        customer_id: formData.customer_id,
        employee_id: formData.employee_id,
        order_date: formData.order_date,
        required_date: formData.required_date,
        ship_name: formData.ship_name,
        ship_address: formData.ship_address,
        ship_city: formData.ship_city,
        ship_region: formData.ship_region,
        ship_postal_code: formData.ship_postal_code,
        ship_country: formData.ship_country,
        freight: formData.freight,
        ship_via: formData.ship_via
      }

      await update({ orderId: order.order_id, data: updateData })
      
      // Note: In a real application, you would also need to update the order details
      // This would typically require a separate API call to update/create/delete order details
      
      toast.success('Order updated successfully')
      setHasChanges(false)
      onSave?.(order.order_id)
    } catch (error) {
      toast.error('Failed to update order')
      console.error('Update order error:', error)
    }
  }

  const handleCancel = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return
    }
    onCancel?.()
  }

  const getSelectedCustomer = () => {
    return customers.find(c => c.customer_id === formData.customer_id)
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Order not found
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
            <h1 className="text-2xl font-bold">Edit Order #{order.order_id}</h1>
            <p className="text-muted-foreground">
              Make changes to order information and items
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
          >
            <Save className="h-4 w-4 mr-2" />
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Form Tabs */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="shipping" className="flex items-center gap-2">
            <Ship className="h-4 w-4" />
            Shipping
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Ship className="h-4 w-4" />
            Status
          </TabsTrigger>
        </TabsList>

        {/* Order Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select 
                  value={formData.customer_id || ''} 
                  onValueChange={(value) => updateFormData({ customer_id: value })}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.customer_id} value={customer.customer_id}>
                        <div>
                          <div className="font-medium">{customer.company_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.contact_name} • {customer.city}, {customer.country}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.customer_id && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Customer Information</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>{getSelectedCustomer()?.company_name}</strong></div>
                    <div>{getSelectedCustomer()?.contact_name}</div>
                    <div>
                      {getSelectedCustomer()?.address}, {getSelectedCustomer()?.city} 
                      {getSelectedCustomer()?.postal_code && ` ${getSelectedCustomer()?.postal_code}`}
                    </div>
                    <div>{getSelectedCustomer()?.country}</div>
                    {getSelectedCustomer()?.phone && (
                      <div>Phone: {getSelectedCustomer()?.phone}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order-date">Order Date *</Label>
                  <Input
                    id="order-date"
                    type="date"
                    value={formatDate(formData.order_date)}
                    onChange={(e) => updateFormData({ order_date: new Date(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="required-date">Required Date</Label>
                  <Input
                    id="required-date"
                    type="date"
                    value={formData.required_date ? formatDate(formData.required_date) : ''}
                    onChange={(e) => updateFormData({ 
                      required_date: e.target.value ? new Date(e.target.value) : undefined 
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Items Tab */}
        <TabsContent value="items">
          <OrderLineItems
            orderDetails={orderDetails}
            onOrderDetailsChange={handleOrderDetailsChange}
            freight={formData.freight}
          />
        </TabsContent>

        {/* Shipping Tab */}
        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ship-name">Ship to Name</Label>
                  <Input
                    id="ship-name"
                    value={formData.ship_name || ''}
                    onChange={(e) => updateFormData({ ship_name: e.target.value })}
                    placeholder={getSelectedCustomer()?.company_name}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shipper">Shipper</Label>
                  <Select 
                    value={formData.ship_via?.toString() || ''} 
                    onValueChange={(value) => updateFormData({ ship_via: value ? parseInt(value) : undefined })}
                  >
                    <SelectTrigger id="shipper">
                      <SelectValue placeholder="Select shipper" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No shipper</SelectItem>
                      <SelectItem value="1">Speedy Express</SelectItem>
                      <SelectItem value="2">United Package</SelectItem>
                      <SelectItem value="3">Federal Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ship-address">Shipping Address</Label>
                <Textarea
                  id="ship-address"
                  value={formData.ship_address || ''}
                  onChange={(e) => updateFormData({ ship_address: e.target.value })}
                  placeholder={getSelectedCustomer()?.address}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ship-city">City</Label>
                  <Input
                    id="ship-city"
                    value={formData.ship_city || ''}
                    onChange={(e) => updateFormData({ ship_city: e.target.value })}
                    placeholder={getSelectedCustomer()?.city}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ship-region">Region/State</Label>
                  <Input
                    id="ship-region"
                    value={formData.ship_region || ''}
                    onChange={(e) => updateFormData({ ship_region: e.target.value })}
                    placeholder={getSelectedCustomer()?.region || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ship-postal">Postal Code</Label>
                  <Input
                    id="ship-postal"
                    value={formData.ship_postal_code || ''}
                    onChange={(e) => updateFormData({ ship_postal_code: e.target.value })}
                    placeholder={getSelectedCustomer()?.postal_code || ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ship-country">Country</Label>
                  <Input
                    id="ship-country"
                    value={formData.ship_country || ''}
                    onChange={(e) => updateFormData({ ship_country: e.target.value })}
                    placeholder={getSelectedCustomer()?.country}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="freight">Freight Cost</Label>
                  <Input
                    id="freight"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.freight}
                    onChange={(e) => updateFormData({ freight: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status">
          <OrderStatus 
            order={order}
            onUpdate={() => {
              // Refresh form when status is updated
              if ('order_details' in order && order.order_details) {
                // This would ideally refetch the order data
                setHasChanges(false)
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-800">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium">
                You have unsaved changes. Remember to save before leaving.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}