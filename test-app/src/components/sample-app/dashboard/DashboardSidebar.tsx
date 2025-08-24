import React from 'react'
import { Button } from '../../ui/button'
import { Separator } from '../../ui/separator'
import UserProfileDropdown from './UserProfileDropdown'
import {
  BarChart3,
  Users,
  ShoppingCart,
  Package,
  UserCheck,
  Home
} from 'lucide-react'

interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const navigationItems: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    description: 'Dashboard overview with key metrics'
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    description: 'Customer management and details'
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    description: 'Order history and management'
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    description: 'Product catalog and inventory'
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: UserCheck,
    description: 'Employee information and performance'
  }
]

interface DashboardSidebarProps {
  currentPage: string
  onPageChange: (pageId: string) => void
  className?: string
}

export default function DashboardSidebar({ 
  currentPage, 
  onPageChange, 
  className = '' 
}: DashboardSidebarProps) {
  return (
    <div className={`flex flex-col h-full bg-gray-50 border-r w-72 ${className}`}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold">Northwind</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">Sample Dashboard</p>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={`w-full justify-start h-auto p-3 ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => onPageChange(item.id)}
              >
                <Icon className={`mr-3 h-4 w-4 ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`} />
                <div className="flex flex-col items-start text-left min-w-0 flex-1">
                  <span className="text-sm font-medium text-left">{item.label}</span>
                  <span className={`text-xs leading-tight break-words whitespace-normal text-left ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {item.description}
                  </span>
                </div>
              </Button>
            )
          })}
        </div>
      </nav>

      <Separator />

      {/* User Profile */}
      <div className="p-4">
        <UserProfileDropdown />
      </div>
    </div>
  )
}