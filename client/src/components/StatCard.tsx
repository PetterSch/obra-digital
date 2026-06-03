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
      className={`rounded-2xl border bg-card p-5 transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.box}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend.dir === "up" ? "text-emerald-600" : "text-red-600"}`}>
            {trend.dir === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend.text}
          </span>
        )}
      </div>
      <div className={`mt-4 text-3xl font-bold tracking-tight ${t.value}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-muted-foreground">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground/70">{hint}</div>}
    </div>
  );
}
