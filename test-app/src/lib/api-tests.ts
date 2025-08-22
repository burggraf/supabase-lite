export interface ApiTest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD';
  endpoint: string;
  body?: any;
  description: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

export interface TestCategory {
  id: string;
  name: string;
  description: string;
  tests: ApiTest[];
}

// Default base URL - can be overridden dynamically
let BASE_URL = 'http://localhost:8080';

export function setBaseUrl(url: string) {
  BASE_URL = url;
}

export function getBaseUrl(): string {
  return BASE_URL;
}

// Test Categories
export const testCategories: TestCategory[] = [
  {
    id: 'basic-crud',
    name: 'Basic CRUD Operations',
    description: 'Fundamental database operations on Northwind tables',
    tests: [
      {
        id: 'get-all-products',
        name: 'Get All Products',
        method: 'GET',
        endpoint: '/rest/v1/products',
        description: 'Retrieve all products from the catalog'
      },
      {
        id: 'get-specific-fields',
        name: 'Get Specific Fields',
        method: 'GET',
        endpoint: '/rest/v1/products?select=product_name,unit_price,units_in_stock',
        description: 'Select only specific columns from products table'
      },
      {
        id: 'get-single-product',
        name: 'Get Single Product',
        method: 'GET',
        endpoint: '/rest/v1/products?product_id=eq.1',
        description: 'Retrieve a specific product by ID'
      },
      {
        id: 'create-product',
        name: 'Create New Product',
        method: 'POST',
        endpoint: '/rest/v1/products',
        body: {
          product_id: 999,
          product_name: 'Test Product',
          unit_price: 25.99,
          units_in_stock: 100,
          category_id: 1,
          supplier_id: 1,
          discontinued: 0
        },
        description: 'Add a new product to the catalog'
      },
      {
        id: 'update-product',
        name: 'Update Product',
        method: 'PATCH',
        endpoint: '/rest/v1/products?product_id=eq.1',
        body: {
          unit_price: 29.99
        },
        description: 'Update an existing product\'s price'
      },
      {
        id: 'delete-product',
        name: 'Delete Test Product',
        method: 'DELETE',
        endpoint: '/rest/v1/products?product_name=eq.Test Product',
        description: 'Remove the test product we created'
      }
    ]
  },
  {
    id: 'advanced-filtering',
    name: 'Advanced Filtering & Queries',
    description: 'Complex query operations using PostgREST operators',
    tests: [
      {
        id: 'price-filter',
        name: 'Price Range Filter',
        method: 'GET',
        endpoint: '/rest/v1/products?unit_price=gte.20&unit_price=lte.50',
        description: 'Find products in a specific price range ($20-$50)'
      },
      {
        id: 'text-search',
        name: 'Text Search',
        method: 'GET',
        endpoint: '/rest/v1/products?product_name=ilike.*seafood*',
        description: 'Search for products containing "seafood" in the name'
      },
      {
        id: 'complex-filter',
        name: 'Complex Filter + Sort',
        method: 'GET',
        endpoint: '/rest/v1/products?discontinued=eq.0&order=unit_price.desc&limit=10',
        description: 'Active products sorted by price (highest first)'
      },
      {
        id: 'multiple-values',
        name: 'Multiple Values (IN)',
        method: 'GET',
        endpoint: '/rest/v1/products?category_id=in.1,2,3',
        description: 'Products from categories 1, 2, or 3'
      },
      {
        id: 'low-stock',
        name: 'Low Stock Alert',
        method: 'GET',
        endpoint: '/rest/v1/products?units_in_stock=lte.10&discontinued=eq.0',
        description: 'Find active products with low inventory (≤10 units)'
      }
    ]
  },
  {
    id: 'relationships',
    name: 'Relationships & Joins',
    description: 'Complex queries involving multiple related tables',
    tests: [
      {
        id: 'orders-with-customers',
        name: 'Orders with Customer Details',
        method: 'GET',
        endpoint: '/rest/v1/orders?select=*,customers(customer_id,company_name,contact_name)&limit=5',
        description: 'Get orders with embedded customer information'
      },
      {
        id: 'products-with-categories',
        name: 'Products with Categories',
        method: 'GET',
        endpoint: '/rest/v1/products?select=product_name,unit_price,categories(category_name)&limit=10',
        description: 'Products with their category names'
      },
      {
        id: 'order-details-full',
        name: 'Order Details with Products',
        method: 'GET',
        endpoint: '/rest/v1/order_details?select=*,orders(order_date),products(product_name,unit_price)&limit=5',
        description: 'Order line items with product and order information'
      },
      {
        id: 'customer-order-count',
        name: 'Customers with Order Count',
        method: 'GET',
        endpoint: '/rest/v1/customers?select=company_name,contact_name,orders(count)&limit=10',
        description: 'Customer list with total number of orders'
      }
    ]
  },
  {
    id: 'pagination',
    name: 'Pagination & Limits',
    description: 'Data pagination and result limiting techniques',
    tests: [
      {
        id: 'basic-limit',
        name: 'Basic Limit',
        method: 'GET',
        endpoint: '/rest/v1/products?limit=5',
        description: 'Get first 5 products'
      },
      {
        id: 'pagination',
        name: 'Pagination (Offset)',
        method: 'GET',
        endpoint: '/rest/v1/products?limit=5&offset=10',
        description: 'Get products 11-15 (page 3 with 5 per page)'
      },
      {
        id: 'recent-orders',
        name: 'Recent Orders',
        method: 'GET',
        endpoint: '/rest/v1/orders?order=order_date.desc&limit=10',
        description: 'Get 10 most recent orders'
      },
      {
        id: 'count-only',
        name: 'Count Only',
        method: 'HEAD',
        endpoint: '/rest/v1/products',
        description: 'Get total product count without data'
      }
    ]
  },
  {
    id: 'business-scenarios',
    name: 'Business Scenarios',
    description: 'Real-world business queries using Northwind data',
    tests: [
      {
        id: 'monthly-sales',
        name: 'Monthly Sales Report',
        method: 'GET',
        endpoint: '/rest/v1/orders?order_date=gte.1997-01-01&order_date=lt.1997-02-01&select=order_id,order_date,freight',
        description: 'Orders from January 1997 for sales analysis'
      },
      {
        id: 'vip-customers',
        name: 'VIP Customers',
        method: 'GET',
        endpoint: '/rest/v1/customers?select=*,orders(count)&orders.count=gte.10',
        description: 'Customers with 10 or more orders'
      },
      {
        id: 'premium-products',
        name: 'Premium Products',
        method: 'GET',
        endpoint: '/rest/v1/products?select=*,categories(category_name)&unit_price=gte.100',
        description: 'High-value products over $100'
      },
      {
        id: 'employee-territories',
        name: 'Employee Territories',
        method: 'GET',
        endpoint: '/rest/v1/employees?select=first_name,last_name,title,employee_territories(count)',
        description: 'Employee list with territory assignments'
      }
    ]
  },
  {
    id: 'error-handling',
    name: 'Error Handling & Edge Cases',
    description: 'Testing error responses and edge case handling',
    tests: [
      {
        id: 'table-not-found',
        name: 'Table Not Found',
        method: 'GET',
        endpoint: '/rest/v1/nonexistent_table',
        description: 'Try to access a table that doesn\'t exist (404 error)'
      },
      {
        id: 'invalid-column',
        name: 'Invalid Column',
        method: 'GET',
        endpoint: '/rest/v1/products?invalid_column=eq.test',
        description: 'Query with non-existent column (400 error)'
      },
      {
        id: 'missing-required-fields',
        name: 'Missing Required Fields',
        method: 'POST',
        endpoint: '/rest/v1/products',
        body: {
          unit_price: 25.99
        },
        description: 'Create product without required fields (422 error)'
      },
      {
        id: 'invalid-parameter',
        name: 'Invalid Parameter',
        method: 'GET',
        endpoint: '/rest/v1/products?limit=invalid',
        description: 'Use invalid value for limit parameter (400 error)'
      }
    ]
  }
];

export async function executeApiTest(test: ApiTest): Promise<ApiResponse> {
  const startTime = Date.now();
  
  try {
    const url = `${BASE_URL}${test.endpoint}`;
    const options: RequestInit = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': 'test-api-key', // Mock API key for demo
      },
    };

    if (test.body && (test.method === 'POST' || test.method === 'PATCH')) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    let data: any;
    const contentType = response.headers.get('content-type');
    
    if (test.method === 'HEAD') {
      data = null;
    } else if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers,
      responseTime,
      timestamp: new Date(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 0,
      statusText: 'Network Error',
      data: null,
      headers: {},
      responseTime,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function getStatusColor(status: number): string {
  if (status === 0) return 'text-red-600';
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 300 && status < 400) return 'text-blue-600';
  if (status >= 400 && status < 500) return 'text-orange-600';
  if (status >= 500) return 'text-red-600';
  return 'text-gray-600';
}

export function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return 'success';
    case 'POST': return 'default';
    case 'PATCH': return 'warning';
    case 'DELETE': return 'destructive';
    case 'HEAD': return 'secondary';
    default: return 'outline';
  }
}