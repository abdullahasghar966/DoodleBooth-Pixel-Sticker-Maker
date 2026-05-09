// SVG filter pipeline for DoodleBooth.
//
// Exports:
//   - DoodleFilterType            string-literal union of allowed filter ids
//   - DOODLE_FILTER_TYPES         array form of the union (for iteration / validation)
//   - isDoodleFilterType()        runtime type guard (used by /api/pixelate STEP 3)
//   - svgFilterString(id, type)   pure-string generator (for static SVG export)
//   - DoodleFilter({ id, type })  React component rendering a <defs><filter/></defs> block
//
// Filter primitives are defined as a single data structure (FILTERS) so the
// string and React renderers can never drift apart.

import * as React from "react";

export type DoodleFilterType =
  | "wiggle_border"
  | "crosshatch"
  | "star_burst"
  | "none";

export const DOODLE_FILTER_TYPES: readonly DoodleFilterType[] = [
  "wiggle_border",
  "crosshatch",
  "star_burst",
  "none",
] as const;

export function isDoodleFilterType(s: unknown): s is DoodleFilterType {
  return (
    typeof s === "string" &&
    (DOODLE_FILTER_TYPES as readonly string[]).includes(s)
  );
}

type Prim = {
  tag: string;
  attrs: Record<string, string | number>;
  children?: Prim[];
};

// Per-spec: wiggle_border uses feTurbulence baseFrequency=0.02 + feDisplacementMap scale=4.
const FILTERS: Record<DoodleFilterType, Prim[]> = {
  wiggle_border: [
    {
      tag: "feTurbulence",
      attrs: {
        type: "fractalNoise",
        baseFrequency: "0.02",
        numOctaves: 2,
        seed: 3,
        result: "noise",
      },
    },
    {
      tag: "feDisplacementMap",
      attrs: {
        in: "SourceGraphic",
        in2: "noise",
        scale: 4,
        xChannelSelector: "R",
        yChannelSelector: "G",
      },
    },
  ],

  // Diagonal-ish hatching simulated with two perpendicular high-frequency
  // turbulence patterns thresholded to ink, then composited inside the source.
  crosshatch: [
    {
      tag: "feTurbulence",
      attrs: {
        type: "turbulence",
        baseFrequency: "0.9 0.05",
        numOctaves: 1,
        seed: 5,
        stitchTiles: "stitch",
        result: "hatchA",
      },
    },
    {
      tag: "feColorMatrix",
      attrs: {
        in: "hatchA",
        type: "matrix",
        values:
          "0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 -2 0.6",
        result: "ink1",
      },
    },
    {
      tag: "feTurbulence",
      attrs: {
        type: "turbulence",
        baseFrequency: "0.05 0.9",
        numOctaves: 1,
        seed: 11,
        stitchTiles: "stitch",
        result: "hatchB",
      },
    },
    {
      tag: "feColorMatrix",
      attrs: {
        in: "hatchB",
        type: "matrix",
        values:
          "0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 -2 0.6",
        result: "ink2",
      },
    },
    {
      tag: "feComposite",
      attrs: { in: "ink1", in2: "ink2", operator: "over", result: "hatching" },
    },
    {
      tag: "feComposite",
      attrs: {
        in: "hatching",
        in2: "SourceGraphic",
        operator: "in",
        result: "innerHatch",
      },
    },
    {
      tag: "feComposite",
      attrs: { in: "innerHatch", in2: "SourceGraphic", operator: "over" },
    },
  ],

  // Yellow halo around the silhouette — a "starburst glow" approximation.
  star_burst: [
    {
      tag: "feMorphology",
      attrs: {
        in: "SourceAlpha",
        operator: "dilate",
        radius: 2,
        result: "expand",
      },
    },
    {
      tag: "feGaussianBlur",
      attrs: { in: "expand", stdDeviation: 3, result: "halo" },
    },
    {
      tag: "feColorMatrix",
      attrs: {
        in: "halo",
        type: "matrix",
        values:
          "0 0 0 0 1  0 0 0 0 0.82  0 0 0 0 0.40  0 0 0 1 0",
        result: "yellowHalo",
      },
    },
    {
      tag: "feMerge",
      attrs: {},
      children: [
        { tag: "feMergeNode", attrs: { in: "yellowHalo" } },
        { tag: "feMergeNode", attrs: { in: "SourceGraphic" } },
      ],
    },
  ],

  // Identity — pass through. Lets callers always wire `filter: url(#id)`
  // without conditional logic for the "no overlay" case.
  none: [
    {
      tag: "feColorMatrix",
      attrs: {
        type: "matrix",
        values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
      },
    },
  ],
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function primToString(p: Prim): string {
  const attrs = Object.entries(p.attrs)
    .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
    .join(" ");
  const open = `<${p.tag}${attrs ? " " + attrs : ""}>`;
  const close = `</${p.tag}>`;
  const children = (p.children ?? []).map(primToString).join("");
  return `${open}${children}${close}`;
}

export function svgFilterString(id: string, type: DoodleFilterType): string {
  const prims = FILTERS[type];
  return `<filter id="${escapeAttr(id)}">${prims.map(primToString).join("")}</filter>`;
}

function primToReact(p: Prim, key: number): React.ReactElement {
  const childNodes = p.children?.map((c, i) => primToReact(c, i));
  return React.createElement(
    p.tag,
    { key, ...(p.attrs as Record<string, string | number>) },
    childNodes,
  );
}

export function DoodleFilter(props: {
  id: string;
  type: DoodleFilterType;
}): React.ReactElement {
  const prims = FILTERS[props.type];
  return React.createElement(
    "defs",
    null,
    React.createElement(
      "filter",
      { id: props.id },
      prims.map((p, i) => primToReact(p, i)),
    ),
  );
}
