import type { CSSProperties } from "react";
import s from "./capabilities.module.css";

/**
 * Five technical drawings, one per capability. Pure SVG, decorative (aria-hidden),
 * animated only while their frame is active (see capabilities.module.css).
 * The resting state is the finished drawing, which is what reduced motion shows.
 */

const i = (n: number) => ({ "--i": n }) as CSSProperties;

function Frame({ fig, title, children }: { fig: string; title: string; children: React.ReactNode }) {
  return (
    <svg className={s.svg} viewBox="0 0 640 440" fill="none" aria-hidden="true" focusable="false">
      <text className={s.caption} x="24" y="30">
        {`FIG. ${fig} — ${title}`}
      </text>
      {children}
    </svg>
  );
}

export function DigitalVisual() {
  return (
    <Frame fig="01" title="DIGITAL EXPERIENCES">
      <rect className={s.faint} x="170" y="54" width="380" height="240" rx="12" />
      <rect className={s.soft} x="130" y="86" width="380" height="250" rx="12" />
      <g className={s.rise} style={i(0)}>
        <rect className={s.paperFill} x="86" y="118" width="410" height="272" rx="12" />
        <path className={s.stroke} d="M86 150h410" />
        <circle className={s.stroke} cx="106" cy="134" r="4" />
        <circle className={s.stroke} cx="120" cy="134" r="4" />
        <circle className={s.stroke} cx="134" cy="134" r="4" />
        <rect className={s.stroke} x="190" y="127" width="190" height="14" rx="7" />
        <rect className={s.inkFill} x="112" y="176" width="200" height="15" rx="2" />
        <rect className={s.inkFill} x="112" y="198" width="150" height="15" rx="2" />
        <rect className={s.mutedFill} x="112" y="228" width="210" height="5" rx="2.5" />
        <rect className={s.mutedFill} x="112" y="240" width="170" height="5" rx="2.5" />
        <rect className={s.accFill} x="112" y="262" width="112" height="32" rx="16" />
        <rect className={s.paperFill} x="134" y="276" width="56" height="4" rx="2" />
        <rect className={s.stroke} x="350" y="174" width="120" height="120" rx="8" />
        <path className={s.accStroke} d="M372 282 L446 186" />
        <rect className={s.stroke} x="112" y="318" width="108" height="50" rx="6" />
        <rect className={s.stroke} x="232" y="318" width="108" height="50" rx="6" />
        <rect className={s.stroke} x="352" y="318" width="118" height="50" rx="6" />
      </g>
      <path className={`${s.accStroke} ${s.flow}`} d="M40 403 C 60 350, 84 312, 112 290" />
      <path className={`${s.accStroke} ${s.flow}`} d="M228 280 C 300 304, 470 308, 520 302 S 572 276, 584 266" />
      <circle className={s.paperFill} cx="40" cy="410" r="7" />
      <circle className={s.stroke} cx="40" cy="410" r="7" />
      <text className={s.tag} x="54" y="414">
        VISITOR
      </text>
      <circle className={s.accFill} cx="588" cy="250" r="17" />
      <path className={s.check} d="M580 250l6 6 11-12" />
      <text className={s.tag} x="560" y="290">
        LEAD
      </text>
      <g className={s.cursor}>
        <path className={s.cursorShape} d="M0 0 L0 22 L6 16 L10 26 L14 24 L10 14 L18 14 Z" />
      </g>
      <circle className={s.ripple} cx="168" cy="278" r="18" />
    </Frame>
  );
}

export function SoftwareVisual() {
  return (
    <Frame fig="02" title="CUSTOM SOFTWARE">
      <rect className={s.paperFill} x="56" y="52" width="528" height="344" rx="12" />
      <rect className={s.stroke} x="56" y="52" width="528" height="344" rx="12" />
      <path className={s.stroke} d="M168 52v344" />
      <rect className={s.inkFill} x="78" y="76" width="64" height="9" rx="4.5" />
      {[0, 1, 2, 3, 4].map((n) => (
        <rect key={n} className={n === 1 ? s.accFill : s.mutedFill} x="78" y={112 + n * 26} width={n === 1 ? 70 : 56} height="7" rx="3.5" />
      ))}
      {[0, 1, 2].map((n) => (
        <g key={n} className={s.rise} style={i(n + 1)}>
          <rect className={s.stroke} x={188 + n * 128} y="72" width="114" height="72" rx="8" />
          <rect className={s.mutedFill} x={202 + n * 128} y="86" width="46" height="6" rx="3" />
          <rect className={s.inkFill} x={202 + n * 128} y="102" width={58 + n * 8} height="16" rx="2" />
          <path className={n === 2 ? s.accStroke : s.stroke} d={`M${248 + n * 128} 132 l10 -6 l10 3 l12 -10 l10 4`} />
        </g>
      ))}
      <g className={s.rise} style={i(4)}>
        <rect className={s.stroke} x="188" y="160" width="370" height="128" rx="8" />
        <path className={s.grid} d="M204 196h338M204 228h338M204 260h338" />
        <path className={`${s.accStroke} ${s.draw}`} pathLength={1} d="M206 264 L248 244 L290 250 L332 216 L374 226 L416 192 L458 202 L500 174 L540 182" />
      </g>
      <g className={s.rise} style={i(5)}>
        {[0, 1, 2].map((n) => (
          <g key={n}>
            <path className={s.faintLine} d={`M188 ${312 + n * 26}h370`} />
            <rect className={s.mutedFill} x="192" y={319 + n * 26} width={110 - n * 14} height="6" rx="3" />
            <rect className={s.mutedFill} x="330" y={319 + n * 26} width="70" height="6" rx="3" />
            <rect className={n === 0 ? s.accFill : s.pill} x="494" y={316 + n * 26} width="56" height="13" rx="6.5" />
          </g>
        ))}
      </g>
    </Frame>
  );
}

export function MobileVisual() {
  const steps = ["SIGN IN", "CHOOSE", "CONFIRM", "DONE"];
  return (
    <Frame fig="03" title="MOBILE PRODUCTS">
      {steps.map((label, n) => {
        const x = 40 + n * 148;
        return (
          <g key={label}>
            <g className={s.step} style={i(n)}>
              <rect className={s.paperFill} x={x} y="92" width="112" height="216" rx="20" />
              <rect className={s.phone} x={x} y="92" width="112" height="216" rx="20" />
              <rect className={s.inkFill} x={x + 40} y="102" width="32" height="6" rx="3" />
            </g>
            {n === 0 && (
              <>
                <rect className={s.stroke} x={x + 14} y="150" width="84" height="20" rx="6" />
                <rect className={s.stroke} x={x + 14} y="178" width="84" height="20" rx="6" />
                <rect className={s.accFill} x={x + 14} y="214" width="84" height="22" rx="11" />
              </>
            )}
            {n === 1 &&
              [0, 1, 2].map((k) => (
                <rect key={k} className={k === 1 ? s.accStroke : s.stroke} x={x + 14} y={142 + k * 34} width="84" height="26" rx="6" />
              ))}
            {n === 2 && (
              <>
                <rect className={s.mutedFill} x={x + 14} y="146" width="70" height="6" rx="3" />
                <rect className={s.mutedFill} x={x + 14} y="160" width="54" height="6" rx="3" />
                <path className={s.faintLine} d={`M${x + 14} 182h84`} />
                <rect className={s.inkFill} x={x + 14} y="194" width="46" height="12" rx="2" />
                <rect className={s.accFill} x={x + 14} y="250" width="84" height="26" rx="13" />
              </>
            )}
            {n === 3 && (
              <>
                <circle className={s.accFill} cx={x + 56} cy="190" r="24" />
                <path className={s.check} d={`M${x + 45} 190l8 8 15-16`} />
                <rect className={s.mutedFill} x={x + 28} y="232" width="56" height="6" rx="3" />
              </>
            )}
            <text className={s.tag} x={x} y="340">
              {`0${n + 1} ${label}`}
            </text>
            {n < 3 && <path className={`${s.stroke} ${s.arrow}`} d={`M${x + 120} 200h20m-6 -6l6 6l-6 6`} />}
          </g>
        );
      })}
      <path className={`${s.accStroke} ${s.flow}`} d="M96 372 H 534" />
      <text className={s.tag} x="40" y="400">
        ONE COMPLETE JOURNEY — NOT TEN LOOSE SCREENS
      </text>
    </Frame>
  );
}

export function IntelligenceVisual() {
  const nodes = ["REQUEST", "LOOKUP", "PROPOSE", "APPROVE", "UPDATE"];
  const log = [
    "request received",
    "records retrieved from approved source",
    "action proposed",
    "approved by a named person",
    "system updated · activity logged",
  ];
  return (
    <Frame fig="04" title="INTELLIGENCE & AUTOMATION">
      <path className={s.stroke} d="M126 172h24M246 172h24M366 172h24M486 172h24" />
      {nodes.map((label, n) => {
        const x = 30 + n * 120;
        const gate = n === 3;
        return (
          <g key={label}>
            <rect className={s.paperFill} x={x} y="144" width="96" height="56" rx="10" />
            <rect className={`${gate ? s.accStroke : s.stroke} ${gate ? s.gate : ""}`} x={x} y="144" width="96" height="56" rx="10" />
            <text className={gate ? s.tagAcc : s.tag} x={x + 48} y="177" textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
      <g className={s.person}>
        <circle className={s.accStroke} cx="438" cy="104" r="9" />
        <path className={s.accStroke} d="M420 132c3-10 10-15 18-15s15 5 18 15" />
      </g>
      <text className={s.tagAcc} x="438" y="226" textAnchor="middle">
        HUMAN AUTHORIZATION
      </text>
      <circle className={`${s.accFill} ${s.packet}`} cx="78" cy="172" r="6" />
      <rect className={s.stroke} x="30" y="252" width="576" height="150" rx="10" />
      <text className={s.tag} x="48" y="278">
        ACTIVITY LOG
      </text>
      {log.map((line, n) => (
        <g key={line} className={s.logLine} style={i(n)}>
          <circle className={n === 3 ? s.accFill : s.inkFill} cx="52" cy={300 + n * 22} r="3" />
          <text className={s.logText} x="66" y={304 + n * 22}>
            {line}
          </text>
        </g>
      ))}
    </Frame>
  );
}

export function RescueVisual() {
  const labels: Record<number, string> = { 0: "KEEP", 5: "REMEDIATE", 6: "REPLACE", 11: "DEFER" };
  const offsets = [
    [-14, 10, -7], [8, -12, 5], [0, 0, 0], [16, 6, 9],
    [-6, 14, 4], [12, -8, -6], [-10, -6, 8], [4, 12, -4],
    [10, 8, 6], [0, 0, 0], [-12, 10, -9], [6, -14, 5],
  ];
  return (
    <Frame fig="05" title="PRODUCT RESCUE & RELIABILITY">
      {offsets.map(([tx, ty, r], n) => {
        const col = n % 4;
        const row = Math.floor(n / 4);
        const x = 76 + col * 126;
        const y = 64 + row * 84;
        const label = labels[n];
        const style = { "--i": n, "--tx": `${tx}px`, "--ty": `${ty}px`, "--r": `${r}deg` } as CSSProperties;
        return (
          <g key={n} className={s.block} style={style}>
            <rect className={s.paperFill} x={x} y={y} width="110" height="68" rx="8" />
            <rect className={label === "REPLACE" || label === "REMEDIATE" ? s.accStroke : s.stroke} x={x} y={y} width="110" height="68" rx="8" />
            <rect className={s.mutedFill} x={x + 14} y={y + 16} width={54 - (n % 3) * 10} height="6" rx="3" />
            {label && (
              <text className={label === "KEEP" || label === "DEFER" ? s.tag : s.tagAcc} x={x + 14} y={y + 50}>
                {label}
              </text>
            )}
            <circle className={s.marker} cx={x + 94} cy={y + 16} r="4" />
          </g>
        );
      })}
      <path className={s.stroke} d="M76 346h488" />
      <path className={`${s.accStroke} ${s.draw}`} pathLength={1} d="M76 346h488" />
      {["DAY 0", "DAY 30", "DAY 60", "DAY 90"].map((label, n) => (
        <g key={label}>
          <path className={s.stroke} d={`M${76 + n * 162.7} 340v12`} />
          <text className={s.tag} x={76 + n * 162.7} y="376" textAnchor={n === 0 ? "start" : n === 3 ? "end" : "middle"}>
            {label}
          </text>
        </g>
      ))}
    </Frame>
  );
}
