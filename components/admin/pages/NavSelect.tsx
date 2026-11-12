"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectInput } from "@/components/admin/inputs";
import s from "./pages.module.css";

export interface NavSelectOption {
  value: string;
  label: string;
  /** Where choosing this option goes. Built by the server from validated state, never from user text. */
  href: string;
}

interface NavSelectProps {
  id: string;
  label: string;
  value: string;
  options: readonly NavSelectOption[];
}

/**
 * A select that navigates: choosing an option goes to that option's URL, so the page's filters stay in
 * the address bar. The shown value follows the choice at once (a controlled select with no state would
 * snap back until the navigation finished) and re-syncs whenever the server sends a new value.
 */
export function NavSelect({ id, label, value, options }: NavSelectProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setSelected(value);
  }

  return (
    <div className={s.sortBox}>
      <label htmlFor={id} className={s.fieldCaption}>
        {label}
      </label>
      <SelectInput
        id={id}
        value={selected}
        options={options.map(({ value: optionValue, label: optionLabel }) => ({ value: optionValue, label: optionLabel }))}
        onChange={(next) => {
          const target = options.find((option) => option.value === next);
          if (!target) return;
          setSelected(next);
          router.push(target.href);
        }}
      />
    </div>
  );
}
