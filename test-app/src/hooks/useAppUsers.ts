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

      // Query the userview which combines auth.users.email with profiles data
      const { data: userviewData, error: userviewError } = await supabase
        .from('userview')
        .select(`
          id,
          email,
          first_name,
          last_name,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })

      if (userviewError) {
        throw new Error(userviewError.message)
      }

      // Map userview data to AppUser format
      const usersData: AppUser[] = (userviewData || []).map(user => ({
        id: user.id,
        email: user.email || '',
        first_name: user.first_name,
        last_name: user.last_name,
        email_confirmed_at: null, // Still don't have access to email_confirmed_at from auth
        created_at: user.created_at,
        updated_at: user.updated_at
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