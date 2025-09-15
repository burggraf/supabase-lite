import React from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { APISection } from '../../pages/APIDocs'
import { useDynamicTables } from '../../hooks/useDynamicTables'

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

// Static sections (excluding TABLES AND VIEWS which will be dynamic)
const getStaticSections = (): SidebarSection[] => [
  {
    title: 'GETTING STARTED',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'user-management', label: 'User Management' },
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
    title: 'MORE RESOURCES',
    items: [
      { id: 'guides', label: 'Guides' },
      { id: 'api-reference', label: 'API Reference' },
    ],
  },
]

export default function APISidebar({ activeSection, onSectionChange }: APISidebarProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['GETTING STARTED', 'TABLES AND VIEWS', 'STORED PROCEDURES', 'MORE RESOURCES'])
  )

  // Dynamic tables hook
  const { tables, hasMore, isLoading, error, loadMore } = useDynamicTables('public')

  // Generate dynamic TABLES AND VIEWS section
  const getTablesSection = (): SidebarSection => {
    const tableItems = tables.map(table => ({
      id: `table-${table.name}` as APISection,
      label: table.name
    }))

    return {
      title: 'TABLES AND VIEWS',
      items: [
        { id: 'tables-intro', label: 'Introduction' },
        ...tableItems
      ]
    }
  }

  // Combine static and dynamic sections
  const getAllSections = (): SidebarSection[] => {
    const staticSections = getStaticSections()
    const tablesSection = getTablesSection()

    // Insert tables section after GETTING STARTED
    return [
      staticSections[0], // GETTING STARTED
      tablesSection,     // TABLES AND VIEWS (dynamic)
      ...staticSections.slice(1) // STORED PROCEDURES, MORE RESOURCES
    ]
  }

  const sidebarSections = getAllSections()

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
                    {section.items.map((item) => {
                      // Handle external links for MORE RESOURCES section
                      if (section.title === 'MORE RESOURCES') {
                        const handleExternalClick = () => {
                          if (item.id === 'guides') {
                            window.open('https://supabase.com/docs', '_blank')
                          } else if (item.id === 'api-reference') {
                            window.open('https://supabase.com/docs/guides/api', '_blank')
                          }
                        }

                        return (
                          <li key={item.id}>
                            <button
                              onClick={handleExternalClick}
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                                'hover:bg-muted text-muted-foreground'
                              )}
                            >
                              {item.label}
                            </button>
                          </li>
                        )
                      }

                      // Regular internal navigation
                      return (
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
                      )
                    })}

                    {/* Special handling for TABLES AND VIEWS section */}
                    {section.title === 'TABLES AND VIEWS' && (
                      <>
                        {/* Loading state */}
                        {isLoading && (
                          <li>
                            <div className="flex items-center px-3 py-2 text-sm text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin mr-2" />
                              Loading tables...
                            </div>
                          </li>
                        )}

                        {/* Error state */}
                        {error && !isLoading && (
                          <li>
                            <div className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-md mx-1">
                              Error: {error}
                            </div>
                          </li>
                        )}

                        {/* More button for pagination */}
                        {hasMore && !isLoading && !error && (
                          <li>
                            <button
                              onClick={loadMore}
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                                'hover:bg-muted text-muted-foreground border border-dashed border-muted-foreground/30',
                                'flex items-center justify-center'
                              )}
                            >
                              More tables...
                            </button>
                          </li>
                        )}
                      </>
                    )}
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