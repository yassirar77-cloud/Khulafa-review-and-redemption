"use client";

export function PrintButton() {
  return (
    <button className="btn btn-small" onClick={() => window.print()}>
      Print poster
    </button>
  );
}
