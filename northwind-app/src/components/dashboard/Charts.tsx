import React from 'react'
import {
  LineChart,
  Line,
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

// Sample data - in a real app, this would come from your data hooks
const salesTrendData = [
  { month: 'Jan', sales: 4000, orders: 24 },
  { month: 'Feb', sales: 3000, orders: 18 },
  { month: 'Mar', sales: 5000, orders: 31 },
  { month: 'Apr', sales: 4500, orders: 28 },
  { month: 'May', sales: 6000, orders: 37 },
  { month: 'Jun', sales: 5500, orders: 34 },
]

const topProductsData = [
  { name: 'Chai', sales: 850, orders: 45 },
  { name: 'Chang', sales: 720, orders: 38 },
  { name: 'Aniseed Syrup', sales: 680, orders: 35 },
  { name: 'Ikura', sales: 620, orders: 32 },
  { name: 'Tofu', sales: 580, orders: 29 },
]

const categoryDistribution = [
  { name: 'Beverages', value: 12, color: '#3b82f6' },
  { name: 'Dairy Products', value: 10, color: '#10b981' },
  { name: 'Seafood', value: 12, color: '#f59e0b' },
  { name: 'Condiments', value: 12, color: '#ef4444' },
  { name: 'Grains/Cereals', value: 7, color: '#8b5cf6' },
  { name: 'Meat/Poultry', value: 6, color: '#ec4899' },
  { name: 'Produce', value: 5, color: '#14b8a6' },
  { name: 'Confections', value: 13, color: '#f97316' },
]

const orderStatusData = [
  { status: 'Pending', count: 15, color: '#f59e0b' },
  { status: 'Processing', count: 23, color: '#3b82f6' },
  { status: 'Shipped', count: 45, color: '#10b981' },
  { status: 'Delivered', count: 67, color: '#6b7280' },
]

interface ChartProps {
  className?: string
}

export function SalesTrendChart({ className }: ChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sales Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesTrendData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="month" 
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

export function TopProductsChart({ className }: ChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Selling Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProductsData} layout="horizontal">
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

export function CategoryDistributionChart({ className }: ChartProps) {
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
                data={categoryDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any, name: string) => [value, 'Products']}
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

export function OrderStatusChart({ className }: ChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Order Status Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderStatusData}>
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
                {orderStatusData.map((entry, index) => (
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