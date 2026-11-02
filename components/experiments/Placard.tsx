import type { ReactNode } from "react";
import { PROVENANCE, type Experiment } from "@/lib/data/experiments";
import { c } from "./cx";

export function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Provenance chip. The shape of the dot encodes the kind of proof: live, fictional brief, sample. */
export function ProvChip({ exp }: { exp: Experiment }) {
  const kind = exp.provenance;
  return (
    <span className={c("prov", kind === "fictional" ? "fict" : kind)}>
      <i />
      <span>
        {PROVENANCE[kind].label} · {exp.capability}
      </span>
    </span>
  );
}

interface PlacardProps {
  exp: Experiment;
  title: string;
  brief?: string;
  proves: { label: string; text: string };
  /** Pin the placard beside a tall stage on wide screens. */
  stick?: boolean;
  children?: ReactNode;
}

/** The text side of an exhibit: index numeral, provenance, headline, brief and what it proves. */
export function Placard({ exp, title, brief, proves, stick, children }: PlacardProps) {
  return (
    <div className={c("placard", stick && "stick")}>
      <span className={c("num")} aria-hidden="true">
        {exp.num}
      </span>
      <ProvChip exp={exp} />
      <h2 className={c("h2")} id={`${exp.slug}-title`}>
        {title}
      </h2>
      {brief ? (
        <p className={c("brief")} data-exp-body={exp.key === "site" ? "" : undefined}>
          {brief}
        </p>
      ) : null}
      {children}
      <div className={c("proves")}>
        <p className={c("eyebrow")}>{proves.label}</p>
        <p>{proves.text}</p>
      </div>
    </div>
  );
}

export function UpNext({ next }: { next: Experiment }) {
  return (
    <a className={c("upnext")} href={`#${next.slug}`}>
      <span>Up next</span>
      {next.num} {next.title}
    </a>
  );
}
