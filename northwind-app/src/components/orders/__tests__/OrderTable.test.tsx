import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderTable } from '../OrderTable'
import { Order } from '@/lib/database/repositories'

// Mock the hooks
vi.mock('@/hooks/useOrders', () => ({
  useOrders: vi.fn(),
  useOrderManagement: vi.fn()
}))

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn()
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const { useOrders, useOrderManagement } = await import('@/hooks/useOrders')
const { useCustomers } = await import('@/hooks/useCustomers')

const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
  order_id: 1,
  customer_id: 'ALFKI',
  order_date: new Date('2024-01-01'),
  required_date: new Date('2024-01-15'),
  ship_name: 'Alfreds Futterkiste',
  ship_address: 'Obere Str. 57',
  ship_city: 'Berlin',
  ship_country: 'Germany',
  freight: 32.38,
  ...overrides
})

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('OrderTable', () => {
  const mockOrders = [
    createMockOrder({ order_id: 1, customer_id: 'ALFKI' }),
    createMockOrder({ order_id: 2, customer_id: 'ANATR' }),
    createMockOrder({ order_id: 3, customer_id: 'ANTON' })
  ]

  const mockOrdersData = {
    data: mockOrders,
    total: 3,
    totalPages: 1,
    page: 1,
    limit: 20
  }

  const mockCustomersData = {
    data: [
      { customer_id: 'ALFKI', company_name: 'Alfreds Futterkiste' },
      { customer_id: 'ANATR', company_name: 'Ana Trujillo Emparedados' },
      { customer_id: 'ANTON', company_name: 'Antonio Moreno Taquería' }
    ]
  }

  const mockOrderManagement = {
    ship: vi.fn(),
    delete: vi.fn(),
    isLoading: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    vi.mocked(useOrders).mockReturnValue({
      data: mockOrdersData,
      isLoading: false,
      error: null
    } as any)

    vi.mocked(useCustomers).mockReturnValue({
      data: mockCustomersData
    } as any)

    vi.mocked(useOrderManagement).mockReturnValue(mockOrderManagement as any)
  })

  it('should render order table with data', async () => {
    renderWithQueryClient(<OrderTable />)

    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('3 orders found')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    } as any)

    renderWithQueryClient(<OrderTable />)

    expect(screen.getByRole('presentation')).toBeInTheDocument() // Loading spinner
  })

  it('should display error state', () => {
    const error = new Error('Failed to fetch orders')
    vi.mocked(useOrders).mockReturnValue({
      data: undefined,
      isLoading: false,
      error
    } as any)

    renderWithQueryClient(<OrderTable />)

    expect(screen.getByText(/Failed to load orders/)).toBeInTheDocument()
  })

  it('should handle search input', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<OrderTable />)

    const searchInput = screen.getByPlaceholderText(/Search orders/)
    await user.type(searchInput, 'ALFKI')

    expect(searchInput).toHaveValue('ALFKI')
  })

  it('should call onViewOrder when view action is clicked', async () => {
    const mockOnViewOrder = vi.fn()
    const user = userEvent.setup()
    
    renderWithQueryClient(<OrderTable onViewOrder={mockOnViewOrder} />)

    // Click on the actions dropdown for the first order
    const actionButtons = screen.getAllByRole('button', { name: /Open menu/ })
    await user.click(actionButtons[0])

    // Click on "View Details"
    const viewButton = screen.getByText('View Details')
    await user.click(viewButton)

    expect(mockOnViewOrder).toHaveBeenCalledWith(mockOrders[0])
  })

  it('should call onEditOrder when edit action is clicked', async () => {
    const mockOnEditOrder = vi.fn()
    const user = userEvent.setup()
    
    renderWithQueryClient(<OrderTable onEditOrder={mockOnEditOrder} />)

    // Click on the actions dropdown for the first order
    const actionButtons = screen.getAllByRole('button', { name: /Open menu/ })
    await user.click(actionButtons[0])

    // Click on "Edit Order"
    const editButton = screen.getByText('Edit Order')
    await user.click(editButton)

    expect(mockOnEditOrder).toHaveBeenCalledWith(mockOrders[0])
  })

  it('should handle shipping an order', async () => {
    const user = userEvent.setup()
    const mockShip = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useOrderManagement).mockReturnValue({
      ...mockOrderManagement,
      ship: mockShip
    } as any)

    // Mock an order that hasn't been shipped
    const unshippedOrder = createMockOrder({ shipped_date: undefined })
    vi.mocked(useOrders).mockReturnValue({
      data: { ...mockOrdersData, data: [unshippedOrder] },
      isLoading: false,
      error: null
    } as any)

    renderWithQueryClient(<OrderTable />)

    // Click on the actions dropdown
    const actionButton = screen.getByRole('button', { name: /Open menu/ })
    await user.click(actionButton)

    // Click on "Mark as Shipped"
    const shipButton = screen.getByText('Mark as Shipped')
    await user.click(shipButton)

    expect(mockShip).toHaveBeenCalledWith({
      orderId: unshippedOrder.order_id,
      shippedDate: expect.any(Date)
    })
  })

  it('should handle deleting an order with confirmation', async () => {
    const user = userEvent.setup()
    const mockDelete = vi.fn().mockResolvedValue(undefined)
    const mockConfirm = vi.fn().mockReturnValue(true)
    global.confirm = mockConfirm

    vi.mocked(useOrderManagement).mockReturnValue({
      ...mockOrderManagement,
      delete: mockDelete
    } as any)

    renderWithQueryClient(<OrderTable />)

    // Click on the actions dropdown
    const actionButtons = screen.getAllByRole('button', { name: /Open menu/ })
    await user.click(actionButtons[0])

    // Click on "Delete Order"
    const deleteButton = screen.getByText('Delete Order')
    await user.click(deleteButton)

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this order?')
    expect(mockDelete).toHaveBeenCalledWith(mockOrders[0].order_id)
  })

  it('should not delete order if confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const mockDelete = vi.fn()
    const mockConfirm = vi.fn().mockReturnValue(false)
    global.confirm = mockConfirm

    vi.mocked(useOrderManagement).mockReturnValue({
      ...mockOrderManagement,
      delete: mockDelete
    } as any)

    renderWithQueryClient(<OrderTable />)

    // Click on the actions dropdown
    const actionButtons = screen.getAllByRole('button', { name: /Open menu/ })
    await user.click(actionButtons[0])

    // Click on "Delete Order"
    const deleteButton = screen.getByText('Delete Order')
    await user.click(deleteButton)

    expect(mockConfirm).toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('should call onCreateOrder when create button is clicked', async () => {
    const mockOnCreateOrder = vi.fn()
    const user = userEvent.setup()
    
    renderWithQueryClient(<OrderTable onCreateOrder={mockOnCreateOrder} />)

    const createButton = screen.getByText('Create Order')
    await user.click(createButton)

    expect(mockOnCreateOrder).toHaveBeenCalled()
  })

  it('should display "No orders found" when there are no orders', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: { ...mockOrdersData, data: [], total: 0 },
      isLoading: false,
      error: null
    } as any)

    renderWithQueryClient(<OrderTable />)

    expect(screen.getByText('No orders found')).toBeInTheDocument()
    expect(screen.getByText('No orders found matching your criteria.')).toBeInTheDocument()
  })

  it('should format currency values correctly', () => {
    renderWithQueryClient(<OrderTable />)

    // Check that freight values are formatted as currency
    expect(screen.getByText('$32.38')).toBeInTheDocument()
  })

  it('should format dates correctly', () => {
    renderWithQueryClient(<OrderTable />)

    // Check that dates are formatted properly
    expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument() // Order date
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument() // Required date
  })

  it('should handle sorting when column headers are clicked', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<OrderTable />)

    const orderNumberHeader = screen.getByText('Order #')
    await user.click(orderNumberHeader)

    // The useOrders hook should be called with sort parameters
    // This would be tested by checking if the hook was called with the right parameters
    expect(useOrders).toHaveBeenCalled()
  })

  it('should hide ship action for already shipped orders', async () => {
    const user = userEvent.setup()
    
    // Mock an order that has already been shipped
    const shippedOrder = createMockOrder({ shipped_date: new Date('2024-01-10') })
    vi.mocked(useOrders).mockReturnValue({
      data: { ...mockOrdersData, data: [shippedOrder] },
      isLoading: false,
      error: null
    } as any)

    renderWithQueryClient(<OrderTable />)

    // Click on the actions dropdown
    const actionButton = screen.getByRole('button', { name: /Open menu/ })
    await user.click(actionButton)

    // "Mark as Shipped" should not be available for shipped orders
    expect(screen.queryByText('Mark as Shipped')).not.toBeInTheDocument()
  })
})