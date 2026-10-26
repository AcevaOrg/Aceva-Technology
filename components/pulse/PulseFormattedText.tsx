"use client";

import React from "react";
import styles from "./pulse.module.css";

interface PulseFormattedTextProps {
  content: string;
}

/**
 * Resolves a markdown link target, or null if it is not safe to render.
 *
 * The text being formatted is model output, so a link target is untrusted:
 * `javascript:` and `data:` URLs are script execution, and a protocol-relative
 * `//host` or the `/\host` variant silently leaves the site. Only https and
 * genuinely same-document references survive. A rejected link falls back to its
 * own label as plain text, so nothing disappears.
 */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;

  // Same-document: a path, query or fragment. The lookahead rejects "//evil"
  // and "/\evil", both of which browsers resolve as another origin.
  if (/^[/#?](?![/\\])/.test(href)) return href;

  try {
    return new URL(href).protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

/** Splits inline markdown while keeping the delimiters, so each part self-identifies. */
const INLINE_PATTERN = /(\[[^\]\n]*\]\([^)\s]*\)|\*\*.*?\*\*|`[^`]*`)/g;

function renderFormattedInline(text: string): React.ReactNode[] {
  const parts = text.split(INLINE_PATTERN);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={idx} className={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = part.match(/^\[([^\]\n]*)\]\(([^)\s]*)\)$/);
    if (link) {
      const [, label, target] = link;
      const href = safeHref(target);
      const text = label || target;

      // An unsafe or unparsable target degrades to its label.
      if (!href) return <React.Fragment key={idx}>{text}</React.Fragment>;

      const isExternal = href.startsWith("https:");
      return (
        <a
          key={idx}
          href={href}
          className={styles.formattedLink}
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {text}
        </a>
      );
    }

    return part;
  });
}

function parseMarkdownTable(lines: string[]): React.ReactNode | null {
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, a) => !(i === 0 && c === "") && !(i === a.length - 1 && c === ""));

  const headerRow = parseRow(lines[0]);
  if (!headerRow.length) return null;

  let bodyStartIndex = 1;
  if (lines[1] && lines[1].includes("---")) {
    bodyStartIndex = 2;
  }

  const bodyRows = lines.slice(bodyStartIndex).map(parseRow);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.pulseTable}>
        <thead>
          <tr>
            {headerRow.map((cell, i) => (
              <th key={i}>{renderFormattedInline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx}>{renderFormattedInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PulseFormattedText({ content }: PulseFormattedTextProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let listBuffer: string[] = [];
  // Which list is open. A numbered list renders as <ol> so its numbering
  // survives — every list used to be flattened into a <ul>.
  let listKind: "ordered" | "unordered" | null = null;

  // Fenced code accumulates verbatim: no inline parsing inside a fence.
  let fenceBuffer: string[] | null = null;
  let fenceLanguage = "";

  const flushList = () => {
    if (listBuffer.length > 0) {
      const items = listBuffer.map((item, idx) => <li key={idx}>{renderFormattedInline(item)}</li>);
      blocks.push(
        listKind === "ordered" ? (
          <ol key={`list-${blocks.length}`} className={styles.formattedOrderedList}>
            {items}
          </ol>
        ) : (
          <ul key={`list-${blocks.length}`} className={styles.formattedList}>
            {items}
          </ul>
        )
      );
      listBuffer = [];
    }
    listKind = null;
  };

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      const tableElem = parseMarkdownTable(tableBuffer);
      if (tableElem) {
        blocks.push(<React.Fragment key={`table-${blocks.length}`}>{tableElem}</React.Fragment>);
      } else {
        // Fallback if table parsing failed
        tableBuffer.forEach((line, idx) => {
          blocks.push(<p key={`tf-${blocks.length}-${idx}`}>{renderFormattedInline(line)}</p>);
        });
      }
      tableBuffer = [];
    }
  };

  const flushFence = () => {
    if (fenceBuffer === null) return;
    blocks.push(
      <pre key={`fence-${blocks.length}`} className={styles.codeBlock} data-language={fenceLanguage || undefined}>
        <code>{fenceBuffer.join("\n")}</code>
      </pre>
    );
    fenceBuffer = null;
    fenceLanguage = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // A fence swallows every line until it closes, so markdown inside one is
    // shown rather than interpreted.
    if (trimmed.startsWith("```")) {
      if (fenceBuffer === null) {
        flushList();
        flushTable();
        fenceBuffer = [];
        fenceLanguage = trimmed.slice(3).trim();
      } else {
        flushFence();
      }
      continue;
    }
    if (fenceBuffer !== null) {
      fenceBuffer.push(rawLine);
      continue;
    }

    // Check for Markdown Table Row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      tableBuffer.push(trimmed);
      continue;
    } else {
      flushTable();
    }

    // Check for List Items (- , * , • or 1. )
    const bulletMatch = trimmed.match(/^([*\-•]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
      const kind = /^\d/.test(bulletMatch[1]) ? "ordered" : "unordered";
      // Switching marker style starts a new list rather than merging the two.
      if (listKind && listKind !== kind) flushList();
      listKind = kind;
      listBuffer.push(bulletMatch[2]);
      continue;
    } else {
      flushList();
    }

    if (!trimmed) {
      continue;
    }

    // Section Headings (# , ## , ###)
    if (trimmed.startsWith("#")) {
      const headingText = trimmed.replace(/^#+\s*/, "");
      blocks.push(
        <h4 key={`h-${i}`} className={styles.formattedHeading}>
          {renderFormattedInline(headingText)}
        </h4>
      );
      continue;
    }

    // Normal Paragraph
    blocks.push(
      <p key={`p-${i}`} className={styles.formattedParagraph}>
        {renderFormattedInline(trimmed)}
      </p>
    );
  }

  // An unterminated fence still renders as code rather than vanishing.
  flushFence();
  flushTable();
  flushList();

  return <div className={styles.formattedContainer}>{blocks}</div>;
}
