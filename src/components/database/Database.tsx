import { useState } from 'react';
import { 
  Users,
  Settings,
  Shield,
  FolderOpen,
  Zap,
  Code,
  BarChart3,
  Key,
  Link,
  List,
  Table,
  Plus,
  // Database as DatabaseIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SeedDataSection } from './SeedDataSection';
import { TablesView } from './tables/TablesView';
// import { TestTablesView } from './tables/TestTablesView';

const sidebarSections = [
  {
    title: 'DATABASE MANAGEMENT',
    items: [
      { id: 'schema', label: 'Schema Visualizer', icon: BarChart3 },
      { id: 'tables', label: 'Tables', icon: Table },
      { id: 'functions', label: 'Functions', icon: Code },
      { id: 'triggers', label: 'Triggers', icon: Zap },
      { id: 'types', label: 'Enumerated Types', icon: List },
      { id: 'extensions', label: 'Extensions', icon: Plus },
      { id: 'indexes', label: 'Indexes', icon: Key },
      { id: 'publications', label: 'Publications', icon: Link },
      { id: 'seed-data', label: 'TEST SEED DATA', icon: Plus },
      { id: 'replication', label: 'Replication', icon: Database, badge: 'Coming Soon' },
    ]
  },
  {
    title: 'CONFIGURATION',
    items: [
      { id: 'roles', label: 'Roles', icon: Users },
      { id: 'policies', label: 'Policies', icon: Shield },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  },
  {
    title: 'PLATFORM',
    items: [
      { id: 'backups', label: 'Backups', icon: FolderOpen },
      { id: 'migrations', label: 'Migrations', icon: BarChart3 },
      { id: 'wrappers', label: 'Wrappers', icon: Code },
      { id: 'webhooks', label: 'Webhooks', icon: Link },
    ]
  },
  {
    title: 'TOOLS',
    items: [
      { id: 'security', label: 'Security Advisor', icon: Shield },
      { id: 'performance', label: 'Performance Advisor', icon: BarChart3 },
      { id: 'query-perf', label: 'Query Performance', icon: BarChart3 },
    ]
  }
];

export function Database() {
  const [activeSection, setActiveSection] = useState('tables');

  return (
    <div className="flex h-full">
      {/* Database Management Sidebar */}
      <div className="w-64 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Database</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sidebarSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                        activeSection === item.id 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        item.badge === 'Coming Soon' && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (item.badge !== 'Coming Soon') {
                          setActiveSection(item.id);
                        }
                      }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeSection === 'seed-data' ? (
          <SeedDataSection />
        ) : activeSection === 'tables' ? (
          <TablesView />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">Feature Coming Soon</p>
              <p className="text-sm text-muted-foreground">
                This section is under development
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}