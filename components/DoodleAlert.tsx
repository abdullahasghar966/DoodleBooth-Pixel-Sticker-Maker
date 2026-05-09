"use client";

import * as React from "react";
import { globalFilterId } from "./DoodleFilters";

export type DoodleAlertProps = {
  title?: string;
  children: React.ReactNode;
  tone?: "info" | "error";
};

const TONE_BG: Record<NonNullable<DoodleAlertProps["tone"]>, string> = {
  info: "#fffae6",
  error: "#ffe0e8",
};

export function DoodleAlert({
  title,
  children,
  tone = "info",
}: DoodleAlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        position: "relative",
        background: TONE_BG[tone],
        border: "2.5px solid #1a1a1a",
        borderRadius: 6,
        boxShadow: "4px 4px 0 #1a1a1a",
        padding: 16,
        // Hand-drawn sketch border via global doodle filter.
        filter: `url(#${globalFilterId("wiggle_border")})`,
        maxWidth: 560,
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: "var(--font-caveat), cursive",
            fontWeight: 700,
            fontSize: 22,
            marginBottom: 6,
            color: "#1a1a1a",
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--font-courier), monospace",
          fontSize: 14,
          color: "#1a1a1a",
          lineHeight: 1.4,
        }}
      >
        {children}
      </div>
    </div>
  );
}
