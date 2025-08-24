import { useState } from 'react'
import DashboardSidebar from './DashboardSidebar'
import Overview from './pages/Overview'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Employees from './pages/Employees'
import { Button } from '../../ui/button'
import { Menu, X } from 'lucide-react'

const pages = {
  overview: Overview,
  customers: Customers,
  orders: Orders,
  products: Products,
  employees: Employees,
} as const

type PageId = keyof typeof pages

export default function DashboardLayout() {
  const [currentPage, setCurrentPage] = useState<PageId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const CurrentPageComponent = pages[currentPage]

  const handlePageChange = (pageId: string) => {
    setCurrentPage(pageId as PageId)
    setSidebarOpen(false) // Close mobile sidebar on navigation
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <DashboardSidebar 
          currentPage={currentPage}
          onPageChange={handlePageChange}
          className="h-full"
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Northwind Dashboard</h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">
          <CurrentPageComponent />
        </div>
      </div>

      {/* Mobile sidebar close button */}
      {sidebarOpen && (
        <Button
          variant="ghost"
          size="sm"
          className="fixed top-4 right-4 z-60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}