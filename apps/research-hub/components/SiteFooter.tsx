/**
 * 页脚对齐原先 Nextra 文档站底部：细顶边、小号灰字。
 */
export function SiteFooter() {
  return (
    <footer className="flex h-16 shrink-0 items-center justify-center border-t border-gray-200 px-2 text-xs text-gray-500 sm:text-sm dark:border-neutral-800 dark:text-gray-400">
      © {new Date().getFullYear()} TradeSignal. All rights reserved.
    </footer>
  );
}
