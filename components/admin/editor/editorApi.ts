import { parseJsonSafely } from "./editorErrors";

/**
 * The editor's two ways of talking to /api/admin: an XMLHttpRequest for saves (it is the only
 * browser API that reports how many request bytes have been sent) and `fetch` for everything else.
 * Both resolve instead of throwing, so a caller handles "the server said no" and "the network is
 * down" in one place.
 */

export type HttpResult =
  | { kind: "response"; status: number; body: unknown }
  | { kind: "network" }
  | { kind: "aborted" };

const SAVE_TIMEOUT_MS = 120_000;

export function sendForm(options: {
  url: string;
  method: "POST" | "PATCH";
  body: FormData;
  /** Fraction of the request body sent so far, 0 to 1. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<HttpResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open(options.method, options.url);
    request.responseType = "text";
    request.timeout = SAVE_TIMEOUT_MS;
    request.setRequestHeader("Accept", "application/json");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(1, event.loaded / event.total));
    };
    request.upload.onload = () => options.onProgress?.(1);
    request.onload = () => resolve({ kind: "response", status: request.status, body: parseJsonSafely(request.responseText) });
    request.onerror = () => resolve({ kind: "network" });
    request.ontimeout = () => resolve({ kind: "network" });
    request.onabort = () => resolve({ kind: "aborted" });

    if (options.signal) {
      if (options.signal.aborted) {
        resolve({ kind: "aborted" });
        return;
      }
      options.signal.addEventListener("abort", () => request.abort(), { once: true });
    }
    request.send(options.body);
  });
}

export async function requestJson(options: {
  url: string;
  method: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}): Promise<HttpResult> {
  try {
    const hasBody = options.body !== undefined;
    const response = await fetch(options.url, {
      method: options.method,
      headers: hasBody ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
    return { kind: "response", status: response.status, body: parseJsonSafely(await response.text()) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { kind: "aborted" };
    return { kind: "network" };
  }
}
