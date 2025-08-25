export interface Profile {
  id: string // UUID, references auth.users.id
  first_name: string | null
  last_name: string | null
  about_me: string | null
  created_at: string
  updated_at: string
}

export interface ProfileFormData {
  first_name: string
  last_name: string
  about_me: string
}

export interface ProfileResponse {
  success: boolean
  error?: string
  profile?: Profile
}

export interface UseProfileReturn {
  profile: Profile | null
  loading: boolean
  error: string | null
  updateProfile: (data: ProfileFormData) => Promise<ProfileResponse>
  refreshProfile: () => Promise<void>
}

export interface ProfileFormProps {
  profile: Profile | null
  loading: boolean
  onSave: (data: ProfileFormData) => Promise<ProfileResponse>
  onCancel?: () => void
}