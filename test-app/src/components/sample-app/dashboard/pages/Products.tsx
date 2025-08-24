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
import { Package, DollarSign, BarChart } from 'lucide-react'

export default function Products() {
  const { products, productsLoading, error } = useNorthwindData()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getStockStatus = (unitsInStock: number, reorderLevel: number) => {
    if (unitsInStock === 0) return { label: 'Out of Stock', variant: 'destructive' as const }
    if (unitsInStock <= reorderLevel) return { label: 'Low Stock', variant: 'secondary' as const }
    return { label: 'In Stock', variant: 'default' as const }
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Package className="h-8 w-8 mr-3 text-purple-600" />
            Products
          </h1>
          <p className="text-muted-foreground">
            Manage your product catalog and inventory
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity per Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const stockStatus = getStockStatus(product.units_in_stock, product.reorder_level)
                  
                  return (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">
                        {product.product_name}
                        {product.discontinued && (
                          <Badge variant="outline" className="ml-2 text-red-600 border-red-300">
                            Discontinued
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.category_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.quantity_per_unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <DollarSign className="h-4 w-4 mr-1 text-muted-foreground" />
                          {formatCurrency(product.unit_price)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <BarChart className="h-4 w-4 mr-1 text-muted-foreground" />
                          {product.units_in_stock}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockStatus.variant}>
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No products found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}