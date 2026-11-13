"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PollingRunRow {
  id: string;
  started_at: string;
  status: string;
  routes_succeeded: number;
  routes_failed: number;
  notifications_sent: number;
}

export function PollingRunsChart({ runs }: { runs: PollingRunRow[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        No polling runs recorded yet.
      </div>
    );
  }

  const chartData = [...runs]
    .reverse()
    .map((r) => ({
      time: new Date(r.started_at).toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      Succeeded: r.routes_succeeded,
      Failed: r.routes_failed,
      Alerts: r.notifications_sent,
    }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="Succeeded" fill="#0284c7" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Alerts" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
