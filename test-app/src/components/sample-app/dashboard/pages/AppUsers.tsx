import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card'
import { Button } from '../../../ui/button'
import { Skeleton } from '../../../ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table'
import { useAppUsers } from '../../../../hooks/useAppUsers'
import { UserCog, RefreshCw, Calendar, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function AppUsers() {
  const { users, loading, error, refreshUsers } = useAppUsers()

  const handleRefresh = async () => {
    await refreshUsers()
  }

  const formatFullName = (firstName: string | null, lastName: string | null) => {
    const parts = [firstName, lastName].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : 'No name provided'
  }

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
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
            <UserCog className="h-8 w-8 mr-3 text-blue-600" />
            App Users
          </h1>
          <p className="text-muted-foreground">
            Manage application users and their profile information
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            All Application Users
            {!loading && (
              <span className="text-sm font-normal text-muted-foreground">
                {users.length} user{users.length !== 1 ? 's' : ''} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Profile Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        {user.email || 'No email'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatFullName(user.first_name, user.last_name)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {user.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDate(user.created_at)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No users found</p>
              <p>No application users have been registered yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}