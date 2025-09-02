import { Badge } from '@/components/ui/badge'
import { Order } from '@/lib/database/repositories'

interface OrderStatusBadgeProps {
  order: Order
  className?: string
}

export function OrderStatusBadge({ order, className }: OrderStatusBadgeProps) {
  const getStatusInfo = (order: Order) => {
    if (order.shipped_date) {
      return {
        label: 'Shipped',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800 border-green-200'
      }
    }
    
    if (order.required_date && new Date() > order.required_date) {
      return {
        label: 'Overdue',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800 border-red-200'
      }
    }
    
    return {
      label: 'Pending',
      variant: 'secondary' as const,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  const status = getStatusInfo(order)

  return (
    <Badge 
      variant={status.variant}
      className={`${status.className} ${className || ''}`}
    >
      {status.label}
    </Badge>
  )
}