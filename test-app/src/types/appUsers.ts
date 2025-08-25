export interface AuthUser {
  id: string
  email: string
  email_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  about_me: string | null
  created_at: string
  updated_at: string
}

export interface AppUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  email_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface UseAppUsersReturn {
  users: AppUser[]
  loading: boolean
  error: string | null
  refreshUsers: () => Promise<void>
}