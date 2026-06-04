import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { ReactNode } from "react";

type Tone = "neutral" | "green" | "blue" | "amber" | "red";

const TONES: Record<Tone, { box: string; value: string }> = {
  neutral: { box: "bg-muted text-foreground/70", value: "text-foreground" },
  green: { box: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", value: "text-emerald-700 dark:text-emerald-400" },
  blue: { box: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400", value: "text-blue-700 dark:text-blue-400" },
  amber: { box: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", value: "text-amber-700 dark:text-amber-500" },
  red: { box: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400", value: "text-red-700 dark:text-red-400" },
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  trend?: { dir: "up" | "down"; text: string };
  onClick?: () => void;
}

export function StatCard({ label, value, icon: Icon, tone = "neutral", hint, trend, onClick }: StatCardProps) {
  const t = TONES[tone];
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border bg-card p-4 transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${t.box}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
            {trend && (
              <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ${trend.dir === "up" ? "text-emerald-600" : "text-red-600"}`}>
                {trend.dir === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {trend.text}
              </span>
            )}
          </div>
          <div className={`text-xl font-bold tracking-tight leading-tight truncate ${t.value}`}>{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground/70 truncate">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
