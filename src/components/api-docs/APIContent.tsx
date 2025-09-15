import React from 'react'
import { APISection } from '../../pages/APIDocs'
import CodeToggle from './CodeToggle'
import Introduction from './sections/Introduction'
import Authentication from './sections/Authentication'
import UserManagement from './sections/UserManagement'
import TablesIntro from './sections/TablesIntro'
import DynamicTableDocs from './sections/DynamicTableDocs'
import StoredProcedures from './sections/StoredProcedures'

interface APIContentProps {
  activeSection: APISection
  codeLanguage: 'javascript' | 'bash'
  onLanguageChange: (language: 'javascript' | 'bash') => void
}

export default function APIContent({ activeSection, codeLanguage, onLanguageChange }: APIContentProps) {
  const renderContent = () => {
    // Handle dynamic table sections
    if (activeSection.startsWith('table-')) {
      const tableName = activeSection.replace('table-', '')
      return <DynamicTableDocs tableName={tableName} codeLanguage={codeLanguage} />
    }

    // Handle static sections
    switch (activeSection) {
      case 'introduction':
        return <Introduction codeLanguage={codeLanguage} />
      case 'authentication':
        return <Authentication codeLanguage={codeLanguage} />
      case 'user-management':
        return <UserManagement codeLanguage={codeLanguage} />
      case 'tables-intro':
        return <TablesIntro codeLanguage={codeLanguage} />
      case 'procedures-intro':
      case 'procedure-get_category_summary':
      case 'procedure-get_product_stats':
      case 'procedure-get_products_by_category':
        return <StoredProcedures activeSection={activeSection} codeLanguage={codeLanguage} />
      default:
        return <Introduction codeLanguage={codeLanguage} />
    }
  }

  return (
    <div className="h-full">
      {/* Header with language toggle */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-screen-2xl h-14 flex items-center justify-end pr-8">
          <CodeToggle
            language={codeLanguage}
            onLanguageChange={onLanguageChange}
          />
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-screen-2xl py-8 pl-8">
        {renderContent()}
      </div>
    </div>
  )
}