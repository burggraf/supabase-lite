import React, { useState } from 'react'
import APISidebar from '../components/api-docs/APISidebar'
import APIContent from '../components/api-docs/APIContent'

export type APISection =
  | 'introduction'
  | 'authentication'
  | 'user-management'
  | 'tables-intro'
  | `table-${string}` // Dynamic table names following the pattern table-{tableName}
  | 'procedures-intro'
  | `function-${string}` // Dynamic function names following the pattern function-{functionName}
  | 'guides'
  | 'api-reference'

export interface APIDocsState {
  activeSection: APISection
  codeLanguage: 'javascript' | 'bash'
}

export default function APIDocs() {
  const [activeSection, setActiveSection] = useState<APISection>('introduction')
  const [codeLanguage, setCodeLanguage] = useState<'javascript' | 'bash'>('javascript')

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/50">
        <APISidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <APIContent
          activeSection={activeSection}
          codeLanguage={codeLanguage}
          onLanguageChange={setCodeLanguage}
        />
      </div>
    </div>
  )
}