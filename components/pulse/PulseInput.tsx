"use client";

import React, { useState } from "react";
import styles from "./pulse.module.css";

interface PulseInputProps {
  placeholder?: string;
  buttonText?: string;
  disabled?: boolean;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
  multiline?: boolean;
}

export default function PulseInput({
  placeholder = "Describe what is on your mind…",
  buttonText = "MAP THIS ↗",
  disabled = false,
  onSubmit,
  autoFocus = false,
  multiline = false,
}: PulseInputProps) {
  const [val, setVal] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (val.trim() && !disabled) {
      onSubmit(val.trim());
      setVal("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && multiline) {
      e.preventDefault();
      if (val.trim() && !disabled) {
        onSubmit(val.trim());
        setVal("");
      }
    }
  };

  if (multiline) {
    return (
      <form onSubmit={handleSubmit}>
        <textarea
          autoFocus={autoFocus}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Enter project prompt details"
          disabled={disabled}
        />
        <div className={styles.promptControls}>
          <span>PROMPT FIELD</span>
          <button type="submit" disabled={disabled || !val.trim()}>
            {buttonText}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.inlineInput} onSubmit={handleSubmit}>
      <label htmlFor="start">Or start in your own words.</label>
      <div>
        <input
          id="start"
          autoFocus={autoFocus}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Describe what is on your mind"
        />
        <button type="submit" disabled={disabled || !val.trim()}>
          {buttonText}
        </button>
      </div>
    </form>
  );
}
