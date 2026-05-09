/**
 * 页脚对齐原先 Nextra 文档站底部：细顶边、小号灰字。
 */
export function SiteFooter() {
  return (
    <footer className="flex min-h-16 shrink-0 flex-col items-center justify-center gap-1 border-t border-gray-200 px-2 py-3 text-center text-xs text-gray-500 sm:text-sm dark:border-neutral-800 dark:text-gray-400">
      <span>© {new Date().getFullYear()} TradeSignal. All rights reserved.</span>
      <span className="text-[11px] sm:text-xs">
        本站内容由模型生成或辅助生成，基于公开信息整理，仅作研究参考，不构成投资建议或收益承诺。
      </span>
    </footer>
  );
}
