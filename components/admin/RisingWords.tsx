import { Fragment, type CSSProperties } from "react";
import s from "./admin.module.css";
import { cx } from "./utils";

interface RisingWordsProps {
  /** The headline. Split on spaces; each word rises through its own mask, 70ms after the last. */
  text: string;
  /** How many trailing words take the accent colour and draw an underline ("Internal console." -> 1). */
  accentLast?: number;
}

/**
 * The marketing site's headline entrance: words rise through masks, then an accent word underlines itself.
 * Render it inside an <h1>; the words stay one text run for screen readers.
 */
export function RisingWords({ text, accentLast = 0 }: RisingWordsProps) {
  const words = text.split(" ").filter(Boolean);
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className={s.word} style={{ "--i": index } as CSSProperties}>
            <span className={cx(s.wordIn, index >= words.length - accentLast && s.accentWord)}>{word}</span>
          </span>{" "}
        </Fragment>
      ))}
    </>
  );
}
