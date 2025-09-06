import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AuthManager } from '@/lib/auth/core/AuthManager'
import type { User } from '@/lib/auth/types/auth.types'
import { Mail, Phone, Trash2, Eye, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { projectManager } from '@/lib/projects/ProjectManager'

interface Provider {
  provider: string
  count: number
}

export function UsersList() {
  const [authManager] = useState(() => AuthManager.getInstance())
  const [users, setUsers] = useState<User[]>([])
  const [userCount, setUserCount] = useState(0)
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [userToView, setUserToView] = useState<User | null>(null)

  // Ensure there's always an active project (let useDatabase hook handle initialization)
  const ensureActiveProject = async () => {
    let activeProject = projectManager.getActiveProject()
    
    // If no active project exists, create a default one
    if (!activeProject) {
      const allProjects = projectManager.getProjects()
      
      if (allProjects.length === 0) {
        // Create a default project - useDatabase hook will handle initialization
        activeProject = await projectManager.createProject('My First Project')
      } else {
        // Switch to the first available project - useDatabase hook will handle initialization
        activeProject = await projectManager.switchToProject(allProjects[0].id)
      }
    }
    
    return activeProject
  }

  // Load users and related data
  const loadData = async (provider?: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // Ensure there's an active project first
      await ensureActiveProject()
      
      // AuthManager initialization is handled internally
      
      const [usersResult, countResult, providersResult] = await Promise.all([
        provider && provider !== 'all' 
          ? authManager.getUsersByProvider(provider)
          : authManager.getAllUsers(),
        authManager.getUserCount(),
        authManager.getProviders()
      ])
      
      setUsers(usersResult)
      setUserCount(countResult)
      setProviders(providersResult)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Error loading users: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle provider filter change
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    loadData(provider)
  }

  // Handle view user
  const handleViewUser = (user: User) => {
    setUserToView(user)
    setViewDialogOpen(true)
  }

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  // Confirm delete user
  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    
    setDeleting(true)
    try {
      // Ensure there's an active project
      await ensureActiveProject()
      
      // AuthManager initialization is handled internally
      await authManager.deleteUser(userToDelete.id)
      setDeleteDialogOpen(false)
      setUserToDelete(null)
      // Refresh data after deletion
      await loadData(selectedProvider === 'all' ? undefined : selectedProvider)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Error deleting user: ${errorMessage}`)
    } finally {
      setDeleting(false)
    }
  }

  // Cancel delete
  const cancelDelete = () => {
    setDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  // Render provider icon
  const renderProviderIcon = (provider: string) => {
    switch (provider) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'phone':
        return <Phone className="h-4 w-4" />
      default:
        return <Mail className="h-4 w-4" />
    }
  }

  // Render provider badge
  const renderProviderBadge = (user: User) => {
    const provider = user.app_metadata?.provider || 'email'
    return (
      <div className="flex items-center gap-2">
        {renderProviderIcon(provider)}
        <Badge variant="outline">{provider.charAt(0).toUpperCase() + provider.slice(1)}</Badge>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="text-lg">Loading users...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {providers && providers.map((provider) => (
                    <SelectItem key={provider.provider} value={provider.provider}>
                      {provider.provider} ({provider.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!users || users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <>
              {/* Users Table */}
              <div className="border rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-3 py-2 bg-muted/30 border-b font-medium text-sm text-muted-foreground">
                  <div className="col-span-3">User ID</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2">Provider</div>
                  <div className="col-span-2">Created</div>
                  <div className="col-span-1">Verified</div>
                  <div className="col-span-1"></div>
                </div>
                
                {/* User Rows */}
                {users && users.map((user) => (
                  <div key={user.id} className="grid grid-cols-12 gap-4 p-3 border-b hover:bg-muted/30 transition-colors">
                    <div className="col-span-3 font-mono text-sm text-muted-foreground">
                      {user.id}
                    </div>
                    <div className="col-span-3">
                      {user.email || '-'}
                    </div>
                    <div className="col-span-2">
                      {renderProviderBadge(user)}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    <div className="col-span-1">
                      <Badge variant={user.email_verified ? "default" : "secondary"} className="text-xs">
                        {user.email_verified ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="col-span-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewUser(user)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* User Count */}
              <div className="mt-4 text-sm text-muted-foreground">
                Total: {userCount} users
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              <br />
              <br />
              <strong>Email:</strong> {userToDelete?.email || 'N/A'}
              <br />
              <strong>ID:</strong> {userToDelete?.id}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteUser}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Complete information for this user account.
            </DialogDescription>
          </DialogHeader>
          {userToView && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="font-mono text-sm mt-1 p-2 bg-muted rounded">{userToView.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{userToView.email || '-'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{userToView.phone || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{userToView.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Verified</label>
                  <p className="text-sm mt-1">
                    <Badge variant={userToView.email_verified ? "default" : "secondary"}>
                      {userToView.email_verified ? "Verified" : "Not verified"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone Verified</label>
                  <p className="text-sm mt-1">
                    <Badge variant={userToView.phone_verified ? "default" : "secondary"}>
                      {userToView.phone_verified ? "Verified" : "Not verified"}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">
                    {new Date(userToView.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Sign In</label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">
                    {userToView.last_sign_in_at ? new Date(userToView.last_sign_in_at).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Provider</label>
                <p className="text-sm mt-1">
                  {renderProviderBadge(userToView)}
                </p>
              </div>

              {userToView.user_metadata && Object.keys(userToView.user_metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Metadata</label>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-32">
                    {JSON.stringify(userToView.user_metadata, null, 2)}
                  </pre>
                </div>
              )}

              {userToView.app_metadata && Object.keys(userToView.app_metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">App Metadata</label>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-32">
                    {JSON.stringify(userToView.app_metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}