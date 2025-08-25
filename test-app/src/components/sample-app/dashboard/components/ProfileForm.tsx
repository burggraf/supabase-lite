import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '../../../ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form'
import { Input } from '../../../ui/input'
import { Textarea } from '../../../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card'
import { Separator } from '../../../ui/separator'
import { SaveIcon, XIcon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfileFormProps, ProfileFormData } from '../../../../types/profile'

// Form validation schema
const profileSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be 50 characters or less')
    .trim(),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be 50 characters or less')
    .trim(),
  about_me: z
    .string()
    .max(500, 'About me must be 500 characters or less')
    .optional()
    .transform(val => val || ''),
})

export default function ProfileForm({ profile, loading, onSave, onCancel }: ProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      about_me: profile?.about_me || '',
    },
  })

  // Reset form values when profile changes
  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        about_me: profile.about_me || '',
      })
    }
  }, [profile, form])

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsSubmitting(true)
      
      const result = await onSave(data)
      
      if (result.success) {
        toast.success('Profile updated successfully!')
        onCancel?.() // Close the edit mode
      } else {
        toast.error(result.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error submitting profile:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    // Reset form to original values
    form.reset({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      about_me: profile?.about_me || '',
    })
    onCancel?.()
  }

  const isLoading = loading || isSubmitting

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          User Profile
        </CardTitle>
        <CardDescription>
          Update your personal information and tell others about yourself
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name Fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your first name"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your last name"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* About Me Field */}
            <FormField
              control={form.control}
              name="about_me"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About Me</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell others about yourself, your interests, or what you do..."
                      className="min-h-[100px] resize-none"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between">
                    <FormMessage />
                    <span className="text-xs text-muted-foreground">
                      {field.value?.length || 0}/500 characters
                    </span>
                  </div>
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              
              <Button 
                type="submit" 
                disabled={isLoading}
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-4 w-4 mr-2" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}