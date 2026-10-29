import styles from "./experiments.module.css";

/** Joins module classes by name; falsy entries are skipped. Names match the stylesheet's kebab-case. */
export function c(...names: (string | false | null | undefined)[]): string {
  return names
    .filter((n): n is string => Boolean(n))
    .map((n) => styles[n] ?? "")
    .filter(Boolean)
    .join(" ");
}

export default styles;
