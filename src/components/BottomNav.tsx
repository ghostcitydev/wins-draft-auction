"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/", label: "Standings", icon: TrophyIcon },
  { href: "/stats", label: "Stats", icon: ChartIcon },
  { href: "/archive", label: "Archive", icon: ArchiveIcon },
  { href: "/bets", label: "Bets", icon: DiceIcon },
  { href: "/admin", label: "Setup", icon: GearIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              <Icon
                className={clsx(
                  "h-6 w-6 transition-colors",
                  active ? "text-accent" : "text-muted"
                )}
              />
              <span
                className={clsx(
                  "text-[11px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M12 12v3M9 20h6M10 15h4v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="7.5" cy="15" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="13" cy="9" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4.5 8.5v9a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-9" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 12.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2M12 18.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3.5 12h2M18.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
