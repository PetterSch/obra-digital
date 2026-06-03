import { LucideIcon } from "lucide-react";

export interface PanelAction {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ActionPanelProps {
  title: string;
  actions: PanelAction[];
}

export function ActionPanel({ title, actions }: ActionPanelProps) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="font-semibold mb-3">{title}</p>
      <div className="space-y-2">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            disabled={a.disabled}
            className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <a.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">{a.label}</span>
              {a.description && <span className="block text-xs text-muted-foreground truncate">{a.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
