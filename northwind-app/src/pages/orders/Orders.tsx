import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Order } from '@/lib/database/repositories'
import { OrderTable } from '@/components/orders/OrderTable'
import { OrderDetail } from '@/components/orders/OrderDetail'
import { OrderWizard } from '@/components/orders/OrderWizard'
import { OrderForm } from '@/components/orders/OrderForm'

type ViewMode = 'list' | 'detail' | 'create' | 'edit'

export function Orders() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setSelectedOrderId(order.order_id)
    setViewMode('detail')
  }

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order)
    setSelectedOrderId(order.order_id)
    setViewMode('edit')
  }

  const handleCreateOrder = () => {
    setSelectedOrder(null)
    setSelectedOrderId(null)
    setViewMode('create')
  }

  const handleBackToList = () => {
    setViewMode('list')
    setSelectedOrder(null)
    setSelectedOrderId(null)
  }

  const handleOrderCreated = (orderId: number) => {
    setSelectedOrderId(orderId)
    setViewMode('detail')
  }

  const handleOrderSaved = (orderId: number) => {
    setSelectedOrderId(orderId)
    setViewMode('detail')
  }

  const renderPageHeader = () => {
    switch (viewMode) {
      case 'create':
        return null // OrderWizard has its own header
      case 'detail':
        return null // OrderDetail has its own header
      case 'edit':
        return null // OrderForm has its own header
      default:
        return (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
              <p className="text-gray-600 mt-2">
                Process and manage customer orders.
              </p>
            </div>
            <Button onClick={handleCreateOrder}>
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          </div>
        )
    }
  }

  const renderContent = () => {
    switch (viewMode) {
      case 'list':
        return (
          <OrderTable
            onViewOrder={handleViewOrder}
            onEditOrder={handleEditOrder}
            onCreateOrder={handleCreateOrder}
          />
        )

      case 'detail':
        if (!selectedOrderId) return null
        return (
          <OrderDetail
            orderId={selectedOrderId}
            onEdit={() => setViewMode('edit')}
            onBack={handleBackToList}
          />
        )

      case 'create':
        return (
          <OrderWizard
            onComplete={handleOrderCreated}
            onCancel={handleBackToList}
          />
        )

      case 'edit':
        if (!selectedOrderId) return null
        return (
          <OrderForm
            orderId={selectedOrderId}
            order={selectedOrder || undefined}
            onSave={handleOrderSaved}
            onCancel={handleBackToList}
            onBack={handleBackToList}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {renderPageHeader()}
      {renderContent()}
    </div>
  )
}