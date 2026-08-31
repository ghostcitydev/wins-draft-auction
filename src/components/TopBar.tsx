"use client";

import { useEffect, useState, useCallback } from "react";

function timeAgo(iso: string | null): string {
  if (!iso) return "never synced";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TopBar({ title }: { title: string }) {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const data = await res.json();
      setLastSync(data.lastSync ?? null);
      setSeason(data.season ?? null);
    } catch {
      // ignore - top bar is informational only
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount is intentional
    loadConfig();
    const interval = setInterval(loadConfig, 30000);
    return () => clearInterval(interval);
  }, [loadConfig]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      await loadConfig();
      window.dispatchEvent(new Event("wins-draft:refresh"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-lg safe-top">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-xs text-muted">{season ? `${season} season` : " "}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted active:scale-95 transition disabled:opacity-60"
        >
          <span
            className={syncing ? "animate-spin" : ""}
            style={{ display: "inline-flex" }}
          >
            <RefreshIcon className="h-3.5 w-3.5" />
          </span>
          {syncing ? "Syncing…" : timeAgo(lastSync)}
        </button>
      </div>
    </header>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
