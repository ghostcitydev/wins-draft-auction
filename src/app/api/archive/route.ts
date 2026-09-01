import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "archive");
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const files = await Promise.all(
      entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
        .map(async (e) => {
          const stat = await fs.stat(path.join(dir, e.name));
          return {
            name: e.name,
            title: e.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
            url: `/archive/${encodeURIComponent(e.name)}`,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        })
    );

    // Sort by the year in the filename (newest first) rather than file
    // modified time, which doesn't reflect chronological season order once
    // files have all been re-synced on the same day.
    const yearOf = (name: string) => {
      const match = name.match(/\b(19|20)\d{2}\b/);
      return match ? Number(match[0]) : -Infinity;
    };
    files.sort((a, b) => yearOf(b.name) - yearOf(a.name) || b.modifiedAt.localeCompare(a.modifiedAt));
    return NextResponse.json({ files });
  } catch (err) {
    console.error("[api/archive] failed:", err);
    return NextResponse.json({ files: [], error: "Could not read archive folder" });
  }
}
