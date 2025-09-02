export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  DASHBOARD: '/dashboard',
  CUSTOMERS: '/customers',
  ORDERS: '/orders',
  PRODUCTS: '/products',
  CATEGORIES: '/categories',
  SUPPLIERS: '/suppliers',
  REPORTS: '/reports',
  SETTINGS: '/settings',
} as const

export const NAVIGATION_ITEMS = [
  {
    title: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: 'LayoutDashboard',
  },
  {
    title: 'Customers',
    href: ROUTES.CUSTOMERS,
    icon: 'Users',
  },
  {
    title: 'Orders',
    href: ROUTES.ORDERS,
    icon: 'ShoppingCart',
  },
  {
    title: 'Products',
    href: ROUTES.PRODUCTS,
    icon: 'Package',
  },
  {
    title: 'Categories',
    href: ROUTES.CATEGORIES,
    icon: 'Tags',
  },
  {
    title: 'Suppliers',
    href: ROUTES.SUPPLIERS,
    icon: 'Truck',
  },
  {
    title: 'Reports',
    href: ROUTES.REPORTS,
    icon: 'BarChart3',
  },
  {
    title: 'Settings',
    href: ROUTES.SETTINGS,
    icon: 'Settings',
  },
] as const

export const APP_CONFIG = {
  name: 'Northwind Business',
  description: 'Professional business management system',
  version: '1.0.0',
} as const