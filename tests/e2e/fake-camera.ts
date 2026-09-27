// Builds a Y4M video showing a QR code, for Chromium's fake camera
// (--use-file-for-fake-video-capture). No ffmpeg needed.
import { writeFileSync } from "fs";
import QRCode from "qrcode";

export function writeQrVideo(path: string, text: string, width = 640, height = 480): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 4;
  const px = Math.floor((Math.min(width, height) * 0.8) / (n + quiet * 2));
  const size = px * (n + quiet * 2);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);

  const y = Buffer.alloc(width * height, 235); // white
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      for (let dy = 0; dy < px; dy++) {
        const row = (top + (r + quiet) * px + dy) * width;
        y.fill(16, row + left + (c + quiet) * px, row + left + (c + quiet + 1) * px); // black
      }
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);
  writeFileSync(path, Buffer.concat([header, frame, frame, frame, frame, frame]));
}
