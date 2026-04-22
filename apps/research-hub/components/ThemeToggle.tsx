"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

const THEMES = ["light", "dark", "system"] as const;
type AppTheme = (typeof THEMES)[number];

const LABELS: Record<AppTheme, string> = {
  light: "浅色",
  dark: "深色",
  system: "跟随系统",
};

/** Heroicons 24 solid Sun */
function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zm11.03-4.28a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM6.72 17.28a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.061 1.061l1.591-1.59zM6 12a.75.75 0 01-.75-.75v-1.5a.75.75 0 011.5 0v1.5A.75.75 0 016 12zm.97-7.53a.75.75 0 001.06 1.06l1.59-1.591a.75.75 0 10-1.061-1.06l-1.59 1.591zM18 12a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0118 12zm-2.97 7.53a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.06 1.061l1.59 1.591z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Heroicons 24 solid Moon */
function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9.528 1.028a.75.75 0 01.807.727v.008a.75.75 0 01-.638.75 9 9 0 00-6.22 10.96c.388.405.584.913.584 1.422 0 .213-.028.424-.084.626a.75.75 0 01.64 1.122 12 12 0 0010.44-10.44.75.75 0 01-1.122.64 13.5 13.5 0 00-1.726-.73 9 9 0 01-6.863-6.862 13.5 13.5 0 00-.73-1.725.75.75 0 01-.635-.644l-.09-.38zM15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Heroicons 24 solid ComputerDesktop — 跟随系统 */
function IconSystem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M2.25 5.25a3 3 0 013-3h13.5a3 3 0 013 3V15a3 3 0 01-3 3h-7.5v.75h4.5a.75.75 0 010 1.5H6a.75.75 0 010-1.5h4.5V18H5.25a3 3 0 01-3-3V5.25Zm1.5 0c0-.414.336-.75.75-.75h13.5c.414 0 .75.336.75.75v8.25c0 .414-.336.75-.75.75H5.25a.75.75 0 01-.75-.75V5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const iconClass = "h-[1.15rem] w-[1.15rem] shrink-0 sm:h-5 sm:w-5";

function ThemeIcon({ value }: { value: AppTheme }) {
  if (value === "light") return <IconSun className={iconClass} />;
  if (value === "dark") return <IconMoon className={iconClass} />;
  return <IconSystem className={iconClass} />;
}

/**
 * 浅色 / 深色 / 跟随系统：按 `theme` 选中态（不误把 `resolvedTheme` 的 undefined 当成深色）；
 * 挂载前占位与控件同高宽，减少布局跳动；`motion-reduce` 下减弱动效。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active: AppTheme = useMemo(() => {
    const t = theme as string | undefined;
    if (t === "light" || t === "dark" || t === "system") return t;
    return "system";
  }, [theme]);

  if (!mounted) {
    return (
      <span
        className="inline-flex h-9 w-27 shrink-0 rounded-lg border border-transparent bg-gray-100/50 dark:bg-neutral-800/40 sm:w-29"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="inline-flex h-9 rounded-lg border border-gray-200/90 bg-linear-to-b from-gray-50 to-gray-100/90 p-0.5 shadow-sm dark:border-neutral-600/90 dark:from-neutral-900 dark:to-neutral-950/90"
      role="radiogroup"
      aria-label="显示主题"
    >
      {THEMES.map((value) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={LABELS[value]}
            title={LABELS[value]}
            className={[
              "relative flex min-w-8 flex-1 items-center justify-center rounded-md px-1 sm:min-w-9 sm:px-1.5",
              "transition-[color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400",
              "active:scale-[0.96] motion-reduce:active:scale-100",
              selected
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-gray-200/90 dark:bg-neutral-800 dark:text-emerald-400 dark:ring-neutral-600/80"
                : "text-gray-500 hover:bg-gray-200/60 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100",
            ].join(" ")}
            onClick={() => setTheme(value)}
          >
            <ThemeIcon value={value} />
          </button>
        );
      })}
    </div>
  );
}
