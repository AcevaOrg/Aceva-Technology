/**
 * Client-side image downscaling for photos (ID-card portraits and the like).
 *
 * Vercel rejects request bodies over ~4.5 MB, and a phone photo is routinely 3-8 MB, so photos are
 * shrunk in the browser before upload. Every failure path returns the ORIGINAL file: resizing is an
 * optimisation, never a reason to lose the user's upload (the server still enforces the real limits).
 */

export interface ResizeOptions {
  /** Longest side of the output in CSS pixels. Images already smaller are not enlarged. */
  maxEdge: number;
  /** 0 to 1. Applies to JPEG and WEBP output; PNG is lossless. */
  quality: number;
  /** Force an output type ("image/jpeg", "image/png" or "image/webp"). Defaults to the input type. */
  mimeType?: string;
}

const OUTPUT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type OutputType = (typeof OUTPUT_TYPES)[number];

const EXTENSIONS: Record<OutputType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Scales (width, height) so the longer side is at most `maxEdge`, preserving aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (!(longest > maxEdge) || !(maxEdge > 0)) return { width, height, scaled: false };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

function pickOutputType(inputType: string, requested: string | undefined): OutputType {
  const wanted = (requested ?? inputType).toLowerCase();
  return (OUTPUT_TYPES as readonly string[]).includes(wanted) ? (wanted as OutputType) : "image/jpeg";
}

function renamed(name: string, type: string): string {
  const extension = EXTENSIONS[type as OutputType];
  if (!extension) return name;
  const stem = name.replace(/\.[^./\\]+$/, "") || "photo";
  return `${stem}.${extension}`;
}

interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  release: () => void;
}

async function decode(file: File): Promise<DecodedImage> {
  // createImageBitmap applies the EXIF orientation, so portrait phone photos are not drawn sideways.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { width: bitmap.width, height: bitmap.height, source: bitmap, release: () => bitmap.close() };
    } catch {
      // fall through to the <img> path
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscales `file` so its longest side is at most `options.maxEdge`, re-encoding at `options.quality`.
 * Returns the original file when it is not an image, when it is already small enough and keeps its
 * type (re-encoding would only lose quality), or when anything at all goes wrong.
 */
export async function resizeImageFile(file: File, options: ResizeOptions): Promise<File> {
  try {
    if (typeof document === "undefined") return file;
    if (!file.type.startsWith("image/")) return file;
    if (!Number.isFinite(options.maxEdge) || options.maxEdge < 1) return file;

    const outputType = pickOutputType(file.type, options.mimeType);
    const quality = Math.min(1, Math.max(0.05, Number.isFinite(options.quality) ? options.quality : 0.85));
    const image = await decode(file);

    try {
      const target = fitWithin(image.width, image.height, options.maxEdge);
      if (!target.scaled && outputType === file.type) return file;

      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext("2d");
      if (!context) return file;

      // JPEG has no alpha channel; without a backdrop a transparent PNG would turn black.
      if (outputType === "image/jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, target.width, target.height);
      }
      context.imageSmoothingQuality = "high";
      context.drawImage(image.source, 0, 0, target.width, target.height);

      const blob = await canvasToBlob(canvas, outputType, quality);
      if (!blob || blob.size === 0) return file;

      return new File([blob], renamed(file.name, blob.type || outputType), {
        type: blob.type || outputType,
        lastModified: Date.now(),
      });
    } finally {
      image.release();
    }
  } catch {
    return file;
  }
}
