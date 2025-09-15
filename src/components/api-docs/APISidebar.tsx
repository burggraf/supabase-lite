import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { APISection } from '../../pages/APIDocs'

interface APISidebarProps {
  activeSection: APISection
  onSectionChange: (section: APISection) => void
}

interface SidebarSection {
  title: string
  items: {
    id: APISection
    label: string
  }[]
}

const sidebarSections: SidebarSection[] = [
  {
    title: 'GETTING STARTED',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'user-management', label: 'User Management' },
    ],
  },
  {
    title: 'TABLES AND VIEWS',
    items: [
      { id: 'tables-intro', label: 'Introduction' },
      { id: 'table-orders', label: 'orders' },
      { id: 'table-products', label: 'products' },
    ],
  },
  {
    title: 'STORED PROCEDURES',
    items: [
      { id: 'procedures-intro', label: 'Introduction' },
      { id: 'procedure-get_category_summary', label: 'get_category_summary' },
      { id: 'procedure-get_product_stats', label: 'get_product_stats' },
      { id: 'procedure-get_products_by_category', label: 'get_products_by_category' },
    ],
  },
  {
    title: 'GRAPHQL',
    items: [
      { id: 'graphql', label: 'GraphiQL' },
    ],
  },
  {
    title: 'MORE RESOURCES',
    items: [
      { id: 'guides', label: 'Guides' },
      { id: 'api-reference', label: 'API Reference' },
    ],
  },
]

export default function APISidebar({ activeSection, onSectionChange }: APISidebarProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['GETTING STARTED', 'TABLES AND VIEWS', 'STORED PROCEDURES', 'GRAPHQL', 'MORE RESOURCES'])
  )

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle)
      } else {
        newSet.add(sectionTitle)
      }
      return newSet
    })
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-6">API Docs</h2>

        <nav className="space-y-6">
          {sidebarSections.map((section) => {
            const isExpanded = expandedSections.has(section.title)

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <ul className="mt-3 space-y-1">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => onSectionChange(item.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                            'hover:bg-muted',
                            activeSection === item.id
                              ? 'bg-muted font-medium text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}