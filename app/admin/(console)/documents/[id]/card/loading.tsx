import ui from "@/components/admin/admin.module.css";
import cardStyles from "@/components/admin/card/card.module.css";

/**
 * Shown while the label page streams in: the page head, a label-shaped block where the preview will be, and the
 * three side panels. Server-only, no JavaScript.
 */
export default function CardLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className={ui.srOnly}>Loading the QR labels</span>
      <div aria-hidden="true">
        <div className={ui.pageHead}>
          <div className={ui.pageHeadMain}>
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ width: 140, height: 11 }} />
            <span className={`${ui.skel} ${ui.skelTitle}`} style={{ marginTop: 22 }} />
            <span className={`${ui.skel} ${ui.skelLine}`} style={{ marginTop: 20, width: "min(480px, 80%)" }} />
          </div>
        </div>
        <div className={ui.split}>
          <div className={ui.panel}>
            <span className={`${ui.skel} ${cardStyles.skelLabel}`} />
          </div>
          <div className={ui.splitAside}>
            <span className={`${ui.skel} ${ui.skelStat}`} style={{ height: 260 }} />
            <span className={`${ui.skel} ${ui.skelStat}`} />
            <span className={`${ui.skel} ${ui.skelStat}`} style={{ height: 200 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
