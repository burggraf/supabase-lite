import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', state: null }),
  }
})

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Loader2: vi.fn().mockImplementation(() => null),
  Menu: vi.fn().mockImplementation(() => null),
  User: vi.fn().mockImplementation(() => null),
  LogOut: vi.fn().mockImplementation(() => null),
  X: vi.fn().mockImplementation(() => null),
  Home: vi.fn().mockImplementation(() => null),
  LayoutDashboard: vi.fn().mockImplementation(() => null),
  Users: vi.fn().mockImplementation(() => null),
  ShoppingCart: vi.fn().mockImplementation(() => null),
  Package: vi.fn().mockImplementation(() => null),
  Tags: vi.fn().mockImplementation(() => null),
  Truck: vi.fn().mockImplementation(() => null),
  BarChart3: vi.fn().mockImplementation(() => null),
  Settings: vi.fn().mockImplementation(() => null),
  Plus: vi.fn().mockImplementation(() => null),
  Search: vi.fn().mockImplementation(() => null),
  TrendingUp: vi.fn().mockImplementation(() => null),
  DollarSign: vi.fn().mockImplementation(() => null),
  AlertCircle: vi.fn().mockImplementation(() => null),
  AlertTriangle: vi.fn().mockImplementation(() => null),
  RefreshCw: vi.fn().mockImplementation(() => null),
  Check: vi.fn().mockImplementation(() => null),
  ChevronDown: vi.fn().mockImplementation(() => null),
  ChevronUp: vi.fn().mockImplementation(() => null),
}))

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))