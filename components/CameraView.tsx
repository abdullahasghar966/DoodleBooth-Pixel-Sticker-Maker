"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CENTER_FALLBACK_BOX,
  cropToBase64Jpeg,
  detectFaceBox,
  loadImage,
} from "@/lib/faceDetect";

type Stage =
  | "idle"
  | "requesting"
  | "denied"
  | "preview"
  | "capturing"
  | "done";

export type CameraViewProps = {
  /** Called once after all shots are captured. Each entry is a raw
   *  base64 JPEG (no data: prefix), 96×96, ≤ 20 KB. */
  onComplete: (shots: string[]) => void;
  /** How many shots to take. Defaults to 4 (used for full sessions);
   *  set to 1 for an individual retake from the review screen. */
  shotCount?: number;
};

const DEFAULT_shotCount = 4;
const SHOT_GAP_MS = 2000;
const COUNTDOWN_TICKS = ["3", "2", "1", "✨"];
const TICK_MS = 700;
const FLASH_MS = 180;
const POLL_FACE_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CameraView({
  onComplete,
  shotCount = DEFAULT_shotCount,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stageRef = useRef<Stage>("idle");

  const [stage, _setStage] = useState<Stage>("idle");
  const [faceFound, setFaceFound] = useState(false);
  const [tick, setTick] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [dragging, setDragging] = useState(false);

  const setStage = useCallback((s: Stage) => {
    stageRef.current = s;
    _setStage(s);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const requestCamera = useCallback(async () => {
    setStage("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      // Don't try to attach the stream here — the <video> element is in a
      // different render branch and isn't mounted yet. The useEffect below
      // wires it up once stage transitions to "preview".
      setStage("preview");
    } catch {
      setStage("denied");
    }
  }, [setStage]);

  // Attach the MediaStream to the <video> element after it mounts.
  // Re-runs on every stage change so it reliably catches the preview mount.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => {
      // Autoplay block — muted+playsInline should bypass it; if not, the
      // user will see the feed as soon as the browser allows.
    });
  }, [stage]);

  // Live face polling while in preview stage.
  useEffect(() => {
    if (stage !== "preview") return;
    let cancelled = false;

    const tickFn = async () => {
      if (cancelled || stageRef.current !== "preview") return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const box = await detectFaceBox(video);
          if (!cancelled) setFaceFound(box !== null);
        } catch {
          if (!cancelled) setFaceFound(false);
        }
      }
      if (!cancelled && stageRef.current === "preview") {
        setTimeout(tickFn, POLL_FACE_MS);
      }
    };
    void tickFn();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const startCapture = useCallback(async () => {
    if (stageRef.current !== "preview") return;
    setStage("capturing");
    setShotsTaken(0);

    // Countdown
    for (const t of COUNTDOWN_TICKS) {
      setTick(t);
      await sleep(TICK_MS);
    }
    setTick(null);

    const shots: string[] = [];
    for (let i = 0; i < shotCount; i++) {
      // Flash overlay
      setFlash(true);
      setTimeout(() => setFlash(false), FLASH_MS);

      const video = videoRef.current;
      if (!video) break;
      let box;
      try {
        box = (await detectFaceBox(video)) ?? CENTER_FALLBACK_BOX;
      } catch {
        box = CENTER_FALLBACK_BOX;
      }
      try {
        const b64 = cropToBase64Jpeg(video, box, 96, 0.25);
        shots.push(b64);
      } catch {
        // If a single capture fails, drop it; the booth page will handle
        // the short array (we still call onComplete with what we got).
      }
      setShotsTaken(i + 1);

      if (i < shotCount - 1) await sleep(SHOT_GAP_MS);
    }

    setStage("done");
    stopStream();
    onComplete(shots);
  }, [onComplete, setStage, stopStream, shotCount]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  // File-upload fallback when camera is denied.
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, shotCount);
      if (list.length === 0) return;

      const shots: string[] = [];
      for (const f of list) {
        const url = URL.createObjectURL(f);
        try {
          const img = await loadImage(url);
          let box;
          try {
            box = (await detectFaceBox(img)) ?? CENTER_FALLBACK_BOX;
          } catch {
            box = CENTER_FALLBACK_BOX;
          }
          shots.push(cropToBase64Jpeg(img, box, 96, 0.25));
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      // Pad to shotCount by repeating the last shot.
      while (shots.length > 0 && shots.length < shotCount) {
        shots.push(shots[shots.length - 1]!);
      }
      if (shots.length === 0) return;
      setStage("done");
      onComplete(shots);
    },
    [onComplete, setStage, shotCount],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) {
      void handleFiles(e.dataTransfer.files);
    }
  };
  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void handleFiles(e.target.files);
  };

  // ─────────────────────── render ───────────────────────

  if (stage === "idle") {
    return (
      <div className="doodle-card p-6 max-w-md mx-auto text-center">
        <h2 className="text-3xl mb-3">Smile! 📸</h2>
        <p className="font-courier mb-4">
          {shotCount === 1
            ? "We'll take 1 quick shot to replace the previous one."
            : `We'll take ${shotCount} quick shots and turn each one into a pixel sticker.`}
        </p>
        <p className="font-courier text-sm mb-4 opacity-80">
          🔒 Your photos never leave your device.
        </p>
        <button className="doodle-btn-primary" onClick={() => void requestCamera()}>
          Start the booth
        </button>
      </div>
    );
  }

  if (stage === "requesting") {
    return (
      <div className="doodle-card p-6 max-w-md mx-auto text-center">
        <p className="font-courier">Asking for your camera…</p>
      </div>
    );
  }

  if (stage === "denied") {
    return (
      <div
        className={`doodle-card p-6 max-w-md mx-auto text-center transition-shadow ${
          dragging ? "shadow-ink-lg" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <h2 className="text-3xl mb-2">No camera? No worries.</h2>
        <p className="font-courier mb-4">
          Drop up to 4 photos here, or pick from your device.
        </p>
        <label className="doodle-btn-secondary inline-block cursor-pointer">
          Choose photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFileInput}
          />
        </label>
      </div>
    );
  }

  // preview / capturing / done — show the video frame.
  return (
    <div className="doodle-card p-4 max-w-xl mx-auto">
      <div className="relative overflow-hidden rounded-md border-2 border-ink bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          autoPlay
          playsInline
          muted
        />

        {/* Flash */}
        <AnimatePresence>
          {flash && (
            <motion.div
              key="flash"
              className="absolute inset-0 bg-white pointer-events-none"
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: FLASH_MS / 1000 }}
            />
          )}
        </AnimatePresence>

        {/* Countdown */}
        <AnimatePresence mode="wait">
          {tick && (
            <motion.div
              key={tick}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1.4, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span
                className="text-9xl"
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  color: "#ffd166",
                  textShadow: "4px 4px 0 #1a1a1a",
                }}
              >
                {tick}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Move-closer banner */}
        {stage === "preview" && !faceFound && (
          <div className="absolute top-2 left-2 right-2 flex justify-between items-center bg-paper border-2 border-ink rounded px-3 py-2 shadow-ink-sm">
            <span className="font-courier">Move closer! 👀</span>
            <button
              className="doodle-btn-secondary"
              style={{ padding: "2px 10px", fontSize: 14 }}
              onClick={() => setFaceFound(false)}
            >
              Retry
            </button>
          </div>
        )}

        {/* Shot counter */}
        {stage === "capturing" && (
          <div className="absolute bottom-2 right-2 bg-ink text-doodle-yellow font-caveat text-xl px-3 py-1 rounded">
            {shotsTaken} / {shotCount}
          </div>
        )}
      </div>

      {stage === "preview" && (
        <div className="mt-4 flex justify-center gap-3">
          <button className="doodle-btn-primary" onClick={() => void startCapture()}>
            {shotCount === 1 ? "Capture 1 shot" : `Capture ${shotCount} shots`}
          </button>
        </div>
      )}

      <p className="font-courier text-xs text-center mt-3 opacity-70">
        🔒 Your photos never leave your device.
      </p>
    </div>
  );
}
