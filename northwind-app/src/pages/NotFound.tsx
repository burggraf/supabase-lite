import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants'
import { Home } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold text-gray-900">404</CardTitle>
            <p className="text-xl text-gray-600 mt-2">Page Not Found</p>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-500 mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Button asChild>
              <Link to={ROUTES.DASHBOARD}>
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}