import React from 'react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface CodeToggleProps {
  language: 'javascript' | 'bash'
  onLanguageChange: (language: 'javascript' | 'bash') => void
}

export default function CodeToggle({ language, onLanguageChange }: CodeToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={language === 'javascript' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onLanguageChange('javascript')}
        className={cn(
          'h-8 px-3 text-xs',
          language === 'javascript' && 'bg-primary text-primary-foreground'
        )}
      >
        JavaScript
      </Button>
      <Button
        variant={language === 'bash' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onLanguageChange('bash')}
        className={cn(
          'h-8 px-3 text-xs',
          language === 'bash' && 'bg-primary text-primary-foreground'
        )}
      >
        Bash
      </Button>
    </div>
  )
}