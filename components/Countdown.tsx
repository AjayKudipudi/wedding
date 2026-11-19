"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 30_000);
  return () => window.clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);

export default function Countdown({ iso }: { iso: string }) {
  const minute = useSyncExternalStore(subscribe, minuteNow, () => null);
  if (minute === null) return <p className="countdown" aria-hidden="true">&nbsp;</p>;

  const left = Math.floor(new Date(iso).getTime() / 60_000) - minute;
  if (left <= 0) {
    return <p className="countdown countdown-done">The lamp is lit. They are married.</p>;
  }
  const days = Math.floor(left / 1440);
  const hours = Math.floor((left % 1440) / 60);
  const mins = left % 60;
  const cells: [number, string][] = [
    [days, days === 1 ? "day" : "days"],
    [hours, hours === 1 ? "hour" : "hours"],
    [mins, mins === 1 ? "minute" : "minutes"],
  ];
  return (
    <p className="countdown" role="timer" aria-label={`${days} days, ${hours} hours and ${mins} minutes to the wedding day`}>
      {cells.map(([n, label]) => (
        <span key={label} className="countdown-cell" aria-hidden="true">
          <span className="countdown-num">{n}</span>
          <span className="countdown-label">{label}</span>
        </span>
      ))}
    </p>
  );
}
