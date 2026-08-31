"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeamRow } from "@/lib/team-types";

export function useTeams(pollMs = 60000) {
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teams", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ? String(data.error) : `Request failed (${res.status})`);
      }
      setTeams(data.teams);
      setSeason(data.season);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount is intentional
    load();
    const interval = setInterval(load, pollMs);
    const onRefresh = () => load();
    window.addEventListener("wins-draft:refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("wins-draft:refresh", onRefresh);
    };
  }, [load, pollMs]);

  return { teams, season, loading, error, reload: load };
}
