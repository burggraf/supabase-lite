import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser, UseAppUsersReturn } from '../types/appUsers'

export function useAppUsers(): UseAppUsersReturn {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all profiles - this is the only user data we should have access to
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })

      if (profilesError) {
        throw new Error(profilesError.message)
      }

      // Map profiles to AppUser format (without email and auth data since we can't access that)
      const usersData: AppUser[] = (profilesData || []).map(profile => ({
        id: profile.id,
        email: '', // We don't have access to auth.users email data in a real app
        first_name: profile.first_name,
        last_name: profile.last_name,
        email_confirmed_at: null, // We don't have access to auth data
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }))

      setUsers(usersData)
    } catch (err) {
      console.error('Error fetching app users:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch app users'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshUsers = useCallback(async () => {
    await fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    refreshUsers,
  }
}