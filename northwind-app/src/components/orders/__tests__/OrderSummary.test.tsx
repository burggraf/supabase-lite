import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { OrderSummary } from '../OrderSummary'
import { OrderDetail } from '@/lib/database/repositories'

const createMockOrderDetail = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  order_id: 1,
  product_id: 1,
  unit_price: 10.00,
  quantity: 2,
  discount: 0,
  ...overrides
})

describe('OrderSummary', () => {
  it('should calculate and display subtotal correctly', () => {
    const orderDetails = [
      createMockOrderDetail({ unit_price: 10.00, quantity: 2, discount: 0 }), // $20
      createMockOrderDetail({ unit_price: 15.00, quantity: 1, discount: 0.1 }) // $13.50
    ]

    render(<OrderSummary orderDetails={orderDetails} />)
    
    expect(screen.getByText('$33.50')).toBeInTheDocument() // Subtotal
  })

  it('should apply discounts correctly in calculations', () => {
    const orderDetails = [
      createMockOrderDetail({ 
        unit_price: 100.00, 
        quantity: 1, 
        discount: 0.25 // 25% discount
      })
    ]

    render(<OrderSummary orderDetails={orderDetails} />)
    
    // Should show $75.00 (100 * 1 * (1 - 0.25))
    expect(screen.getByText('$75.00')).toBeInTheDocument()
  })

  it('should display freight when provided', () => {
    const orderDetails = [
      createMockOrderDetail({ unit_price: 10.00, quantity: 1 })
    ]
    const freight = 5.99

    render(<OrderSummary orderDetails={orderDetails} freight={freight} />)
    
    expect(screen.getByText('Freight:')).toBeInTheDocument()
    expect(screen.getByText('$5.99')).toBeInTheDocument()
  })

  it('should not display freight when zero or not provided', () => {
    const orderDetails = [
      createMockOrderDetail({ unit_price: 10.00, quantity: 1 })
    ]

    render(<OrderSummary orderDetails={orderDetails} />)
    
    expect(screen.queryByText('Freight:')).not.toBeInTheDocument()
  })

  it('should calculate total with freight', () => {
    const orderDetails = [
      createMockOrderDetail({ unit_price: 10.00, quantity: 1 })
    ]
    const freight = 5.00

    render(<OrderSummary orderDetails={orderDetails} freight={freight} />)
    
    // Should show subtotal ($10.00), freight ($5.00), and total ($15.00)
    expect(screen.getByText('$10.00')).toBeInTheDocument() // Subtotal
    expect(screen.getByText('$5.00')).toBeInTheDocument()  // Freight
    expect(screen.getByText('$15.00')).toBeInTheDocument() // Total
  })

  it('should display item count correctly', () => {
    const orderDetails = [
      createMockOrderDetail(),
      createMockOrderDetail()
    ]

    render(<OrderSummary orderDetails={orderDetails} />)
    
    expect(screen.getByText('2 items')).toBeInTheDocument()
  })

  it('should display singular form for single item', () => {
    const orderDetails = [
      createMockOrderDetail()
    ]

    render(<OrderSummary orderDetails={orderDetails} />)
    
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it('should render as card by default', () => {
    const orderDetails = [createMockOrderDetail()]

    render(<OrderSummary orderDetails={orderDetails} />)
    
    expect(screen.getByText('Order Summary')).toBeInTheDocument()
  })

  it('should render without card when showCard is false', () => {
    const orderDetails = [createMockOrderDetail()]

    render(<OrderSummary orderDetails={orderDetails} showCard={false} />)
    
    expect(screen.queryByText('Order Summary')).not.toBeInTheDocument()
    expect(screen.getByText('Total:')).toBeInTheDocument() // But content should still be there
  })

  it('should apply custom className', () => {
    const orderDetails = [createMockOrderDetail()]
    const customClass = 'custom-summary-class'

    const { container } = render(
      <OrderSummary orderDetails={orderDetails} className={customClass} />
    )
    
    expect(container.firstChild).toHaveClass(customClass)
  })

  it('should handle empty order details', () => {
    render(<OrderSummary orderDetails={[]} />)
    
    expect(screen.getByText('$0.00')).toBeInTheDocument() // Subtotal
    expect(screen.getByText('0 items')).toBeInTheDocument()
  })

  it('should handle complex multi-item calculations', () => {
    const orderDetails = [
      // Item 1: $25.00 * 2 * 0.9 (10% discount) = $45.00
      createMockOrderDetail({ unit_price: 25.00, quantity: 2, discount: 0.1 }),
      // Item 2: $50.00 * 1 * 1.0 (no discount) = $50.00
      createMockOrderDetail({ unit_price: 50.00, quantity: 1, discount: 0 }),
      // Item 3: $12.50 * 3 * 0.8 (20% discount) = $30.00
      createMockOrderDetail({ unit_price: 12.50, quantity: 3, discount: 0.2 })
    ]
    const freight = 10.50

    render(<OrderSummary orderDetails={orderDetails} freight={freight} />)
    
    // Subtotal: $45.00 + $50.00 + $30.00 = $125.00
    // Total: $125.00 + $10.50 = $135.50
    expect(screen.getByText('$125.00')).toBeInTheDocument() // Subtotal
    expect(screen.getByText('$10.50')).toBeInTheDocument()  // Freight
    expect(screen.getByText('$135.50')).toBeInTheDocument() // Total
    expect(screen.getByText('3 items')).toBeInTheDocument()
  })
})