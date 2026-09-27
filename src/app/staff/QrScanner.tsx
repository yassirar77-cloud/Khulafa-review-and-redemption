"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseScannedCode } from "@/lib/code";

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning"; hint?: string }
  | { kind: "error"; message: string };

const SCAN_EVERY_MS = 120;
const MAX_FRAME_SIDE = 720;

/** Explains a getUserMedia failure in words a cashier can act on. */
function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "Camera permission is blocked. Tap the icon next to the web address, allow Camera for this site, then tap Scan QR again. You can also type the code below.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return "No camera found on this device. Type the code below instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "The camera is being used by another app. Close it and tap Scan QR again, or type the code below.";
  }
  return "Couldn't start the camera. Type the code below instead.";
}

/**
 * "Scan QR" button that opens the back camera in the page and reads a voucher
 * QR. It only reports the code; checking and redeeming stay with the caller.
 */
export function QrScanner({ onCode, disabled }: { onCode: (code: string) => void; disabled?: boolean }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  const stop = useCallback(() => {
    runIdRef.current++;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cancel = useCallback(() => {
    stop();
    setStatus({ kind: "idle" });
  }, [stop]);

  // Release the camera when leaving the page or switching apps.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && cancel();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [cancel, stop]);

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus({
        kind: "error",
        message: "The camera only works on the secure (https://) link of this site. Type the code below instead.",
      });
      return;
    }
    stop();
    const runId = runIdRef.current;
    setStatus({ kind: "starting" });

    let stream: MediaStream;
    try {
      const [media, { default: jsQR }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
        import("jsqr"),
      ]);
      stream = media;
      if (runId !== runIdRef.current) {
        stream.getTracks().forEach((t) => t.stop()); // cancelled while starting
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus({ kind: "scanning" });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      let hintUntil = 0;

      const tick = () => {
        if (runId !== runIdRef.current) return;
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(w, h));
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
          if (found?.data) {
            const code = parseScannedCode(found.data);
            if (code) {
              navigator.vibrate?.(80);
              stop();
              setStatus({ kind: "idle" });
              onCode(code);
              return;
            }
            if (Date.now() > hintUntil) {
              hintUntil = Date.now() + 2500;
              setStatus({ kind: "scanning", hint: "That QR code isn't a voucher. Scan the QR on the customer's voucher screen." });
            }
          } else if (hintUntil && Date.now() > hintUntil) {
            hintUntil = 0;
            setStatus({ kind: "scanning" });
          }
        }
        timerRef.current = window.setTimeout(tick, SCAN_EVERY_MS);
      };
      tick();
    } catch (err) {
      if (runId !== runIdRef.current) return;
      stop();
      setStatus({ kind: "error", message: cameraErrorMessage(err) });
    }
  }

  const open = status.kind === "starting" || status.kind === "scanning";

  return (
    <div className="scanner">
      {!open && (
        <button type="button" className="btn btn-scan" onClick={start} disabled={disabled}>
          <CameraIcon /> Scan QR
        </button>
      )}
      <div className="scanner-view" hidden={!open}>
        <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview" />
        <div className="scanner-frame" aria-hidden="true" />
        {status.kind === "starting" && <div className="scanner-note">Opening camera…</div>}
      </div>
      {open && (
        <>
          <p className="hint center" role="status">
            {status.kind === "scanning" && status.hint
              ? status.hint
              : "Point the camera at the QR code on the customer's voucher."}
          </p>
          <button type="button" className="btn btn-secondary" onClick={cancel}>
            Cancel
          </button>
        </>
      )}
      {status.kind === "error" && (
        <div className="alert alert-error" role="alert">
          {status.message}
        </div>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}
