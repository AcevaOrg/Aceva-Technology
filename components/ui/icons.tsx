import type { SVGProps } from "react";

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden="true" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

export function LogoMark({
  id = "acevaStroke",
  width = 46,
  height = 28,
  ...props
}: SVGProps<SVGSVGElement> & { id?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 495 299" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="458.63" y1="74.2" x2="340.54" y2="259.67">
          <stop offset="0" stopColor="#1D489B" />
          <stop offset="0.4271" stopColor="#1E4799" stopOpacity="0.5729" />
          <stop offset="0.6099" stopColor="#1F4593" stopOpacity="0.3901" />
          <stop offset="0.7461" stopColor="#214189" stopOpacity="0.2539" />
          <stop offset="0.8591" stopColor="#223C7D" stopOpacity="0.1409" />
          <stop offset="0.9566" stopColor="#22366E" stopOpacity="0.0434" />
          <stop offset="1" stopColor="#223266" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill="#F5F6F8"
        points="65.53,288.34 10.04,288.34 181.1,10.43 353.07,288.34 296.66,288.34 181.55,99.39 123.77,192 202.65,192 230.62,239.73 94.42,239.27"
      />
      <polygon fill={`url(#${id})`} points="431.95,70.96 485.15,70.96 353.07,285.13 326.47,241.71" />
    </svg>
  );
}
