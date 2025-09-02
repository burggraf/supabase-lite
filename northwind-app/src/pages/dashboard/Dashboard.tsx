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

  // Mock data for demonstration
  const stats = [
    {
      title: 'Total Customers',
      value: '91',
      change: '+2.1%',
      trend: 'up',
      icon: Users,
    },
    {
      title: 'Total Orders',
      value: '830',
      change: '+4.3%', 
      trend: 'up',
      icon: ShoppingCart,
    },
    {
      title: 'Products',
      value: '77',
      change: '+1.2%',
      trend: 'up', 
      icon: Package,
    },
    {
      title: 'Revenue',
      value: '$1,354,287',
      change: '+8.2%',
      trend: 'up',
      icon: DollarSign,
    },
  ]

  const recentActivity = [
    {
      type: 'order',
      description: 'New order #10249 from Tomás Specialties',
      time: '2 minutes ago',
    },
    {
      type: 'customer',
      description: 'New customer registration: John Smith',
      time: '15 minutes ago', 
    },
    {
      type: 'product',
      description: 'Low stock alert: Chai (5 units remaining)',
      time: '1 hour ago',
    },
    {
      type: 'order',
      description: 'Order #10248 shipped to Vins et alcools Chevalier',
      time: '2 hours ago',
    },
  ]

  const lowStockProducts = [
    { name: 'Chai', stock: 5, reorderLevel: 10 },
    { name: 'Chang', stock: 8, reorderLevel: 25 },
    { name: 'Aniseed Syrup', stock: 3, reorderLevel: 25 },
    { name: 'Chef Anton\'s Cajun Seasoning', stock: 12, reorderLevel: 20 },
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