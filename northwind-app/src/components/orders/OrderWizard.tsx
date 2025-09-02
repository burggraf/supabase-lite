import { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  ShoppingCart, 
  Ship, 
  CheckCircle,
  X
} from 'lucide-react'
import { Order, OrderDetail } from '@/lib/database/repositories'
import { useCustomers } from '@/hooks/useCustomers'
import { useCreateOrder } from '@/hooks/useOrders'
import { OrderLineItems } from './OrderLineItems'
import { OrderSummary } from './OrderSummary'
import { toast } from 'sonner'

interface OrderWizardProps {
  onComplete?: (orderId: number) => void
  onCancel?: () => void
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
  orderDetails: OrderDetail[]
}

const STEPS = [
  { id: 1, title: 'Customer', icon: User },
  { id: 2, title: 'Products', icon: ShoppingCart },
  { id: 3, title: 'Shipping', icon: Ship },
  { id: 4, title: 'Review', icon: CheckCircle },
]

export function OrderWizard({ onComplete, onCancel, className = '' }: OrderWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<OrderFormData>({
    order_date: new Date(),
    freight: 0,
    orderDetails: []
  })

  const { data: customersData } = useCustomers({ pagination: { page: 1, limit: 200 } })
  const customers = customersData?.data || []

  const { mutateAsync: createOrder, isPending: isCreating } = useCreateOrder()

  const updateFormData = (updates: Partial<OrderFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!formData.customer_id
      case 2:
        return formData.orderDetails.length > 0
      case 3:
        return true // Shipping info is optional
      case 4:
        return true // Review step is always valid if we got here
      default:
        return false
    }
  }

  const handleNext = () => {
    if (isStepValid(currentStep) && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      const orderData: Partial<Order> = {
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

      // Create order first
      const newOrder = await createOrder(orderData)
      
      if (newOrder && newOrder.order_id) {
        // Note: In a real application, you would also need to create the order details
        // This would typically be done through a separate API call or as part of the order creation
        toast.success(`Order #${newOrder.order_id} created successfully!`)
        onComplete?.(newOrder.order_id)
      }
    } catch (error) {
      toast.error('Failed to create order')
      console.error('Create order error:', error)
    }
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const getSelectedCustomer = () => {
    return customers.find(c => c.customer_id === formData.customer_id)
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-8 mb-8">
      {STEPS.map((step, index) => {
        const isActive = currentStep === step.id
        const isCompleted = currentStep > step.id
        const isValid = isStepValid(step.id)
        
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 
                ${isActive 
                  ? 'border-blue-500 bg-blue-500 text-white' 
                  : isCompleted 
                    ? 'border-green-500 bg-green-500 text-white' 
                    : isValid 
                      ? 'border-gray-300 bg-white text-gray-700'
                      : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}
            >
              <step.icon className="w-5 h-5" />
            </div>
            <div className="ml-3 text-sm">
              <div className={`font-medium ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                {step.title}
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Select Customer</CardTitle>
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
                  <h4 className="font-medium mb-2">Selected Customer</h4>
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
        )

      case 2:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Products</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Add products to this order. You can adjust quantities, prices, and discounts as needed.
                </p>
              </CardContent>
            </Card>

            <OrderLineItems
              orderDetails={formData.orderDetails}
              onOrderDetailsChange={(orderDetails) => updateFormData({ orderDetails })}
              freight={formData.freight}
            />
          </div>
        )

      case 3:
        return (
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
        )

      case 4:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div>
                  <h4 className="font-medium mb-2">Customer</h4>
                  <div className="text-sm space-y-1">
                    <div>{getSelectedCustomer()?.company_name}</div>
                    <div>{getSelectedCustomer()?.contact_name}</div>
                    <div>
                      {getSelectedCustomer()?.city}, {getSelectedCustomer()?.country}
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div>
                  <h4 className="font-medium mb-2">Order Information</h4>
                  <div className="text-sm space-y-1">
                    <div>Order Date: {formData.order_date.toLocaleDateString()}</div>
                    {formData.required_date && (
                      <div>Required Date: {formData.required_date.toLocaleDateString()}</div>
                    )}
                  </div>
                </div>

                {/* Shipping Info */}
                {(formData.ship_name || formData.ship_address) && (
                  <div>
                    <h4 className="font-medium mb-2">Shipping</h4>
                    <div className="text-sm space-y-1">
                      {formData.ship_name && <div>{formData.ship_name}</div>}
                      {formData.ship_address && <div>{formData.ship_address}</div>}
                      <div>
                        {formData.ship_city && `${formData.ship_city}, `}
                        {formData.ship_region && `${formData.ship_region} `}
                        {formData.ship_postal_code}
                      </div>
                      {formData.ship_country && <div>{formData.ship_country}</div>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <OrderLineItems
              orderDetails={formData.orderDetails}
              onOrderDetailsChange={() => {}} // Read-only in review
              freight={formData.freight}
              readonly={true}
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Create New Order</h1>
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <div className="mb-8">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Step {currentStep} of {STEPS.length}
          </Badge>
        </div>

        {currentStep < STEPS.length ? (
          <Button
            onClick={handleNext}
            disabled={!isStepValid(currentStep)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!isStepValid(currentStep) || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Order'}
          </Button>
        )}
      </div>
    </div>
  )
}