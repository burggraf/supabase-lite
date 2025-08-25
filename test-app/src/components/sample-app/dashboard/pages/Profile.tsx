import { useState } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import { useProfile } from '../../../../hooks/useProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar'
import { Badge } from '../../../ui/badge'
import { Button } from '../../../ui/button'
import { Separator } from '../../../ui/separator'
import { CalendarIcon, MailIcon, UserIcon, ShieldCheckIcon, ClockIcon, EditIcon, EyeIcon } from 'lucide-react'
import ProfileForm from '../components/ProfileForm'
import { toast } from 'sonner'

export default function Profile() {
  const { user } = useAuth()
  const { profile, loading: profileLoading, error: profileError, updateProfile, refreshProfile } = useProfile()
  const [isEditing, setIsEditing] = useState(false)

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

        {/* User Profile Section */}
        {isEditing ? (
          <ProfileForm
            profile={profile}
            loading={profileLoading}
            onSave={async (data) => {
              const result = await updateProfile(data)
              if (result.success) {
                setIsEditing(false)
              }
              return result
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  <div>
                    <CardTitle>User Profile</CardTitle>
                    <CardDescription>
                      Your personal information and bio
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={profileLoading}
                >
                  <EditIcon className="h-4 w-4 mr-2" />
                  {profile ? 'Edit Profile' : 'Create Profile'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {profileError && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{profileError}</p>
                </div>
              )}

              {profileLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-20 bg-muted animate-pulse rounded" />
                </div>
              ) : profile ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">First Name</label>
                      <p className="mt-1">{profile.first_name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                      <p className="mt-1">{profile.last_name || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">About Me</label>
                    <p className="mt-1 text-sm leading-relaxed">
                      {profile.about_me ? (
                        <span dangerouslySetInnerHTML={{ 
                          __html: profile.about_me.replace(/\n/g, '<br />') 
                        }} />
                      ) : (
                        <span className="text-muted-foreground italic">
                          No bio provided. Click "Edit Profile" to add information about yourself.
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="pt-2 text-xs text-muted-foreground">
                    Last updated: {new Date(profile.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <EyeIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No profile information</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your profile to share information about yourself with others.
                  </p>
                  <Button onClick={() => setIsEditing(true)} disabled={profileLoading}>
                    <UserIcon className="h-4 w-4 mr-2" />
                    Create Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}