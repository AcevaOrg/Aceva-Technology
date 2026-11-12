import { renderQrSvg, verificationUrl } from "@/lib/documents/qr";
import styles from "./documents.module.css";

interface QrImageProps {
  code: string;
  /** Pixel size of the square image. */
  size?: number;
  alt: string;
}

/**
 * The record's QR code as an inline image. The SVG comes from our own renderer and is embedded as a
 * data URL inside <img>, which is inert by construction: an image cannot run script or load
 * anything, so no markup string is ever injected into the page. Renders nothing if the code cannot
 * be encoded; a missing QR must never take the card down with it.
 */
export default async function QrImage({ code, size = 96, alt }: QrImageProps) {
  let source: string;
  try {
    const svg = await renderQrSvg(verificationUrl(code), { size: size * 2 });
    source = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  } catch {
    return null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an inline data: URL; the image optimiser cannot help here
    <img className={styles.qrImage} src={source} width={size} height={size} alt={alt} loading="lazy" decoding="async" />
  );
}
