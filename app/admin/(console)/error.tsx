"use client";

import { useEffect } from "react";
import s from "@/components/admin/admin.module.css";
import { Button, ButtonLink } from "@/components/admin/Button";
import { RefreshIcon } from "@/components/admin/icons";
import { RisingWords } from "@/components/admin/RisingWords";
import { SlashStage } from "@/components/admin/SlashStage";
import { ADMIN_ROUTES } from "@/lib/nav";

/**
 * Error boundary for the signed-in console. The shell stays on screen (this renders inside the layout),
 * so a failed page never strands the person without navigation. `retry` re-fetches the server data, which
 * is what a transient database or network failure needs; `reset` would only re-render the stale tree.
 * Only the opaque `digest` is shown: the message of a server error is withheld on purpose.
 */
export default function ConsoleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SlashStage size="inline">
      <p className={s.eyebrow}>
        <i className={s.slash} aria-hidden="true" />
        <b>Error</b>
      </p>
      <h1 className={s.stageTitle}>
        <RisingWords text="Something went wrong." accentLast={1} />
      </h1>
      <p className={s.lede}>This page failed to load. Trying again usually works. Nothing you saved has been lost.</p>
      {error.digest ? <p className={s.stageRef}>Reference {error.digest}</p> : null}
      <div className={s.stageActions}>
        <Button iconLeading={<RefreshIcon />} onClick={() => retry()}>
          Try again
        </Button>
        <ButtonLink href={ADMIN_ROUTES.root} variant="ghost">
          Back to overview
        </ButtonLink>
      </div>
    </SlashStage>
  );
}
