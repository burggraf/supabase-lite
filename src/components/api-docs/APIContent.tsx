import React from 'react'
import { APISection } from '../../pages/APIDocs'
import CodeToggle from './CodeToggle'
import Introduction from './sections/Introduction'
import Authentication from './sections/Authentication'
import UserManagement from './sections/UserManagement'
import TablesIntro from './sections/TablesIntro'
import TableDocs from './sections/TableDocs'
import StoredProcedures from './sections/StoredProcedures'
import GraphQL from './sections/GraphQL'
import MoreResources from './sections/MoreResources'

interface APIContentProps {
  activeSection: APISection
  codeLanguage: 'javascript' | 'bash'
  onLanguageChange: (language: 'javascript' | 'bash') => void
}

export default function APIContent({ activeSection, codeLanguage, onLanguageChange }: APIContentProps) {
  const renderContent = () => {
    switch (activeSection) {
      case 'introduction':
        return <Introduction codeLanguage={codeLanguage} />
      case 'authentication':
        return <Authentication codeLanguage={codeLanguage} />
      case 'user-management':
        return <UserManagement codeLanguage={codeLanguage} />
      case 'tables-intro':
        return <TablesIntro codeLanguage={codeLanguage} />
      case 'table-orders':
        return <TableDocs tableName="orders" codeLanguage={codeLanguage} />
      case 'table-products':
        return <TableDocs tableName="products" codeLanguage={codeLanguage} />
      case 'procedures-intro':
      case 'procedure-get_category_summary':
      case 'procedure-get_product_stats':
      case 'procedure-get_products_by_category':
        return <StoredProcedures activeSection={activeSection} codeLanguage={codeLanguage} />
      case 'graphql':
        return <GraphQL codeLanguage={codeLanguage} />
      case 'guides':
      case 'api-reference':
        return <MoreResources activeSection={activeSection} codeLanguage={codeLanguage} />
      default:
        return <Introduction codeLanguage={codeLanguage} />
    }
  }

  return (
    <div className="h-full">
      {/* Header with language toggle */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-screen-2xl h-14 flex items-center justify-end">
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