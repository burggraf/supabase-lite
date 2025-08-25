import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, ProfileFormData, ProfileResponse, UseProfileReturn } from '../types/profile'

export function useProfile(): UseProfileReturn {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        // If profile doesn't exist, that's okay - we'll create one when they save
        if (fetchError.code === 'PGRST116') {
          setProfile(null)
        } else {
          console.error('Error fetching profile:', fetchError)
          setError(fetchError.message)
        }
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err)
      setError('Failed to fetch profile data')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Update or create profile
  const updateProfile = useCallback(async (data: ProfileFormData): Promise<ProfileResponse> => {
    if (!user?.id) {
      return { success: false, error: 'User not authenticated' }
    }

    try {
      setError(null)

      const profileData = {
        first_name: data.first_name.trim() || null,
        last_name: data.last_name.trim() || null,
        about_me: data.about_me.trim() || null,
        updated_at: new Date().toISOString()
      }

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      let updatedProfile, upsertError

      if (existingProfile) {
        // Profile exists, update it
        const result = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id)
          .select()
          .single()
        updatedProfile = result.data
        upsertError = result.error
      } else {
        // Profile doesn't exist, insert it
        const result = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            ...profileData
          })
          .select()
          .single()
        updatedProfile = result.data
        upsertError = result.error
      }

      if (upsertError) {
        console.error('Error updating profile:', upsertError)
        setError(upsertError.message)
        return { success: false, error: upsertError.message }
      }

      // Update local state with the returned data
      setProfile(updatedProfile)
      
      return { success: true, profile: updatedProfile }
    } catch (err) {
      console.error('Unexpected error updating profile:', err)
      const errorMessage = 'Failed to update profile'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [user?.id])

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    await fetchProfile()
  }, [fetchProfile])

  // Load profile when user changes
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile,
  }
}