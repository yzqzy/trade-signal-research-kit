"use client";

import { ReportMarkdownBody } from "@/components/ReportMarkdownBody";

export type ReportAttachmentView = {
  id: string;
  label: string;
  kind: "markdown" | "json";
  href: string;
  previewable: boolean;
  bytes?: number;
  lines?: number;
  content?: string;
};

export type ReportSourceLinkView = {
  id: string;
  label: string;
  kind: "pdf" | "external";
  href: string;
};

function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReportAttachments({
  attachments,
  sourceLinks,
}: {
  attachments: ReportAttachmentView[];
  sourceLinks: ReportSourceLinkView[];
}) {
  if (attachments.length === 0 && sourceLinks.length === 0) return null;

  return (
    <section className="rh-attachments" aria-labelledby="rh-attachments-title">
      <h2 id="rh-attachments-title">证据附件</h2>
      {sourceLinks.length > 0 ? (
        <div className="rh-source-links">
          {sourceLinks.map((link) => (
            <a key={link.id} className="rh-attachment-link" href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      <div className="rh-attachment-list">
        {attachments.map((att) => {
          const meta = [formatBytes(att.bytes), att.lines ? `${att.lines} 行` : ""].filter(Boolean).join(" · ");
          return (
            <details key={att.id} id={`attachment-${att.id}`} className="rh-attachment-card">
              <summary>
                <span>
                  <strong>{att.label}</strong>
                  {meta ? <small>{meta}</small> : null}
                </span>
                <a
                  className="rh-attachment-download"
                  href={att.href}
                  download
                  onClick={(event) => event.stopPropagation()}
                >
                  下载
                </a>
              </summary>
              {att.previewable && att.content ? (
                <div className="rh-attachment-preview">
                  {att.kind === "markdown" ? (
                    <ReportMarkdownBody markdown={att.content} variant="compact" />
                  ) : (
                    <pre>
                      <code>{att.content}</code>
                    </pre>
                  )}
                </div>
              ) : (
                <p className="rh-attachment-empty">该附件仅提供下载。</p>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}
