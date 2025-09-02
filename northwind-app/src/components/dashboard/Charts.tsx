import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface ChartProps {
  className?: string
}

interface SalesTrendData {
  period: string
  sales: number
  orders: number
  customers?: number
}

interface TopProductData {
  product_name: string
  total_revenue: number
  total_quantity: number
  order_count: number
}

interface CategoryData {
  category_name: string
  revenue: number
  product_count: number
  order_count: number
}

interface OrderStatusData {
  status: string
  count: number
  color: string
}

export function SalesTrendChart({ 
  className, 
  data 
}: ChartProps & { 
  data?: SalesTrendData[] 
}) {
  // Default data for fallback
  const defaultData = [
    { period: 'Jan', sales: 4000, orders: 24 },
    { period: 'Feb', sales: 3000, orders: 18 },
    { period: 'Mar', sales: 5000, orders: 31 },
    { period: 'Apr', sales: 4500, orders: 28 },
    { period: 'May', sales: 6000, orders: 37 },
    { period: 'Jun', sales: 5500, orders: 34 },
  ]

  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sales Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="period" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  name === 'sales' ? `$${value}` : value,
                  name === 'sales' ? 'Sales' : 'Orders'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function TopProductsChart({ 
  className, 
  data 
}: ChartProps & { 
  data?: TopProductData[] 
}) {
  // Default data for fallback
  const defaultData = [
    { product_name: 'Chai', total_revenue: 850, total_quantity: 45, order_count: 12 },
    { product_name: 'Chang', total_revenue: 720, total_quantity: 38, order_count: 10 },
    { product_name: 'Aniseed Syrup', total_revenue: 680, total_quantity: 35, order_count: 9 },
    { product_name: 'Ikura', total_revenue: 620, total_quantity: 32, order_count: 8 },
    { product_name: 'Tofu', total_revenue: 580, total_quantity: 29, order_count: 7 },
  ]

  const chartData = data && data.length > 0 
    ? data.slice(0, 5).map(item => ({
        name: item.product_name,
        sales: item.total_revenue,
        orders: item.order_count
      }))
    : defaultData.map(item => ({
        name: item.product_name,
        sales: item.total_revenue,
        orders: item.order_count
      }))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                type="number" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip 
                formatter={(value: any) => [`$${value}`, 'Sales']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              <Bar 
                dataKey="sales" 
                fill="#10b981"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function CategoryDistributionChart({ 
  className, 
  data 
}: ChartProps & { 
  data?: CategoryData[] 
}) {
  // Default data for fallback
  const defaultData = [
    { category_name: 'Beverages', revenue: 120000, product_count: 12, order_count: 45 },
    { category_name: 'Dairy Products', revenue: 100000, product_count: 10, order_count: 38 },
    { category_name: 'Seafood', revenue: 95000, product_count: 12, order_count: 42 },
    { category_name: 'Condiments', revenue: 85000, product_count: 12, order_count: 35 },
    { category_name: 'Grains/Cereals', revenue: 70000, product_count: 7, order_count: 28 },
  ]

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
  
  const chartData = data && data.length > 0 
    ? data.slice(0, 8).map((item, index) => ({
        name: item.category_name,
        value: item.product_count,
        color: colors[index % colors.length]
      }))
    : defaultData.map((item, index) => ({
        name: item.category_name,
        value: item.product_count,
        color: colors[index % colors.length]
      }))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Products by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => [value, 'Products']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function OrderStatusChart({ 
  className, 
  data 
}: ChartProps & { 
  data?: OrderStatusData[] 
}) {
  // Default data for fallback
  const defaultData = [
    { status: 'Pending', count: 15, color: '#f59e0b' },
    { status: 'Processing', count: 23, color: '#3b82f6' },
    { status: 'Shipped', count: 45, color: '#10b981' },
    { status: 'Delivered', count: 67, color: '#6b7280' },
  ]

  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Order Status Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="status" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                formatter={(value: any) => [value, 'Orders']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}