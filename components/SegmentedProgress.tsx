// Blocky pixel progress bar — N fixed-width 8px segments, filled left-to-right.
// Each segment has a thin ink outline and toggles between paper-tan (empty)
// and yellow accent (filled).

export type SegmentedProgressProps = {
  progress: number;
  total: number;
  segments?: number;
  height?: number;
};

export function SegmentedProgress({
  progress,
  total,
  segments = 20,
  height = 20,
}: SegmentedProgressProps) {
  const ratio = total > 0 ? Math.min(Math.max(progress / total, 0), 1) : 0;
  const filled = Math.round(ratio * segments);

  return (
    <div
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={total}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 4,
        border: "2.5px solid #1a1a1a",
        borderRadius: 6,
        boxShadow: "3px 3px 0 #1a1a1a",
        background: "#fff",
      }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const isFilled = i < filled;
        return (
          <div
            key={i}
            style={{
              width: 8,
              height,
              background: isFilled ? "#ffd166" : "#f0e8cc",
              border: "1px solid #1a1a1a",
              transition: "background 160ms ease",
            }}
          />
        );
      })}
    </div>
  );
}
