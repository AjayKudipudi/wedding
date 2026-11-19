"use client";

import { useSyncExternalStore } from "react";

// Ticks once a second, so the seconds count down live.
const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
};
const secondNow = () => Math.floor(Date.now() / 1000);

const two = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribe, secondNow, () => null);
  if (now === null) return <p className="countdown" aria-hidden="true">&nbsp;</p>;

  const left = Math.floor(new Date(iso).getTime() / 1000) - now;
  if (left <= 0) {
    return <p className="countdown countdown-done">The lamp is lit. They are married.</p>;
  }
  const days = Math.floor(left / 86400);
  const hours = Math.floor((left % 86400) / 3600);
  const mins = Math.floor((left % 3600) / 60);
  const secs = left % 60;
  const cells: [string, string][] = [
    [String(days), days === 1 ? "day" : "days"],
    [two(hours), hours === 1 ? "hour" : "hours"],
    [two(mins), mins === 1 ? "minute" : "minutes"],
    [two(secs), secs === 1 ? "second" : "seconds"],
  ];
  return (
    // The label leaves out seconds so screen readers aren't given a new sentence every second.
    <p className="countdown" role="timer" aria-live="off" aria-label={`${days} days, ${hours} hours and ${mins} minutes to the wedding day`}>
      {cells.map(([n, label], i) => (
        <span key={i} className="countdown-cell" aria-hidden="true">
          <span className="countdown-num">{n}</span>
          <span className="countdown-label">{label}</span>
        </span>
      ))}
    </p>
  );
}
