import type { ReactNode } from "react";

interface KeyValueRowProps {
  label: ReactNode;
  value: ReactNode;
  first?: boolean;
}

export default function KeyValueRow({ label, value, first = false }: KeyValueRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        padding: "16px 0",
        borderTop: first ? "none" : "1px solid var(--hairline)",
      }}
    >
      <span style={{ fontSize: 14, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 14.5, color: "var(--ink)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
