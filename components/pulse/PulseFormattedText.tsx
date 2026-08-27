"use client";

import React from "react";
import styles from "./pulse.module.css";

interface PulseFormattedTextProps {
  content: string;
}

function renderFormattedInline(text: string): React.ReactNode[] {
  // Parse **bold** and `code` inline elements
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={idx} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
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
    <div key={Math.random()} className={styles.tableWrapper}>
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

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className={styles.formattedList}>
          {listBuffer.map((item, idx) => (
            <li key={idx}>{renderFormattedInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      const tableElem = parseMarkdownTable(tableBuffer);
      if (tableElem) {
        blocks.push(tableElem);
      } else {
        // Fallback if table parsing failed
        tableBuffer.forEach((line) => {
          blocks.push(<p key={Math.random()}>{renderFormattedInline(line)}</p>);
        });
      }
      tableBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for Markdown Table Row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      tableBuffer.push(trimmed);
      continue;
    } else {
      flushTable();
    }

    // Check for Bullet List Items (- , * , • or 1. )
    const bulletMatch = trimmed.match(/^([\*\-•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
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

  flushTable();
  flushList();

  return <div className={styles.formattedContainer}>{blocks}</div>;
}
