"use client";

import React, { Children, isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return flattenText(props.children);
  }
  return "";
}

function parseRhMetadataFence(raw: string): Array<{ key: string; value: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\w+)\s*:\s*(.+)$/);
      return m ? { key: m[1], value: m[2].trim() } : null;
    })
    .filter((x): x is { key: string; value: string } => x != null);
}

function decisionCn(v: string): string {
  const t = v.trim().toLowerCase();
  if (t === "buy" || v === "买入") return "买入";
  if (t === "watch" || v === "观察") return "观察";
  if (t === "avoid" || t === "exclude" || v === "排除") return "排除";
  return v;
}

function confidenceCn(v: string): string {
  const t = v.trim().toLowerCase();
  if (t === "high") return "高";
  if (t === "medium") return "中";
  if (t === "low") return "低";
  return v;
}

function riskCn(v: string): string {
  const t = v.trim().toLowerCase();
  if (t === "high") return "高";
  if (t === "medium") return "中";
  if (t === "low") return "低";
  if (t === "unknown") return "未判定";
  return v;
}

function tagClassForDecision(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "buy" || raw === "买入") return "rh-tag rh-tag--decision rh-tag--decision-buy";
  if (t === "watch" || raw === "观察") return "rh-tag rh-tag--decision rh-tag--decision-watch";
  if (t === "avoid" || t === "exclude" || raw === "排除") return "rh-tag rh-tag--decision rh-tag--decision-avoid";
  return "rh-tag rh-tag--decision rh-tag--decision-unknown";
}

function tagClassForConfidence(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "high") return "rh-tag rh-tag--confidence rh-tag--confidence-high";
  if (t === "medium") return "rh-tag rh-tag--confidence rh-tag--confidence-medium";
  if (t === "low") return "rh-tag rh-tag--confidence rh-tag--confidence-low";
  return "rh-tag rh-tag--confidence rh-tag--confidence-unknown";
}

function tagClassForRisk(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "high") return "rh-tag rh-tag--risk rh-tag--risk-high";
  if (t === "medium") return "rh-tag rh-tag--risk rh-tag--risk-medium";
  if (t === "low") return "rh-tag rh-tag--risk rh-tag--risk-low";
  return "rh-tag rh-tag--risk rh-tag--risk-unknown";
}

function RhMetadataCard({ raw }: { raw: string }) {
  const rows = parseRhMetadataFence(raw);

  const labelForKey = (k: string): string => {
    switch (k) {
      case "decision":
        return "决策";
      case "confidence":
        return "置信度";
      case "trap_risk":
        return "风险等级";
      case "position":
        return "仓位建议";
      default:
        return k;
    }
  };

  const valueDisplay = (key: string, value: string) => {
    if (key === "decision") return decisionCn(value);
    if (key === "confidence") return confidenceCn(value);
    if (key === "trap_risk") return riskCn(value);
    return value;
  };

  const valueClass = (key: string, value: string) => {
    if (key === "decision") return tagClassForDecision(value);
    if (key === "confidence") return tagClassForConfidence(value);
    if (key === "trap_risk") return tagClassForRisk(value);
    if (key === "position") return "rh-tag rh-tag--position";
    return "rh-tag rh-tag--plain";
  };

  if (rows.length === 0) {
    return (
      <pre className="rh-metadata-fallback">
        <code>{raw}</code>
      </pre>
    );
  }

  return (
    <div className="rh-metadata-card" data-kind="investment-verdict">
      <dl className="rh-metadata-dl">
        {rows.map(({ key, value }) => (
          <div key={key} className="rh-metadata-row">
            <dt>{labelForKey(key)}</dt>
            <dd>
              <span className={valueClass(key, value)}>{valueDisplay(key, value)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function tryParseKvParagraph(plain: string): { label: string; value: string } | null {
  const m = plain
    .trim()
    .match(/^(决策|置信度|风险等级|仓位建议|价值陷阱风险|分析置信度)[：:]\s*(.+)$/);
  if (!m) return null;
  return { label: m[1], value: m[2].trim() };
}

function kvTagClass(label: string, value: string): string {
  if (label === "决策") return tagClassForDecision(value);
  if (label === "置信度" || label === "分析置信度") return tagClassForConfidence(value);
  if (label === "风险等级" || label === "价值陷阱风险") return tagClassForRisk(value);
  if (label === "仓位建议") return "rh-tag rh-tag--position";
  return "rh-tag rh-tag--plain";
}

function isRhMetadataCode(className: string | undefined): boolean {
  if (!className) return false;
  return className.includes("language-rh-metadata") || /\brh-metadata\b/.test(className);
}

export function ReportMarkdownBody({ markdown }: { markdown: string }) {
  const components: Partial<Components> = {
    pre({ children, ...rest }) {
      const arr = Children.toArray(children);
      if (arr.length === 1 && isValidElement(arr[0])) {
        const el = arr[0] as React.ReactElement<{ className?: string; children?: ReactNode }>;
        if (el.type === "code" && isRhMetadataCode(el.props.className)) {
          const raw = flattenText(el.props.children);
          return <RhMetadataCard raw={raw} />;
        }
      }
      return <pre {...rest}>{children}</pre>;
    },
    h3({ children, className, ...rest }) {
      const text = flattenText(children);
      const isCalc = /计算过程/.test(text);
      const merged = [className, isCalc ? "rh-heading-calc" : ""].filter(Boolean).join(" ");
      return (
        <h3 {...rest} className={merged || undefined}>
          {children}
        </h3>
      );
    },
    p({ children, className, ...rest }) {
      const plain = flattenText(children);
      const kv = tryParseKvParagraph(plain);
      if (kv && plain.length < 220) {
        const merged = [className, "rh-kv-line"].filter(Boolean).join(" ");
        return (
          <p {...rest} className={merged || undefined}>
            <span className="rh-kv-label">{kv.label}</span>
            <span className={kvTagClass(kv.label, kv.value)}>{kv.value}</span>
          </p>
        );
      }
      return (
        <p {...rest} className={className}>
          {children}
        </p>
      );
    },
  };

  return (
    <article className="report-entry-body rh-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
