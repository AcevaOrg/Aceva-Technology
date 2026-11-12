import QRCode from "qrcode";
import { verifyRoute } from "@/lib/nav";
import { SITE_URL } from "@/lib/seo";
import { normalizeVerificationCode } from "./codes";

/**
 * QR codes for verification links.
 *
 * Error correction M (about 15% of the code can be damaged) is the right trade-off for a card that
 * lives in a wallet: more redundancy would make the symbol denser and harder to scan at badge size.
 * The quiet zone is never below the 4 modules the QR specification requires, because a tight crop
 * is the most common reason a printed code fails to scan.
 */

const DEFAULT_DARK = "#0a0b0e";
const DEFAULT_LIGHT = "#ffffff";
const MIN_MARGIN = 4;
const MAX_TEXT_LENGTH = 1000;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** The exact string encoded into a record's QR: `<site>/verify/<code>`. */
export function verificationUrl(code: string, baseUrl: string = SITE_URL): string {
  const canonical = normalizeVerificationCode(code);
  if (!canonical) throw new RangeError("Not a valid verification code.");
  return `${baseUrl.replace(/\/+$/, "")}${verifyRoute(canonical)}`;
}

function assertText(text: string): void {
  if (typeof text !== "string" || text.length === 0) throw new RangeError("QR text must not be empty.");
  if (text.length > MAX_TEXT_LENGTH) throw new RangeError("QR text is too long.");
}

// Colours end up inside SVG attributes, so anything but a plain hex value falls back to the default.
function color(value: string | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

function margin(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return MIN_MARGIN;
  return Math.max(MIN_MARGIN, Math.round(value));
}

/**
 * A standalone SVG (viewBox only, so it scales to any container; pass `size` for fixed pixel
 * dimensions). `role="img"` with a label keeps it meaningful to screen readers.
 */
export async function renderQrSvg(
  text: string,
  options: { size?: number; margin?: number; dark?: string; light?: string } = {},
): Promise<string> {
  assertText(text);
  const size = options.size !== undefined && Number.isFinite(options.size) ? Math.min(4096, Math.max(32, Math.round(options.size))) : undefined;
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: margin(options.margin),
    width: size,
    color: { dark: color(options.dark, DEFAULT_DARK), light: color(options.light, DEFAULT_LIGHT) },
  });
  return svg.trim().replace("<svg ", '<svg role="img" aria-label="QR code for verification" ');
}

export async function renderQrPng(text: string, options: { width?: number } = {}): Promise<Buffer> {
  assertText(text);
  const width = options.width !== undefined && Number.isFinite(options.width) ? Math.min(2048, Math.max(128, Math.round(options.width))) : 512;
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: MIN_MARGIN,
    width,
    color: { dark: DEFAULT_DARK, light: DEFAULT_LIGHT },
  });
}
