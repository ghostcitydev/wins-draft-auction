"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = (window.localStorage.getItem("wins-draft-theme") as Theme | null) ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time value from localStorage on mount
    setThemeState(stored);
  }, []);

  const cycle = () => {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setThemeState(next);
    window.localStorage.setItem("wins-draft-theme", next);
    applyTheme(next);
  };

  const icon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🌓";

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${theme}`}
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm active:scale-95"
    >
      {icon}
    </button>
  );
}
