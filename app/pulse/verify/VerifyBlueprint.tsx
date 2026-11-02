"use client";

import React, { useEffect, useState } from "react";
import { describeApiError } from "@/lib/api/errorCodes";

/**
 * Reads the token from the URL fragment, removes it from the address bar and
 * history straight away, and posts it only when the visitor confirms.
 */
export default function VerifyBlueprint() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const match = window.location.hash.match(/token=([A-Za-z0-9_-]{43})/);
    // Strip the fragment so the token is not left in history or shared by copy-paste.
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setToken(match ? match[1] : ""));
  }, []);

  const confirm = async () => {
    if (!token || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/pulse/email-blueprint/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setState("sent");
        setMessage("Done. Your blueprint is on its way to your inbox.");
        return;
      }
      setState("error");
      setMessage(describeApiError(data, "This link is invalid or has expired. Please request a new one."));
    } catch {
      setState("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  };

  if (token === null) return null;
  if (token === "") {
    return <p role="status">This link is incomplete. Please open the link from your email again, or request a new one.</p>;
  }

  return (
    <div>
      <button type="button" onClick={confirm} disabled={state === "sending" || state === "sent"}>
        {state === "sending" ? "SENDING…" : state === "sent" ? "SENT ✓" : "EMAIL MY BLUEPRINT"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
