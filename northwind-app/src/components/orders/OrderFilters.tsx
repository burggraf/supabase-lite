import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Filter, RotateCcw } from 'lucide-react'
import { OrderSearchFilters } from '@/lib/database/repositories'
import { useCustomers } from '@/hooks/useCustomers'

interface OrderFiltersProps {
  filters: OrderSearchFilters
  onFiltersChange: (filters: OrderSearchFilters) => void
  onClear: () => void
  className?: string
}

export function OrderFilters({ 
  filters, 
  onFiltersChange, 
  onClear, 
  className = '' 
}: OrderFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)
  const { data: customersData } = useCustomers({ pagination: { page: 1, limit: 100 } })
  const customers = customersData?.data || []

  const updateFilter = (key: keyof OrderSearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined
    })
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => 
      value !== undefined && value !== null && value !== ''
    ).length
  }

  const activeFiltersCount = getActiveFiltersCount()

  const formatDateForInput = (date?: Date) => {
    if (!date) return ''
    return date.toISOString().split('T')[0]
  }

  const handleDateChange = (key: 'date_from' | 'date_to', value: string) => {
    updateFilter(key, value ? new Date(value) : undefined)
  }

  return (
    <div className={className}>
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.customer_id && (
            <Badge variant="secondary" className="gap-1">
              Customer: {customers.find(c => c.customer_id === filters.customer_id)?.company_name || filters.customer_id}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('customer_id', undefined)}
              />
            </Badge>
          )}
          
          {filters.ship_country && (
            <Badge variant="secondary" className="gap-1">
              Country: {filters.ship_country}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('ship_country', undefined)}
              />
            </Badge>
          )}
          
          {filters.ship_city && (
            <Badge variant="secondary" className="gap-1">
              City: {filters.ship_city}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('ship_city', undefined)}
              />
            </Badge>
          )}
          
          {filters.shipped !== undefined && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.shipped ? 'Shipped' : 'Pending'}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('shipped', undefined)}
              />
            </Badge>
          )}
          
          {filters.date_from && (
            <Badge variant="secondary" className="gap-1">
              From: {filters.date_from.toLocaleDateString()}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('date_from', undefined)}
              />
            </Badge>
          )}
          
          {filters.date_to && (
            <Badge variant="secondary" className="gap-1">
              To: {filters.date_to.toLocaleDateString()}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('date_to', undefined)}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <Card className="mb-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Filter Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Customer Filter */}
              <div className="space-y-2">
                <Label htmlFor="customer-filter">Customer</Label>
                <Select 
                  value={filters.customer_id || ''} 
                  onValueChange={(value) => updateFilter('customer_id', value)}
                >
                  <SelectTrigger id="customer-filter">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Customers</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.customer_id} value={customer.customer_id}>
                        {customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shipping Country Filter */}
              <div className="space-y-2">
                <Label htmlFor="country-filter">Shipping Country</Label>
                <Input
                  id="country-filter"
                  placeholder="Enter country"
                  value={filters.ship_country || ''}
                  onChange={(e) => updateFilter('ship_country', e.target.value)}
                />
              </div>

              {/* Shipping City Filter */}
              <div className="space-y-2">
                <Label htmlFor="city-filter">Shipping City</Label>
                <Input
                  id="city-filter"
                  placeholder="Enter city"
                  value={filters.ship_city || ''}
                  onChange={(e) => updateFilter('ship_city', e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select 
                  value={filters.shipped === undefined ? '' : filters.shipped.toString()} 
                  onValueChange={(value) => updateFilter('shipped', value === '' ? undefined : value === 'true')}
                >
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="false">Pending</SelectItem>
                    <SelectItem value="true">Shipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From Filter */}
              <div className="space-y-2">
                <Label htmlFor="date-from-filter">Order Date From</Label>
                <Input
                  id="date-from-filter"
                  type="date"
                  value={formatDateForInput(filters.date_from)}
                  onChange={(e) => handleDateChange('date_from', e.target.value)}
                />
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <Label htmlFor="date-to-filter">Order Date To</Label>
                <Input
                  id="date-to-filter"
                  type="date"
                  value={formatDateForInput(filters.date_to)}
                  onChange={(e) => handleDateChange('date_to', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}