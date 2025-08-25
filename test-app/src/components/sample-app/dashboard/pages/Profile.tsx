import { useAuth } from '../../../../contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar'
import { Badge } from '../../../ui/badge'
import { Separator } from '../../../ui/separator'
import { CalendarIcon, MailIcon, UserIcon, ShieldCheckIcon, ClockIcon } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">No user data available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const initials = user.email
    .split('@')[0]
    .split('.')
    .map(part => part.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2)

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* Main Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage 
                  src={user.user_metadata?.avatar_url} 
                  alt={user.email} 
                />
                <AvatarFallback className="bg-blue-500 text-white text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-semibold">
                  {user.user_metadata?.full_name || 'User'}
                </h2>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Account Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Account Details</h3>
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MailIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Email:</span>
                    <span className="text-sm">{user.email}</span>
                    {user.email_confirmed_at ? (
                      <Badge variant="secondary" className="ml-2">
                        <ShieldCheckIcon className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">
                        Unverified
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">User ID:</span>
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded text-xs">
                      {user.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Member since:</span>
                    <span className="text-sm">{formatDate(user.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Last sign in:</span>
                    <span className="text-sm">{formatDate(user.last_sign_in_at)}</span>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Additional Information</h3>
                <Separator />
                
                <div className="space-y-3">
                  {user.user_metadata?.full_name && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Full Name:</span>
                      <span className="text-sm">{user.user_metadata.full_name}</span>
                    </div>
                  )}

                  {user.email_confirmed_at && (
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Email verified:</span>
                      <span className="text-sm">{formatDate(user.email_confirmed_at)}</span>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="text-sm font-medium mb-2">User Metadata</h4>
                    <pre className="text-xs text-muted-foreground overflow-auto">
                      {JSON.stringify(user.user_metadata || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}