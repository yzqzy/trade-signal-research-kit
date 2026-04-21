"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** Heroicons 24 solid Sun */
function IconSunSolid({ className }: { className?: string }) {
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
function IconMoonSolid({ className }: { className?: string }) {
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

const segBase =
  "flex h-8 min-w-[2.75rem] flex-1 items-center justify-center rounded-sm px-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400";

const segInactive =
  "text-gray-500 hover:bg-gray-200/70 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-100";

const segActive =
  "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-600/80";

const iconClass = "h-5 w-5 shrink-0";

/**
 * 浅色 / 深色：与顶栏同一语系的分段控件，无「大圈套小图」；图标约 20px。
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="inline-flex h-9 w-[6.25rem] shrink-0" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark" || resolvedTheme === undefined;

  return (
    <div
      className="inline-flex h-9 rounded-md border border-gray-200 bg-gray-100/80 p-0.5 dark:border-neutral-600 dark:bg-neutral-800/50"
      role="group"
      aria-label="主题：浅色或深色"
    >
      <button
        type="button"
        className={`${segBase} ${!isDark ? segActive : segInactive}`}
        onClick={() => setTheme("light")}
        title="浅色"
        aria-pressed={!isDark}
        aria-label="切换到浅色"
      >
        <IconSunSolid className={iconClass} />
      </button>
      <button
        type="button"
        className={`${segBase} ${isDark ? segActive : segInactive}`}
        onClick={() => setTheme("dark")}
        title="深色"
        aria-pressed={isDark}
        aria-label="切换到深色"
      >
        <IconMoonSolid className={iconClass} />
      </button>
    </div>
  );
}
