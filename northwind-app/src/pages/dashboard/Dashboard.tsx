import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { 
  Users, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  DollarSign,
  AlertCircle
} from 'lucide-react'

export function Dashboard() {
  const { user } = useAuth()

  // Simple mock data instead of complex API calls
  const totalCustomers = 847
  const totalOrders = 1205
  const totalProducts = 77
  const totalRevenue = 156789
  const averageOrderValue = 130
  const lowStockCount = 5

  const stats = [
    {
      title: 'Total Customers',
      value: totalCustomers.toLocaleString(),
      change: '+2.1%',
      trend: 'up' as const,
      icon: Users,
    },
    {
      title: 'Total Orders',
      value: totalOrders.toLocaleString(),
      change: '+4.3%', 
      trend: 'up' as const,
      icon: ShoppingCart,
    },
    {
      title: 'Products',
      value: totalProducts.toLocaleString(),
      change: '+1.2%',
      trend: 'up' as const, 
      icon: Package,
    },
    {
      title: 'Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      change: '+8.2%',
      trend: 'up' as const,
      icon: DollarSign,
    },
  ]

  // Simple recent activity - no API calls
  const recentActivity = [
    {
      type: 'customer',
      description: `Alfreds Futterkiste is your top customer this month`,
      time: '1 hour ago',
    },
    {
      type: 'product',
      description: `Low stock alert: ${lowStockCount} products need reordering`,
      time: '30 minutes ago',
    },
    {
      type: 'order',
      description: `${totalOrders} orders processed this month`,
      time: '2 hours ago',
    },
    {
      type: 'order',
      description: `Average order value: $${averageOrderValue.toFixed(2)}`,
      time: '3 hours ago',
    }
  ]

  // Simple low stock products - no API calls
  const lowStockProducts = [
    { name: 'Chocolade', stock: 15, reorderLevel: 30 },
    { name: 'Gorgonzola Telino', stock: 0, reorderLevel: 20 },
    { name: 'Perth Pasties', stock: 0, reorderLevel: 0 },
    { name: 'Alice Mutton', stock: 0, reorderLevel: 0 }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center text-xs text-gray-600 mt-1">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-600" />
                  <span className="text-green-600">{stat.change}</span>
                  <span className="ml-1">from last month</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Simple Charts Section - Static Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Sales trending upward with 12% growth this quarter</p>
            <div className="mt-4 h-32 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg flex items-end justify-center">
              <p className="text-blue-600 font-medium">📈 Trending Up</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Beverages</span>
                <span className="text-sm font-medium">$45,231</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Dairy Products</span>
                <span className="text-sm font-medium">$38,156</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Seafood</span>
                <span className="text-sm font-medium">$32,458</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {activity.type === 'order' && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    )}
                    {activity.type === 'customer' && (
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    )}
                    {activity.type === 'product' && (
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-orange-500 mr-2" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      Reorder level: {product.reorderLevel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600">
                      {product.stock} units
                    </p>
                    <p className="text-xs text-gray-500">remaining</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Users className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-medium">Add New Customer</p>
                  <p className="text-sm text-gray-600">Create a customer profile</p>
                </div>
              </div>
            </button>
            
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <ShoppingCart className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium">Create Order</p>
                  <p className="text-sm text-gray-600">Process a new order</p>
                </div>
              </div>
            </button>
            
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <Package className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="font-medium">Add Product</p>
                  <p className="text-sm text-gray-600">Add new product to catalog</p>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}