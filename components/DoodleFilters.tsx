// Mounts a single hidden <svg><defs/></svg> with all four named doodle
// filters available globally. Reference them anywhere via:
//   filter: url(#doodle-wiggle_border) | crosshatch | star_burst | none
//
// Pure render function — no hooks, no browser APIs. Safe to import into
// the server-rendered root layout.

import * as React from "react";
import {
  DoodleFilter,
  DOODLE_FILTER_TYPES,
  type DoodleFilterType,
} from "@/lib/svgFilters";

export const GLOBAL_FILTER_PREFIX = "doodle";

export function globalFilterId(type: DoodleFilterType): string {
  return `${GLOBAL_FILTER_PREFIX}-${type}`;
}

export function DoodleFilters() {
  return (
    <svg
      width={0}
      height={0}
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      {DOODLE_FILTER_TYPES.map((type) => (
        <DoodleFilter key={type} id={globalFilterId(type)} type={type} />
      ))}
    </svg>
  );
}
