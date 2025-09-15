import React from 'react'
import { APISection } from '../../../pages/APIDocs'

interface MoreResourcesProps {
  activeSection: APISection
  codeLanguage: 'javascript' | 'bash'
}

export default function MoreResources({ activeSection, codeLanguage }: MoreResourcesProps) {
  const getTitle = () => {
    switch (activeSection) {
      case 'guides':
        return 'Guides'
      case 'api-reference':
        return 'API Reference'
      default:
        return 'More Resources'
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{getTitle()}</h1>
      <p className="text-muted-foreground">{getTitle()} documentation coming soon...</p>
    </div>
  )
}