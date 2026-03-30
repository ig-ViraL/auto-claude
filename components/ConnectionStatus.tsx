"use client";

type Status = "connecting" | "connected" | "reconnecting" | "disconnected";

export function ConnectionStatus({ status }: { status: Status }) {
  const config = {
    connecting: { dot: "bg-yellow-400 animate-pulse", label: "Connecting…" },
    connected: { dot: "bg-emerald-400", label: "Live" },
    reconnecting: { dot: "bg-orange-400 animate-pulse", label: "Reconnecting…" },
    disconnected: { dot: "bg-red-500", label: "Disconnected" },
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
