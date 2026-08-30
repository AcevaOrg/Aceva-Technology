"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { CAPS } from "@/lib/data/caps";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";

const CAPABILITY_DESCRIPTIONS: Record<(typeof CAPS)[number]["key"], string> = {
  digital: "Premium websites, e-commerce, portals and customer-facing platforms.",
  software: "SaaS products, dashboards, marketplaces and internal business systems.",
  mobile: "iOS, Android and cross-platform applications for customers and teams.",
  intelligence: "AI assistants, workflow automation, integrations, knowledge systems and reporting.",
  rescue: "Audit, stabilize, secure and modernize unfinished, outdated or AI-generated software.",
};

const DIFFERENTIATORS = [
  "AI-accelerated. Senior-reviewed.",
  "Your code. Your data.",
  "New York insight. Global execution.",
];

export default function OfferTabs() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: number) {
    setSelectedIndex(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") nextIndex = (index + 1) % CAPS.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + CAPS.length) % CAPS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = CAPS.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      selectTab(nextIndex);
    }
  }

  return (
    <div className="offer-tabs-shell">
      <div className="offer-tabs-shell__label" aria-hidden="true">
        <span>ACEVA / CAPABILITY SYSTEM</span>
        <span>01—05</span>
      </div>

      <div className="offer-tabs">
        <div className="offer-tabs__list" role="tablist" aria-label="Aceva capabilities" aria-orientation="vertical">
          {CAPS.map((capability, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                key={capability.key}
                id={`offer-tab-${capability.key}`}
                className="offer-tabs__tab"
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`offer-panel-${capability.key}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <span className="offer-tabs__number">{capability.num}</span>
                <span>{capability.name}</span>
                <ArrowRightIcon className="offer-tabs__tab-icon" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {CAPS.map((capability, index) => (
          <div
            key={capability.key}
            id={`offer-panel-${capability.key}`}
            className="offer-tabs__panel"
            role="tabpanel"
            aria-labelledby={`offer-tab-${capability.key}`}
            tabIndex={index === selectedIndex ? 0 : -1}
            hidden={index !== selectedIndex}
          >
            <div className="offer-tabs__panel-meta">
              <span>{capability.num} / CAPABILITY</span>
              {capability.key === "rescue" && <span className="offer-tabs__flagship">FLAGSHIP</span>}
            </div>
            <h3>{capability.name}</h3>
            <p>{CAPABILITY_DESCRIPTIONS[capability.key]}</p>
            <Link className="offer-tabs__learn" href={capabilityRoute(capability.key)}>
              Learn more
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </div>
        ))}
      </div>

      <div className="offer-tabs__footer">
        <Link className="offer-tabs__all" href={ROUTES.services}>
          All capabilities in detail
          <ArrowRightIcon aria-hidden="true" />
        </Link>
        <div className="offer-tabs__badges" aria-label="How Aceva works">
          {DIFFERENTIATORS.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
