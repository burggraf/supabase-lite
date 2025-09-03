import { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Table, 
  Shield, 
  FolderOpen, 
  Code2,
  Zap, 
  Globe, 
  BookOpen,
  Database,
  Settings,
  TestTube,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { EnhancedOfflineIndicator } from '@/components/ui/EnhancedOfflineIndicator';

const iconMap = {
  LayoutDashboard,
  FileText,
  Table,
  Shield,
  FolderOpen,
  Code2,
  Zap,
  Globe,
  BookOpen,
  Database,
  Settings,
  TestTube,
  HardDrive,
};

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  currentProjectName?: string;
}

export function Sidebar({ currentPage, onPageChange, currentProjectName }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      id: 'database',
      label: 'Database',
      icon: 'Database' as keyof typeof iconMap,
      badge: null,
    },
    {
      section: 'Services'
    },
    {
      id: 'auth',
      label: 'Authentication',
      icon: 'Shield' as keyof typeof iconMap,
      badge: null,
    },
    {
      id: 'storage',
      label: 'Storage',
      icon: 'FolderOpen' as keyof typeof iconMap,
      badge: null,
    },
    {
      id: 'edge-functions',
      label: 'Edge Functions',
      icon: 'Code2' as keyof typeof iconMap,
      badge: null,
    },
    {
      id: 'realtime',
      label: 'Realtime',
      icon: 'Zap' as keyof typeof iconMap,
      badge: 'Coming Soon',
    },
    {
      id: 'app-hosting',
      label: 'App Hosting',
      icon: 'Globe' as keyof typeof iconMap,
      badge: null,
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
    {
      id: 'api-test',
      label: 'API Tester',
      icon: 'TestTube' as keyof typeof iconMap,
      badge: null,
    },
    {
      id: 'cache-manager',
      label: 'Cache Manager',
      icon: 'HardDrive' as keyof typeof iconMap,
      badge: 'Dev',
    },
  ];

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-200 ease-in-out",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center space-x-2">
          <Database className={cn("text-green-500 flex-shrink-0", isExpanded ? "h-6 w-6" : "h-5 w-5")} />
          {isExpanded && (
            <div className="min-w-0">
              <h1 className="font-semibold text-lg truncate">Supabase Lite</h1>
              <p className="text-xs text-muted-foreground truncate">
                {currentProjectName || 'Local Development'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-hidden">
        {navigationItems.map((item, index) => {
          if ('section' in item) {
            return isExpanded ? (
              <div key={index} className="pt-4 pb-2 px-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
                  {item.section}
                </h3>
              </div>
            ) : (
              <div key={index} className="pt-2 pb-1">
                <div className="h-px bg-border mx-2"></div>
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
                "w-full flex items-center rounded-md text-sm font-medium transition-colors relative group",
                isExpanded ? "space-x-3 px-3 py-2" : "justify-center p-2",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
                isDisabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={isDisabled}
              title={!isExpanded ? item.label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {isExpanded && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-3">
        <div className={cn(
          "flex",
          isExpanded ? "flex-col space-y-2" : "flex-col items-center space-y-2"
        )}>
          <EnhancedOfflineIndicator 
            iconOnly={!isExpanded} 
            showDevToggle={isExpanded} 
            compact={isExpanded}
          />
        </div>
        <div className={cn(
          "flex items-center text-xs text-muted-foreground",
          isExpanded ? "space-x-2" : "justify-center"
        )}>
          <div className="h-2 w-2 bg-green-500 rounded-full flex-shrink-0"></div>
          {isExpanded && <span className="truncate">Connected to PGlite</span>}
        </div>
        <div className={cn(
          "flex items-center",
          isExpanded ? "justify-start" : "justify-center"
        )}>
          <ThemeToggle showLabel={isExpanded} />
        </div>
      </div>
    </div>
  );
}