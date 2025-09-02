import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Trash2, 
  ShoppingCart 
} from 'lucide-react'
import { OrderDetail } from '@/lib/database/repositories'
import { useProducts } from '@/hooks/useProducts'
import { OrderSummary } from './OrderSummary'

interface OrderLineItemsProps {
  orderDetails: OrderDetail[]
  onOrderDetailsChange: (orderDetails: OrderDetail[]) => void
  freight?: number
  readonly?: boolean
  className?: string
}

export function OrderLineItems({ 
  orderDetails, 
  onOrderDetailsChange, 
  freight = 0,
  readonly = false,
  className = '' 
}: OrderLineItemsProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [newItemDiscount, setNewItemDiscount] = useState(0)

  const { data: productsData } = useProducts({ pagination: { page: 1, limit: 200 } })
  const products = productsData?.data || []

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const updateLineItem = (productId: number, updates: Partial<OrderDetail>) => {
    const updatedDetails = orderDetails.map(detail =>
      detail.product_id === productId
        ? { ...detail, ...updates }
        : detail
    )
    onOrderDetailsChange(updatedDetails)
  }

  const removeLineItem = (productId: number) => {
    const filteredDetails = orderDetails.filter(detail => 
      detail.product_id !== productId
    )
    onOrderDetailsChange(filteredDetails)
  }

  const addLineItem = () => {
    if (!selectedProductId) return

    const productId = parseInt(selectedProductId)
    const product = products.find(p => p.product_id === productId)
    
    if (!product) return

    // Check if product already exists in order
    const existingItem = orderDetails.find(detail => detail.product_id === productId)
    
    if (existingItem) {
      // Update quantity of existing item
      updateLineItem(productId, {
        quantity: existingItem.quantity + newItemQuantity
      })
    } else {
      // Add new line item
      const newDetail: OrderDetail = {
        order_id: 0, // Will be set when order is saved
        product_id: productId,
        unit_price: product.unit_price || 0,
        quantity: newItemQuantity,
        discount: newItemDiscount / 100 // Convert percentage to decimal
      }
      
      onOrderDetailsChange([...orderDetails, newDetail])
    }

    // Reset form
    setSelectedProductId('')
    setNewItemQuantity(1)
    setNewItemDiscount(0)
  }

  const getProductName = (productId: number) => {
    const product = products.find(p => p.product_id === productId)
    return product?.product_name || `Product #${productId}`
  }

  const calculateLineTotal = (detail: OrderDetail) => {
    return detail.unit_price * detail.quantity * (1 - detail.discount)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Add New Item Form */}
      {!readonly && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Add Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Product</label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter(product => !orderDetails.find(detail => 
                        detail.product_id === product.product_id
                      ))
                      .map((product) => (
                        <SelectItem 
                          key={product.product_id} 
                          value={product.product_id.toString()}
                        >
                          <div>
                            <div className="font-medium">{product.product_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(product.unit_price || 0)} • 
                              Stock: {product.units_in_stock || 0}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Discount (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newItemDiscount}
                  onChange={(e) => setNewItemDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                />
              </div>

              <Button 
                onClick={addLineItem}
                disabled={!selectedProductId}
                className="h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order Items
            <Badge variant="secondary" className="ml-2">
              {orderDetails.length} {orderDetails.length === 1 ? 'item' : 'items'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orderDetails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>No items in this order</p>
              {!readonly && (
                <p className="text-sm mt-2">Use the form above to add products</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {!readonly && <TableHead className="w-20"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetails.map((detail) => {
                      const lineTotal = calculateLineTotal(detail)
                      
                      return (
                        <TableRow key={detail.product_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {getProductName(detail.product_id)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {detail.product_id}
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right">
                            {readonly ? (
                              formatCurrency(detail.unit_price)
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={detail.unit_price}
                                onChange={(e) => updateLineItem(detail.product_id, {
                                  unit_price: parseFloat(e.target.value) || 0
                                })}
                                className="w-24 text-right"
                              />
                            )}
                          </TableCell>
                          
                          <TableCell className="text-right">
                            {readonly ? (
                              detail.quantity
                            ) : (
                              <Input
                                type="number"
                                min="1"
                                value={detail.quantity}
                                onChange={(e) => updateLineItem(detail.product_id, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1)
                                })}
                                className="w-20 text-right"
                              />
                            )}
                          </TableCell>
                          
                          <TableCell className="text-right">
                            {readonly ? (
                              detail.discount > 0 ? (
                                <Badge variant="secondary">
                                  {Math.round(detail.discount * 100)}% off
                                </Badge>
                              ) : (
                                '-'
                              )
                            ) : (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={Math.round(detail.discount * 100)}
                                  onChange={(e) => updateLineItem(detail.product_id, {
                                    discount: (parseFloat(e.target.value) || 0) / 100
                                  })}
                                  className="w-16 text-right"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell className="text-right font-medium">
                            {formatCurrency(lineTotal)}
                          </TableCell>
                          
                          {!readonly && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(detail.product_id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Order Summary */}
              <div className="flex justify-end">
                <div className="w-full md:w-80">
                  <OrderSummary 
                    orderDetails={orderDetails}
                    freight={freight}
                    showCard={false}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}