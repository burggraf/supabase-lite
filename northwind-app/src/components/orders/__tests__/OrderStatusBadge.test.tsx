import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { OrderStatusBadge } from '../OrderStatusBadge'
import { Order } from '@/lib/database/repositories'

const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
  order_id: 1,
  customer_id: 'ALFKI',
  order_date: new Date('2024-01-01'),
  ...overrides
})

describe('OrderStatusBadge', () => {
  it('should render "Shipped" status for shipped orders', () => {
    const order = createMockOrder({
      shipped_date: new Date('2024-01-05')
    })

    render(<OrderStatusBadge order={order} />)
    
    expect(screen.getByText('Shipped')).toBeInTheDocument()
    expect(screen.getByText('Shipped')).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('should render "Overdue" status for orders past required date', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5) // 5 days ago
    
    const order = createMockOrder({
      required_date: pastDate,
      shipped_date: undefined
    })

    render(<OrderStatusBadge order={order} />)
    
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('should render "Pending" status for orders not yet due', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5) // 5 days from now
    
    const order = createMockOrder({
      required_date: futureDate,
      shipped_date: undefined
    })

    render(<OrderStatusBadge order={order} />)
    
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toHaveClass('bg-yellow-100', 'text-yellow-800')
  })

  it('should render "Pending" status for orders without required date', () => {
    const order = createMockOrder({
      required_date: undefined,
      shipped_date: undefined
    })

    render(<OrderStatusBadge order={order} />)
    
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toHaveClass('bg-yellow-100', 'text-yellow-800')
  })

  it('should apply custom className when provided', () => {
    const order = createMockOrder()
    const customClass = 'custom-class'

    render(<OrderStatusBadge order={order} className={customClass} />)
    
    const badge = screen.getByText('Pending')
    expect(badge).toHaveClass(customClass)
  })

  it('should prioritize shipped status over overdue status', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5) // 5 days ago
    
    const order = createMockOrder({
      required_date: pastDate,
      shipped_date: new Date() // Shipped today
    })

    render(<OrderStatusBadge order={order} />)
    
    // Should show "Shipped" even though required_date is in the past
    expect(screen.getByText('Shipped')).toBeInTheDocument()
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })
})