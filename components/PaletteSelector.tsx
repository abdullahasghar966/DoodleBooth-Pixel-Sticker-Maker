"use client";

import { PALETTES, PALETTE_NAMES, type PaletteName } from "@/lib/palettes";

export type PaletteSelectorProps = {
  selected: PaletteName;
  onSelect: (name: PaletteName) => void;
};

export function PaletteSelector({ selected, onSelect }: PaletteSelectorProps) {
  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {PALETTE_NAMES.map((name) => {
        const colors = PALETTES[name];
        const isActive = name === selected;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            aria-pressed={isActive}
            className="doodle-card wiggle-on-hover"
            style={{
              padding: 10,
              cursor: "pointer",
              minWidth: 130,
              outline: isActive ? "4px solid #ffd166" : "none",
              outlineOffset: isActive ? "-7px" : 0,
              background: "#ffffff",
            }}
          >
            <div className="flex gap-1 mb-1 justify-center">
              {colors.slice(0, 4).map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: c,
                    width: 18,
                    height: 18,
                    border: "2px solid #1a1a1a",
                  }}
                />
              ))}
            </div>
            <div className="flex gap-1 mb-1 justify-center">
              {colors.slice(4, 8).map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: c,
                    width: 18,
                    height: 18,
                    border: "2px solid #1a1a1a",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontWeight: 700,
                fontSize: 18,
                marginTop: 6,
                color: "#1a1a1a",
              }}
            >
              {name}
            </div>
          </button>
        );
      })}
    </div>
  );
}
