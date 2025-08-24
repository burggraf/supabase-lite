# Implementation Plan: Sample App with Authentication & Northwind Dashboard

## Overview
Transform the "Sample App" tab in test-app into a fully functional demonstration featuring:
- Complete authentication system (signup, signin, forgot password, logout)
- Protected dashboard with Northwind database integration
- Professional shadcn-based UI with sidebar navigation
- Real business metrics and data visualization

## Phase 1: Add Required shadcn Components
**New components to add:**
- `label.tsx` - Form labels
- `form.tsx` - Form validation with react-hook-form
- `dropdown-menu.tsx` - User profile dropdown
- `avatar.tsx` - User avatars
- `separator.tsx` - Visual separators
- `skeleton.tsx` - Loading states
- `toast.tsx` & `toaster.tsx` - Error/success notifications (Sonner)
- `dialog.tsx` - Modal dialogs
- `select.tsx` - Dropdown selections
- `table.tsx` - Data tables

## Phase 2: Authentication System
**Create authentication components:**

1. **AuthContext & Provider** (`test-app/src/contexts/AuthContext.tsx`)
   - Manage auth state (user, token, isAuthenticated)
   - Handle login/logout/signup operations
   - Persist auth state to localStorage
   - Provide auth methods to components

2. **Login Form** (`test-app/src/components/sample-app/auth/LoginForm.tsx`)
   - Email/password inputs with validation
   - Remember me checkbox
   - Error message display
   - Link to signup and forgot password
   - Loading states during submission

3. **Signup Form** (`test-app/src/components/sample-app/auth/SignupForm.tsx`)
   - Email, password, confirm password fields
   - Password strength indicator
   - Terms acceptance checkbox
   - Validation and error handling

4. **Forgot Password Form** (`test-app/src/components/sample-app/auth/ForgotPasswordForm.tsx`)
   - Email input for reset link
   - Success/error messaging
   - Back to login link

5. **Protected Route Component** (`test-app/src/components/sample-app/auth/ProtectedRoute.tsx`)
   - Check authentication status
   - Redirect to login if not authenticated
   - Pass through to children if authenticated

## Phase 3: Dashboard Layout
**Dashboard structure components:**

1. **Dashboard Layout** (`test-app/src/components/sample-app/dashboard/DashboardLayout.tsx`)
   - Main container with sidebar and content area
   - Responsive design with mobile menu

2. **Dashboard Sidebar** (`test-app/src/components/sample-app/dashboard/DashboardSidebar.tsx`)
   - Navigation items: Overview, Customers, Orders, Products, Employees
   - User profile section at bottom with avatar and email
   - Logout functionality

3. **User Profile Dropdown** (`test-app/src/components/sample-app/dashboard/UserProfileDropdown.tsx`)
   - User avatar with initials fallback
   - Dropdown with Profile, Settings, Logout options
   - Display user email

## Phase 4: Dashboard Content
**Business metrics and data components:**

1. **Overview Page** (`test-app/src/components/sample-app/dashboard/pages/Overview.tsx`)
   - KPI cards: Total Revenue, Total Orders, Total Customers, Total Products
   - Recent orders table (last 10)
   - Top selling products
   - Monthly revenue trend (if time permits)

2. **Customers Page** (`test-app/src/components/sample-app/dashboard/pages/Customers.tsx`)
   - Searchable customer table
   - Customer details: Company, Contact, Country, Total Orders
   - Pagination

3. **Orders Page** (`test-app/src/components/sample-app/dashboard/pages/Orders.tsx`)
   - Orders table with filters
   - Order details: Customer, Date, Total, Status
   - Sort by date, amount

4. **Products Page** (`test-app/src/components/sample-app/dashboard/pages/Products.tsx`)
   - Product catalog table
   - Product details: Name, Category, Price, Stock
   - Low stock indicators

## Phase 5: Data Integration
**Hooks and utilities:**

1. **useNorthwindData Hook** (`test-app/src/hooks/useNorthwindData.ts`)
   - Fetch data from Northwind tables
   - Calculate metrics (revenue, order counts)
   - Cache results for performance

2. **Business Logic Utilities** (`test-app/src/lib/northwind-utils.ts`)
   - Revenue calculations
   - Top customers/products queries
   - Order statistics

## Phase 6: Error Handling & UX
**User experience enhancements:**

1. **Toast Notifications**
   - Success messages for login/logout
   - Error messages for failed operations
   - Loading indicators

2. **Loading States**
   - Skeleton loaders for data fetching
   - Button loading states
   - Page transitions

3. **Error Boundaries**
   - Catch and display errors gracefully
   - Fallback UI for critical failures

## Implementation Order:
1. Install required dependencies (react-hook-form, sonner)
2. Add missing shadcn components
3. Create auth context and hooks
4. Build authentication forms
5. Implement protected routes
6. Create dashboard layout with sidebar
7. Add user profile dropdown
8. Build overview page with metrics
9. Implement data pages (customers, orders, products)
10. Add error handling and loading states
11. Test complete flow end-to-end

## Testing Strategy:
- Test authentication flow (signup → login → dashboard → logout)
- Verify protected routes redirect properly
- Test form validations and error states
- Verify data displays correctly from Northwind
- Test responsive design on mobile
- Ensure all user interactions work smoothly

## Success Criteria:
✅ User can sign up with email/password
✅ User can sign in and access dashboard
✅ Dashboard shows real Northwind data
✅ User profile dropdown works with logout
✅ All forms show proper error messages
✅ Protected routes prevent unauthorized access
✅ Professional UI matching existing test-app design

## Current Status
- [ ] Phase 1: Add Required shadcn Components
- [ ] Phase 2: Authentication System
- [ ] Phase 3: Dashboard Layout
- [ ] Phase 4: Dashboard Content
- [ ] Phase 5: Data Integration
- [ ] Phase 6: Error Handling & UX