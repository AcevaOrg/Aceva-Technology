"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import FilterChips, { type ChipOption } from "./FilterChips";
import { CERTS_LETTERS_FILTER, LETTERS_ANCHOR_ID } from "./content";
import {
  describeSelection,
  showsDirectionFilter,
  viewFromHash,
  type DirectionCounts,
  type DirectionFilter,
  type SectionView,
} from "./filters";
import styles from "./documents.module.css";

interface CertificationsAndLettersProps {
  /** Listed certifications; null when the registry could not be reached, so no number is claimed. */
  certificateCount: number | null;
  directionCounts: DirectionCounts;
  /** The server-rendered certificate grid (or its empty state). */
  certificates: ReactNode;
  /** The server-rendered "Verified by QR" panel for experience letters. */
  letters: ReactNode;
}

/**
 * The combined "Certifications & letters" body: a filter over two server-rendered panels.
 *
 * Both panels are always in the markup, and everything is visible until a chip is pressed, so the
 * section reads completely with JavaScript off or before it loads. The component never mounts or
 * unmounts content: the view hides a whole panel with `hidden`, and the held/issued choice is a
 * data attribute that the stylesheet turns into hiding individual certificate cards. Nothing moves
 * on load, so the reveal animation and the sticky index are undisturbed.
 *
 * The empty `#experience-letters` anchor keeps the old deep link alive: opening it (or following it
 * later) selects the Experience letters view.
 */
export default function CertificationsAndLetters({ certificateCount, directionCounts, certificates, letters }: CertificationsAndLettersProps) {
  const [view, setView] = useState<SectionView>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  // Empty until someone acts: the section's first paint should not be announced, only changes.
  const [announcement, setAnnouncement] = useState("");

  const hasDirections = showsDirectionFilter(directionCounts);

  const choose = (nextView: SectionView, nextDirection: DirectionFilter) => {
    setView(nextView);
    setDirection(nextDirection);
    setAnnouncement(describeSelection(nextView, nextDirection, certificateCount, directionCounts));
  };

  // Reads the latest counts without making the effect below re-run (and re-apply the hash) when they change.
  const followHash = useEffectEvent(() => {
    const fromHash = viewFromHash(window.location.hash);
    if (!fromHash) return;
    setView(fromHash);
    setAnnouncement(describeSelection(fromHash, "all", certificateCount, directionCounts));
  });

  useEffect(() => {
    // The URL fragment lives outside React: read it once after hydration, then follow later changes.
    const onHashChange = () => followHash();
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const viewOptions: ChipOption<SectionView>[] = [
    { value: "all", label: CERTS_LETTERS_FILTER.views.all },
    { value: "certifications", label: CERTS_LETTERS_FILTER.views.certifications, count: certificateCount },
    { value: "letters", label: CERTS_LETTERS_FILTER.views.letters },
  ];
  const total = certificateCount ?? 0;
  const directionOptions: ChipOption<DirectionFilter>[] = [
    { value: "all", label: CERTS_LETTERS_FILTER.directions.all, count: total },
    { value: "held", label: CERTS_LETTERS_FILTER.directions.held, count: directionCounts.held },
    { value: "issued", label: CERTS_LETTERS_FILTER.directions.issued, count: directionCounts.issued },
  ];

  return (
    <div className={styles.certFilter} data-view={view} data-direction-filter={direction}>
      {/* Zero-height target for the old #experience-letters link; it must never be hidden. */}
      <span id={LETTERS_ANCHOR_ID} className={styles.anchorMark} />

      <div className={styles.filterBar} data-filter-bar>
        <FilterChips label={CERTS_LETTERS_FILTER.viewLabel} options={viewOptions} value={view} onChange={(next) => choose(next, direction)} />
        <FilterChips
          label={CERTS_LETTERS_FILTER.directionLabel}
          options={directionOptions}
          value={direction}
          onChange={(next) => choose(view, next)}
          hidden={!hasDirections || view === "letters"}
        />
        <p className={styles.filterStatus} role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>
      {/* Without JavaScript the chips could do nothing, so they are not offered. */}
      <noscript>
        <style>{"[data-filter-bar]{display:none!important}"}</style>
      </noscript>

      <div className={styles.panelStack}>
        <div data-panel="certifications" hidden={view === "letters"}>
          {certificates}
        </div>
        <div data-panel="letters" hidden={view === "certifications"}>
          {letters}
        </div>
      </div>
    </div>
  );
}
