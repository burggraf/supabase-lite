import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar,
  Download,
  FileBarChart,
  TrendingUp,
  Users,
  Package,
  AlertTriangle,
  DollarSign,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react'

export function Reports() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'month' | 'quarter' | 'year'>('month')

  // Simple mock data instead of expensive API calls
  const businessMetrics = {
    totalRevenue: 156789,
    averageOrderValue: 130,
    totalOrders: 1205,
    pendingOrders: 45,
    shippedOrders: 1160,
    totalCustomers: 847,
    lowStockProducts: 5
  }

  const isLoading = false

  // Simple export handlers (placeholder functionality)
  const handleExportReport = (type: string, format: string) => {
    alert(`Export ${type} as ${format} - Feature coming soon!`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive business intelligence and reporting dashboard
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setSelectedTimeframe('month')}
            className={selectedTimeframe === 'month' ? 'bg-blue-50 border-blue-300' : ''}
          >
            Month
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedTimeframe('quarter')}
            className={selectedTimeframe === 'quarter' ? 'bg-blue-50 border-blue-300' : ''}
          >
            Quarter
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedTimeframe('year')}
            className={selectedTimeframe === 'year' ? 'bg-blue-50 border-blue-300' : ''}
          >
            Year
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${businessMetrics.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg Order: ${businessMetrics.averageOrderValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {businessMetrics.totalOrders.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending: {businessMetrics.pendingOrders} | 
              Shipped: {businessMetrics.shippedOrders}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {businessMetrics.totalCustomers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Active customer base
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {businessMetrics.lowStockProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Reports */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales" className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Sales Reports</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Customer Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Product Performance</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Inventory Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Sales Reports Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Sales Performance Analysis</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportReport('Sales Report', 'CSV')}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportReport('Sales Report', 'Excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button
                onClick={() => handleExportReport('Sales Report', 'PDF')}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">Sales trending upward with 12% growth this quarter</p>
                <div className="h-48 bg-gradient-to-r from-green-50 to-green-100 rounded-lg flex items-end justify-center">
                  <p className="text-green-600 font-medium">📈 Strong Growth Trend</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="font-medium">Beverages</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">$45,231</div>
                      <div className="text-sm text-gray-500">187 orders</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="font-medium">Dairy Products</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">$38,156</div>
                      <div className="text-sm text-gray-500">142 orders</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="font-medium">Seafood</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">$32,458</div>
                      <div className="text-sm text-gray-500">98 orders</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Customer Analytics Tab */}
        <TabsContent value="customers" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Customer Analytics & Segmentation</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportReport('Customer Report', 'Excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Customer Report
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Customers by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Alfreds Futterkiste</div>
                      <div className="text-sm text-gray-500">28 orders</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">$4,273</div>
                      <div className="text-sm text-gray-500">Dec 15, 2024</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Ana Trujillo Emparedados</div>
                      <div className="text-sm text-gray-500">24 orders</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">$3,856</div>
                      <div className="text-sm text-gray-500">Dec 12, 2024</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Around the Horn</div>
                      <div className="text-sm text-gray-500">19 orders</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">$3,142</div>
                      <div className="text-sm text-gray-500">Dec 10, 2024</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Segmentation */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Segmentation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Premium Customers</h4>
                      <span className="text-sm font-semibold text-blue-600">23 customers</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">High-value customers with frequent orders</p>
                    <div className="flex justify-between text-sm">
                      <span>Total Spent: $89,432</span>
                      <span>Avg Order: $245</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Regular Customers</h4>
                      <span className="text-sm font-semibold text-blue-600">156 customers</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Consistent ordering patterns</p>
                    <div className="flex justify-between text-sm">
                      <span>Total Spent: $45,672</span>
                      <span>Avg Order: $125</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Product Performance Tab */}
        <TabsContent value="products" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Product Performance Analysis</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportReport('Product Report', 'Excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Product Report
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Product</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-right py-2">Revenue</th>
                      <th className="text-right py-2">Qty Sold</th>
                      <th className="text-right py-2">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-medium">Chai</td>
                      <td className="py-2 text-gray-600">Beverages</td>
                      <td className="py-2 text-right font-semibold">$8,456</td>
                      <td className="py-2 text-right">423</td>
                      <td className="py-2 text-right">87</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-medium">Chang</td>
                      <td className="py-2 text-gray-600">Beverages</td>
                      <td className="py-2 text-right font-semibold">$7,234</td>
                      <td className="py-2 text-right">356</td>
                      <td className="py-2 text-right">74</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-medium">Aniseed Syrup</td>
                      <td className="py-2 text-gray-600">Condiments</td>
                      <td className="py-2 text-right font-semibold">$5,890</td>
                      <td className="py-2 text-right">298</td>
                      <td className="py-2 text-right">61</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Reports Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Inventory Management Reports</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportReport('Inventory Report', 'Excel')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Inventory Report
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Inventory Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$123,456</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Units</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8,742</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Low Stock Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">5</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Out of Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">2</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                Products Requiring Reorder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Product</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-right py-2">Current Stock</th>
                      <th className="text-right py-2">Reorder Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-medium">Chocolade</td>
                      <td className="py-2 text-gray-600">Confections</td>
                      <td className="py-2 text-right text-orange-600">15</td>
                      <td className="py-2 text-right">30</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-medium">Gorgonzola Telino</td>
                      <td className="py-2 text-gray-600">Dairy Products</td>
                      <td className="py-2 text-right text-red-600 font-semibold">0</td>
                      <td className="py-2 text-right">20</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}