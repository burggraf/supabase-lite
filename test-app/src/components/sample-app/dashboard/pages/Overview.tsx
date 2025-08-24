import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card'
import { Skeleton } from '../../../ui/skeleton'
import { Badge } from '../../../ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table'
import { useNorthwindData } from '../../../../hooks/useNorthwindData'
import {
  Users,
  ShoppingCart,
  Package,
  UserCheck,
  DollarSign,
  TrendingUp,
  Star,
  Award
} from 'lucide-react'

function MetricCard({ 
  title, 
  value, 
  subtext, 
  icon: Icon, 
  isLoading 
}: {
  title: string
  value: string | number
  subtext: string
  icon: React.ComponentType<{ className?: string }>
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-1" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  )
}

export default function Overview() {
  const { 
    metrics, 
    orders, 
    metricsLoading, 
    ordersLoading, 
    error 
  } = useNorthwindData()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Get recent orders (first 10)
  const recentOrders = orders.slice(0, 10)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Welcome to the Northwind Trading Company dashboard
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          Live Demo
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={metrics ? formatCurrency(metrics.totalRevenue) : '—'}
          subtext="All time revenue"
          icon={DollarSign}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Total Orders"
          value={metrics?.totalOrders.toLocaleString() || '—'}
          subtext="Orders processed"
          icon={ShoppingCart}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Active Customers"
          value={metrics?.totalCustomers.toLocaleString() || '—'}
          subtext="Registered customers"
          icon={Users}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Products in Stock"
          value={metrics?.totalProducts.toLocaleString() || '—'}
          subtext="Available products"
          icon={Package}
          isLoading={metricsLoading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Avg Order Value"
          value={metrics ? formatCurrency(metrics.avgOrderValue) : '—'}
          subtext="Average per order"
          icon={TrendingUp}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Top Customer"
          value={metrics?.topCustomer || '—'}
          subtext="Highest revenue"
          icon={Star}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Best Product"
          value={metrics?.topProduct || '—'}
          subtext="Most ordered"
          icon={Award}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Team Members"
          value={metrics?.totalEmployees.toLocaleString() || '—'}
          subtext="Active employees"
          icon={UserCheck}
          isLoading={metricsLoading}
        />
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : recentOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Ship Country</TableHead>
                  <TableHead className="text-right">Freight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell className="font-medium">
                      #{order.order_id}
                    </TableCell>
                    <TableCell>
                      {order.customer_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {order.employee_name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {formatDate(order.order_date)}
                    </TableCell>
                    <TableCell>
                      {order.ship_country}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(order.freight)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No recent orders found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}