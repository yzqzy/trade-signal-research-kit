"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

type AppTheme = "light" | "dark" | "system";

const OPTIONS: { value: AppTheme; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

const stroke = {
  width: 1.5 as const,
  cap: "round" as const,
  join: "round" as const,
};

/** 细线太阳（Heroicons outline 风格，小尺寸更清晰） */
function IconSun({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.width}
      strokeLinecap={stroke.cap}
      strokeLinejoin={stroke.join}
      aria-hidden
    >
      <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

/** 细线月亮 */
function IconMoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.width}
      strokeLinecap={stroke.cap}
      strokeLinejoin={stroke.join}
      aria-hidden
    >
      <path d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

/** 细线显示器（简化为屏 + 底座，避免粗实心块） */
function IconSystem({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.width}
      strokeLinecap={stroke.cap}
      strokeLinejoin={stroke.join}
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 19.5h6M12 16.5V19" />
    </svg>
  );
}

function themeIcon(value: AppTheme, className: string) {
  if (value === "light") return <IconSun className={className} />;
  if (value === "dark") return <IconMoon className={className} />;
  return <IconSystem className={className} />;
}

function normalizeTheme(theme: string | undefined): AppTheme {
  if (theme === "light" || theme === "dark" || theme === "system") return theme;
  return "system";
}

/**
 * 外观主题：圆形幽灵按钮 + 单层阴影菜单；描边图标，避免粗边框与 ring/border 叠层。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = normalizeTheme(theme);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mounted) {
    return <span className="inline-flex h-9 w-9 shrink-0 rounded-full bg-gray-100/50 dark:bg-neutral-800/40" aria-hidden />;
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`外观主题，当前：${OPTIONS.find((o) => o.value === active)?.label ?? active}`}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors dark:text-neutral-300 ${
          open
            ? "bg-gray-100 dark:bg-neutral-800"
            : "hover:bg-gray-100/90 dark:hover:bg-neutral-800/80"
        }`}
      >
        {themeIcon(active, "h-[1.125rem] w-[1.125rem]")}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 min-w-38 overflow-hidden rounded-lg bg-white py-0.5 text-gray-800 shadow-[0_2px_12px_rgba(15,23,42,0.08)] dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
          role="listbox"
          aria-label="选择外观主题"
        >
          {OPTIONS.map((opt) => {
            const selected = active === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center gap-2 py-2 pl-3 pr-3 text-left text-sm transition-colors ${
                  selected
                    ? "bg-emerald-50 text-gray-900 dark:bg-emerald-950/40 dark:text-white"
                    : "text-gray-600 hover:bg-gray-50/80 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
                }`}
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                }}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500 dark:text-neutral-400">
                  {themeIcon(opt.value, "h-3.5 w-3.5")}
                </span>
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
