"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";

interface ArchiveFile {
  name: string;
  title: string;
  url: string;
  sizeBytes: number;
  modifiedAt: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArchivePage() {
  const [files, setFiles] = useState<ArchiveFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/archive", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setFiles(data.files ?? []);
        if (data.error) setError(data.error);
      })
      .catch(() => setError("Failed to load archive"));
  }, []);

  return (
    <>
      <TopBar title="Archive" />
      <main className="mx-auto max-w-2xl px-3 pt-4 pb-6">
        <p className="mb-3 px-1 text-sm text-muted">
          Past seasons&apos; recap PDFs and reference material.
        </p>

        {files === null && !error && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">{error}</div>
        )}

        {files?.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Nothing here yet. Drop a PDF into <code>public/archive/</code> and push - it&apos;ll show up here automatically.
          </div>
        )}

        <div className="space-y-2">
          {files?.map((f) => (
            <a
              key={f.name}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 active:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold capitalize">{f.title}</div>
                <div className="text-[11px] text-muted">
                  {new Date(f.modifiedAt).toLocaleDateString()} · {fmtSize(f.sizeBytes)}
                </div>
              </div>
              <span className="text-muted">→</span>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
