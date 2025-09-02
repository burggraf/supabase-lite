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
import { 
  useBusinessMetrics,
  useSalesTrend,
  useTopCustomers,
  useCustomerSegmentation,
  useInventoryValuation,
  useReorderAlerts,
  useProductPerformance,
  useRevenueByCategory
} from '@/hooks/useAnalytics'
import { 
  SalesTrendChart,
  TopProductsChart,
  CategoryDistributionChart,
  OrderStatusChart
} from '@/components/dashboard/Charts'
import { 
  exportToCSV,
  exportToExcel,
  exportToPDF,
  prepareAnalyticsExport,
  exportAllFormats
} from '@/lib/utils/exportUtils'

export function Reports() {
  const [dateRange, setDateRange] = useState<{from?: Date, to?: Date}>({})
  const [selectedTimeframe, setSelectedTimeframe] = useState<'month' | 'quarter' | 'year'>('month')

  // Calculate default date ranges
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - (selectedTimeframe === 'year' ? 12 : selectedTimeframe === 'quarter' ? 3 : 1), 1)
  const defaultTo = now

  // Fetch analytics data
  const businessMetrics = useBusinessMetrics(dateRange.from || defaultFrom, dateRange.to || defaultTo)
  const salesTrend = useSalesTrend(dateRange.from || defaultFrom, dateRange.to || defaultTo, 'month')
  const topCustomers = useTopCustomers(10, dateRange.from || defaultFrom, dateRange.to || defaultTo)
  const customerSegmentation = useCustomerSegmentation()
  const inventoryValuation = useInventoryValuation()
  const reorderAlerts = useReorderAlerts()
  const productPerformance = useProductPerformance(15)
  const revenueByCategory = useRevenueByCategory(dateRange.from || defaultFrom, dateRange.to || defaultTo)

  const isLoading = businessMetrics.isLoading || salesTrend.isLoading || topCustomers.isLoading

  // Export handlers
  const handleExportSalesReport = (format: 'csv' | 'excel' | 'pdf' | 'all') => {
    if (!salesTrend.data) return

    const exportData = prepareAnalyticsExport(
      'Sales Trend Report',
      salesTrend.data,
      [
        { key: 'period', header: 'Period' },
        { key: 'sales', header: 'Sales Revenue' },
        { key: 'orders', header: 'Order Count' },
        { key: 'customers', header: 'Unique Customers' }
      ],
      `Sales performance analysis from ${(dateRange.from || defaultFrom).toLocaleDateString()} to ${(dateRange.to || defaultTo).toLocaleDateString()}`
    )

    switch (format) {
      case 'csv': exportToCSV(exportData); break
      case 'excel': exportToExcel(exportData); break
      case 'pdf': exportToPDF(exportData); break
      case 'all': exportAllFormats(exportData); break
    }
  }

  const handleExportCustomerReport = (format: 'csv' | 'excel' | 'pdf' | 'all') => {
    if (!topCustomers.data) return

    const exportData = prepareAnalyticsExport(
      'Top Customers Report',
      topCustomers.data,
      [
        { key: 'company_name', header: 'Company Name' },
        { key: 'totalOrders', header: 'Total Orders' },
        { key: 'totalSpent', header: 'Total Spent' },
        { key: 'lastOrderDate', header: 'Last Order Date' }
      ],
      'Top customers by revenue and order activity'
    )

    switch (format) {
      case 'csv': exportToCSV(exportData); break
      case 'excel': exportToExcel(exportData); break
      case 'pdf': exportToPDF(exportData); break
      case 'all': exportAllFormats(exportData); break
    }
  }

  const handleExportInventoryReport = (format: 'csv' | 'excel' | 'pdf' | 'all') => {
    if (!reorderAlerts.data) return

    const exportData = prepareAnalyticsExport(
      'Inventory Reorder Report',
      reorderAlerts.data,
      [
        { key: 'product_name', header: 'Product Name' },
        { key: 'category_name', header: 'Category' },
        { key: 'supplier_name', header: 'Supplier' },
        { key: 'units_in_stock', header: 'Current Stock' },
        { key: 'reorder_level', header: 'Reorder Level' },
        { key: 'suggested_order_quantity', header: 'Suggested Order' },
        { key: 'unit_price', header: 'Unit Price' }
      ],
      'Products requiring immediate reorder attention'
    )

    switch (format) {
      case 'csv': exportToCSV(exportData); break
      case 'excel': exportToExcel(exportData); break
      case 'pdf': exportToPDF(exportData); break
      case 'all': exportAllFormats(exportData); break
    }
  }

  const handleExportProductReport = (format: 'csv' | 'excel' | 'pdf' | 'all') => {
    if (!productPerformance.data) return

    const exportData = prepareAnalyticsExport(
      'Product Performance Report',
      productPerformance.data,
      [
        { key: 'product_name', header: 'Product Name' },
        { key: 'category_name', header: 'Category' },
        { key: 'totalRevenue', header: 'Total Revenue' },
        { key: 'totalQuantitySold', header: 'Quantity Sold' },
        { key: 'orderCount', header: 'Times Ordered' },
        { key: 'averageDiscount', header: 'Avg Discount %' },
        { key: 'unit_price', header: 'Unit Price' }
      ],
      'Best-performing products by revenue and sales volume'
    )

    switch (format) {
      case 'csv': exportToCSV(exportData); break
      case 'excel': exportToExcel(exportData); break
      case 'pdf': exportToPDF(exportData); break
      case 'all': exportAllFormats(exportData); break
    }
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
      {businessMetrics.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${businessMetrics.data.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg Order: ${businessMetrics.data.averageOrderValue.toFixed(2)}
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
                {businessMetrics.data.totalOrders.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Pending: {businessMetrics.data.pendingOrders} | 
                Shipped: {businessMetrics.data.shippedOrders}
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
                {businessMetrics.data.totalCustomers.toLocaleString()}
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
                {businessMetrics.data.lowStockProducts}
              </div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

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
                onClick={() => handleExportSalesReport('csv')}
                disabled={!salesTrend.data}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportSalesReport('excel')}
                disabled={!salesTrend.data}
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportSalesReport('pdf')}
                disabled={!salesTrend.data}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                onClick={() => handleExportSalesReport('all')}
                disabled={!salesTrend.data}
              >
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesTrendChart />
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByCategory.data && (
                  <div className="space-y-4">
                    {revenueByCategory.data.slice(0, 5).map((category, index) => (
                      <div key={category.category_id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full bg-blue-${(index + 1) * 100}`} />
                          <span className="font-medium">{category.category_name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${category.revenue.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">{category.orderCount} orders</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                onClick={() => handleExportCustomerReport('excel')}
                disabled={!topCustomers.data}
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
                {topCustomers.data && (
                  <div className="space-y-4">
                    {topCustomers.data.slice(0, 8).map((customer, index) => (
                      <div key={customer.customer_id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{customer.company_name}</div>
                          <div className="text-sm text-gray-500">
                            {customer.totalOrders} orders
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${customer.totalSpent.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">
                            {customer.lastOrderDate?.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Segmentation */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Segmentation</CardTitle>
              </CardHeader>
              <CardContent>
                {customerSegmentation.data && (
                  <div className="space-y-4">
                    {customerSegmentation.data.map((segment, index) => (
                      <div key={segment.segment} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{segment.segment}</h4>
                          <span className="text-sm font-semibold text-blue-600">
                            {segment.count} customers
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{segment.description}</p>
                        <div className="flex justify-between text-sm">
                          <span>Total Spent: ${segment.totalSpent.toLocaleString()}</span>
                          <span>Avg Order: ${segment.averageOrderValue.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                onClick={() => handleExportProductReport('excel')}
                disabled={!productPerformance.data}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Product Report
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopProductsChart />
            <CategoryDistributionChart />
          </div>

          {/* Product Performance Table */}
          {productPerformance.data && (
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
                        <th className="text-right py-2">Avg Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPerformance.data.slice(0, 10).map((product) => (
                        <tr key={product.product_id} className="border-b">
                          <td className="py-2 font-medium">{product.product_name}</td>
                          <td className="py-2 text-gray-600">{product.category_name}</td>
                          <td className="py-2 text-right font-semibold">
                            ${product.totalRevenue.toLocaleString()}
                          </td>
                          <td className="py-2 text-right">{product.totalQuantitySold}</td>
                          <td className="py-2 text-right">{product.orderCount}</td>
                          <td className="py-2 text-right">{product.averageDiscount}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Inventory Reports Tab */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Inventory Management Reports</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportInventoryReport('excel')}
                disabled={!reorderAlerts.data}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Inventory Report
              </Button>
            </div>
          </div>

          {/* Inventory Summary Cards */}
          {inventoryValuation.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Inventory Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${inventoryValuation.data.totalValue.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Units</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {inventoryValuation.data.totalUnits.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Low Stock Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {inventoryValuation.data.lowStockCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Out of Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {inventoryValuation.data.outOfStockCount}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reorder Alerts Table */}
          {reorderAlerts.data && reorderAlerts.data.length > 0 && (
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
                        <th className="text-left py-2">Supplier</th>
                        <th className="text-right py-2">Current Stock</th>
                        <th className="text-right py-2">Reorder Level</th>
                        <th className="text-right py-2">Suggested Order</th>
                        <th className="text-right py-2">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reorderAlerts.data.map((product) => (
                        <tr key={product.product_id} className="border-b">
                          <td className="py-2 font-medium">{product.product_name}</td>
                          <td className="py-2 text-gray-600">{product.category_name}</td>
                          <td className="py-2 text-gray-600">{product.supplier_name}</td>
                          <td className="py-2 text-right">
                            <span className={product.units_in_stock === 0 ? 'text-red-600 font-semibold' : 'text-orange-600'}>
                              {product.units_in_stock}
                            </span>
                          </td>
                          <td className="py-2 text-right">{product.reorder_level}</td>
                          <td className="py-2 text-right font-semibold text-blue-600">
                            {product.suggested_order_quantity}
                          </td>
                          <td className="py-2 text-right">${product.unit_price.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {(!reorderAlerts.data || reorderAlerts.data.length === 0) && (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-700 mb-2">All Products Well Stocked</h3>
                <p className="text-gray-600">No products currently require reordering.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading analytics data...</span>
        </div>
      )}
    </div>
  )
}