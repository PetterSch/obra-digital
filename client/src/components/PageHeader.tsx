import { ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronRight, LucideIcon } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumb?: Crumb[];
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumb, title, description, icon: Icon, actions }: PageHeaderProps) {
  const [, navigate] = useLocation();
  return (
    <div className="mb-6 space-y-2">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          {breadcrumb.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
              {c.href && i < breadcrumb.length - 1 ? (
                <button onClick={() => navigate(c.href!)} className="hover:text-foreground transition-colors">{c.label}</button>
              ) : (
                <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
            {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
