"use client";

import { useEffect, useRef } from "react";

/**
 * The closing wordmark. When it scrolls into view, one band of light crosses it at the
 * logo's 64° slash angle, then it rests. Static under reduced motion. An IntersectionObserver
 * (not a CSS view timeline) triggers it, because the layout wrapper's overflow makes it a
 * scroll container that never scrolls, which would leave a view timeline inactive.
 */
export default function FooterSignature({ className, sweepClassName }: { className?: string; sweepClassName?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        svg.setAttribute("data-in", "");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.5 }
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={ref} className={className} viewBox="20 20 960 130" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="footerWordmarkFill" x1="0" y1="20" x2="0" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d212c" />
          <stop offset="1" stopColor="#0b0c10" />
        </linearGradient>
        <linearGradient id="footerSweepFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2f50ff" stopOpacity="0" />
          <stop offset="0.4" stopColor="#2f50ff" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#dfe6ff" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#2f50ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2f50ff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="footerWordmarkClip">
          <path d="M20 150 100 20l80 130h-32l-48-79-48 79Z" />
          <path d="M380 20H280l-60 65 60 65h100v-26h-89l-39-39 39-39h89Z" />
          <path d="M420 20h160v26H420Zm0 54h140v22H420Zm0 50h160v26H420Z" />
          <path d="m620 20 32 1 48 81 48-81 32-1-80 130Z" />
          <path d="m820 150 80-130 80 130h-32l-48-79-48 79Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#footerWordmarkClip)">
        <rect x="20" y="20" width="960" height="130" fill="url(#footerWordmarkFill)" />
        {/* a band whose edges run at 64°: 130 units tall, so the top is offset by 130 × cot 64° ≈ 63 */}
        <polygon className={sweepClassName} points="-257,20 -37,20 -100,150 -320,150" fill="url(#footerSweepFill)" />
      </g>
    </svg>
  );
}
