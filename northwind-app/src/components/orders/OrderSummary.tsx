import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderDetail } from '@/lib/database/repositories'

interface OrderSummaryProps {
  orderDetails: OrderDetail[]
  freight?: number
  showCard?: boolean
  className?: string
}

export function OrderSummary({ 
  orderDetails, 
  freight = 0, 
  showCard = true,
  className = ''
}: OrderSummaryProps) {
  const calculateSubtotal = () => {
    return orderDetails.reduce((total, detail) => {
      return total + (detail.unit_price * detail.quantity * (1 - detail.discount))
    }, 0)
  }

  const subtotal = calculateSubtotal()
  const total = subtotal + freight

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const content = (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal:</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      
      {freight > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Freight:</span>
          <span>{formatCurrency(freight)}</span>
        </div>
      )}
      
      <div className="border-t pt-2">
        <div className="flex justify-between font-semibold">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground mt-2">
        {orderDetails.length} {orderDetails.length === 1 ? 'item' : 'items'}
      </div>
    </div>
  )

  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {content}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      {content}
    </div>
  )
}