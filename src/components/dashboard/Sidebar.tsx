import { 
  LayoutDashboard, 
  FileText, 
  Table, 
  Shield, 
  FolderOpen, 
  Zap, 
  Code, 
  BookOpen,
  Database,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const iconMap = {
  LayoutDashboard,
  FileText,
  Table,
  Shield,
  FolderOpen,
  Zap,
  Code,
  BookOpen,
  Database,
  Settings,
};

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard' as keyof typeof iconMap,
      badge: null,
    },
    {
      id: 'sql-editor',
      label: 'SQL Editor',
      icon: 'FileText' as keyof typeof iconMap,
      badge: null,
    },
    {
      id: 'table-editor',
      label: 'Table Editor',
      icon: 'Table' as keyof typeof iconMap,
      badge: null,
    },
    {
      section: 'Services'
    },
    {
      id: 'auth',
      label: 'Authentication',
      icon: 'Shield' as keyof typeof iconMap,
      badge: 'Coming Soon',
    },
    {
      id: 'storage',
      label: 'Storage',
      icon: 'FolderOpen' as keyof typeof iconMap,
      badge: 'Coming Soon',
    },
    {
      id: 'realtime',
      label: 'Realtime',
      icon: 'Zap' as keyof typeof iconMap,
      badge: 'Coming Soon',
    },
    {
      id: 'edge-functions',
      label: 'Edge Functions',
      icon: 'Code' as keyof typeof iconMap,
      badge: 'Coming Soon',
    },
    {
      section: 'Tools'
    },
    {
      id: 'api',
      label: 'API Docs',
      icon: 'BookOpen' as keyof typeof iconMap,
      badge: 'Coming Soon',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center space-x-2">
          <Database className="h-6 w-6 text-green-500" />
          <div>
            <h1 className="font-semibold text-lg">Supabase Lite</h1>
            <p className="text-xs text-muted-foreground">Local Development</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigationItems.map((item, index) => {
          if ('section' in item) {
            return (
              <div key={index} className="pt-4 pb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {item.section}
                </h3>
              </div>
            );
          }

          const Icon = iconMap[item.icon];
          const isActive = currentPage === item.id;
          const isDisabled = item.badge === 'Coming Soon';

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onPageChange(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={isDisabled}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          <span>Connected to PGlite</span>
        </div>
      </div>
    </div>
  );
}