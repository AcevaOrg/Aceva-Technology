"use client";

import { useState, type ReactNode } from "react";
import {
  MIN_DEPARTMENTS_FOR_FILTER,
  describeDepartmentSelection,
  matchesDepartment,
  summariseTierFilter,
  type DepartmentChoice,
} from "@/lib/documents/team";
import type { HierarchyLevel } from "@/lib/documents/types";
import FilterChips, { type ChipOption } from "./FilterChips";
import { TEAM_FILTER } from "./content";
import styles from "./documents.module.css";

export interface TeamTierView {
  level: HierarchyLevel;
  heading: string;
  people: Array<{
    id: string;
    /** Folded department name ("" when none), compared with the chosen chip. */
    department: string;
    /** The server-rendered card. */
    card: ReactNode;
  }>;
}

interface TeamTiersProps {
  tiers: TeamTierView[];
  departments: DepartmentChoice[];
  total: number;
}

/**
 * The tiered frame around the team cards, and the department filter.
 *
 * Every tier and card is in the server markup and visible by default. Choosing a department only
 * sets `hidden` on the cards that do not match, and on a tier left with nobody; nothing is mounted
 * or unmounted, so the markup is the same before and after hydration. The tier counts follow the
 * filter, and `data-first` / `data-last` (worked out from the tiers still showing) let the stylesheet
 * draw the connector only between tiers a reader can actually see.
 */
export default function TeamTiers({ tiers, departments, total }: TeamTiersProps) {
  const [department, setDepartment] = useState("");
  // Empty until someone acts: the first paint should not be announced, only changes.
  const [announcement, setAnnouncement] = useState("");

  const filterable = departments.length >= MIN_DEPARTMENTS_FOR_FILTER;
  const { counts, visibleLevels } = summariseTierFilter(tiers, department);

  const options: ChipOption<string>[] = [
    { value: "", label: TEAM_FILTER.all, count: total },
    ...departments.map((choice) => ({ value: choice.key, label: choice.label, count: choice.count })),
  ];

  const choose = (next: string) => {
    setDepartment(next);
    setAnnouncement(describeDepartmentSelection(next, departments, total));
  };

  return (
    <div className={styles.team}>
      {filterable ? (
        <>
          <div className={styles.filterBar} data-filter-bar>
            <FilterChips label={TEAM_FILTER.groupLabel} options={options} value={department} onChange={choose} />
            <p className={styles.filterStatus} role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
          </div>
          {/* Without JavaScript the chips could do nothing, so they are not offered. */}
          <noscript>
            <style>{"[data-filter-bar]{display:none!important}"}</style>
          </noscript>
        </>
      ) : null}

      {tiers.map((tier, tierIndex) => {
        const headingId = `team-tier-${tier.level}`;
        return (
          <div
            key={tier.level}
            className={styles.tier}
            role="group"
            aria-labelledby={headingId}
            data-level={tier.level}
            data-first={visibleLevels[0] === tier.level}
            data-last={visibleLevels[visibleLevels.length - 1] === tier.level}
            hidden={counts[tierIndex] === 0}
          >
            <div className={styles.tierHead}>
              <h3 id={headingId}>{tier.heading}</h3>
              <span className={styles.tierCount}>
                {counts[tierIndex]}
                <span className={styles.srOnly}>{counts[tierIndex] === 1 ? " person" : " people"}</span>
              </span>
            </div>
            <ul className={styles.teamGrid}>
              {tier.people.map((person) => (
                <li key={person.id} hidden={!matchesDepartment(person.department, department)}>
                  {person.card}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
