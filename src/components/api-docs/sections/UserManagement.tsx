import React from 'react'
import { Card } from '../../ui/card'
import { Badge } from '../../ui/badge'

interface UserManagementProps {
  codeLanguage: 'javascript' | 'bash'
}

export default function UserManagement({ codeLanguage }: UserManagementProps) {
  const getSignUpExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase.auth.signUp({
  email: 'example@email.com',
  password: 'example-password',
  options: {
    data: {
      first_name: 'John',
      age: 27,
    }
  }
})`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/auth/v1/signup' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "email": "example@email.com",
  "password": "example-password",
  "data": {
    "first_name": "John",
    "age": 27
  }
}'`
    }
  }

  const getSignInExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase.auth.signInWithPassword({
  email: 'example@email.com',
  password: 'example-password',
})`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "email": "example@email.com",
  "password": "example-password"
}'`
    }
  }

  const getSignOutExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { error } = await supabase.auth.signOut()`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/auth/v1/logout' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer USER_JWT_TOKEN"`
    }
  }

  const getUserExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data: { user } } = await supabase.auth.getUser()`
    } else {
      return `curl -X GET 'https://your-project.supabase.co/auth/v1/user' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer USER_JWT_TOKEN"`
    }
  }

  const getUpdateUserExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase.auth.updateUser({
  email: 'new@email.com',
  password: 'new-password',
  data: {
    first_name: 'Jane',
    age: 25,
  }
})`
    } else {
      return `curl -X PUT 'https://your-project.supabase.co/auth/v1/user' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Authorization: Bearer USER_JWT_TOKEN" \\
-H "Content-Type: application/json" \\
-d '{
  "email": "new@email.com",
  "password": "new-password",
  "data": {
    "first_name": "Jane",
    "age": 25
  }
}'`
    }
  }

  const getPasswordResetExample = () => {
    if (codeLanguage === 'javascript') {
      return `const { data, error } = await supabase.auth.resetPasswordForEmail(
  'example@email.com',
  {
    redirectTo: 'https://example.com/update-password',
  }
)`
    } else {
      return `curl -X POST 'https://your-project.supabase.co/auth/v1/recover' \\
-H "apikey: YOUR_SUPABASE_KEY" \\
-H "Content-Type: application/json" \\
-d '{
  "email": "example@email.com"
}'`
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      <div className="prose prose-neutral dark:prose-invert max-w-none mb-8">
        <p className="text-lg text-muted-foreground">
          Supabase Auth provides a complete user management system with signup, signin, password reset,
          and user data management capabilities.
        </p>
      </div>

      {/* Sign Up */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Sign Up</h2>
        <p className="text-muted-foreground mb-4">
          Create a new user account with email and password. You can also include additional user data.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">SIGN UP NEW USER</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getSignUpExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Sign In */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Sign In</h2>
        <p className="text-muted-foreground mb-4">
          Authenticate an existing user with their email and password.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">SIGN IN WITH PASSWORD</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getSignInExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Sign Out */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Sign Out</h2>
        <p className="text-muted-foreground mb-4">
          Sign out the current user and invalidate their session.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">SIGN OUT</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getSignOutExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Get User */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Get Current User</h2>
        <p className="text-muted-foreground mb-4">
          Retrieve the current authenticated user's information.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">GET USER</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getUserExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Update User */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Update User</h2>
        <p className="text-muted-foreground mb-4">
          Update the current user's email, password, or metadata.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">UPDATE USER</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getUpdateUserExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Password Reset */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Password Reset</h2>
        <p className="text-muted-foreground mb-4">
          Send a password reset email to the user.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">RESET PASSWORD</h3>
          <Badge variant="outline" className="text-xs">
            {codeLanguage === 'javascript' ? 'JavaScript' : 'Bash'}
          </Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{getPasswordResetExample()}</code>
          </pre>
        </Card>
      </div>

      {/* Auth State */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Listen to Auth State</h2>
        <p className="text-muted-foreground mb-4">
          Listen for authentication state changes to handle user sessions.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold">AUTH STATE LISTENER</h3>
          <Badge variant="outline" className="text-xs">JavaScript</Badge>
        </div>
        <Card className="p-4">
          <pre className="text-sm overflow-x-auto">
            <code>{`supabase.auth.onAuthStateChange((event, session) => {
  console.log(event, session)

  if (event === 'INITIAL_SESSION') {
    // handle initial session
  } else if (event === 'SIGNED_IN') {
    // handle sign in event
  } else if (event === 'SIGNED_OUT') {
    // handle sign out event
  } else if (event === 'PASSWORD_RECOVERY') {
    // handle password recovery event
  } else if (event === 'TOKEN_REFRESHED') {
    // handle token refreshed event
  } else if (event === 'USER_UPDATED') {
    // handle user updated event
  }
})`}</code>
          </pre>
        </Card>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Authentication Notes</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• All authenticated requests automatically include the user's JWT token</li>
          <li>• Row Level Security (RLS) policies are enforced based on the authenticated user</li>
          <li>• Sessions are automatically refreshed when they expire</li>
          <li>• User metadata can be updated and retrieved along with auth operations</li>
        </ul>
      </div>
    </div>
  )
}