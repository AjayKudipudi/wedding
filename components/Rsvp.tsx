"use client";

import { useState } from "react";
import type { Wedding } from "@/content/wedding";

export default function Rsvp({ w, guest }: { w: Wedding; guest: string }) {
  const [typedName, setTypedName] = useState<string | null>(null);
  const name = typedName ?? guest;
  const [coming, setComing] = useState<"yes" | "no">("yes");
  const [count, setCount] = useState(2);
  const [picked, setPicked] = useState<string[]>(w.events.map((e) => e.name));
  const [error, setError] = useState("");

  const toggle = (ev: string) =>
    setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name so we know who is coming.");
      return;
    }
    if (coming === "yes" && picked.length === 0) {
      setError("Choose at least one ceremony you will join.");
      return;
    }
    setError("");
    const lines =
      coming === "yes"
        ? [
            `Namaste! This is ${name.trim()}.`,
            `We will be there for ${w.groom} & ${w.bride}'s wedding.`,
            `Guests: ${count}`,
            `Joining: ${picked.join(", ")}`,
          ]
        : [
            `Namaste! This is ${name.trim()}.`,
            `We are sorry we cannot make it to ${w.groom} & ${w.bride}'s wedding. Our blessings are with you both.`,
          ];
    const url = `https://wa.me/${w.rsvpWhatsApp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <form className="rsvp-form" onSubmit={send} noValidate>
      <label className="field">
        <span className="field-label">Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setTypedName(e.target.value)}
          autoComplete="name"
          aria-invalid={!!error && !name.trim()}
        />
      </label>

      <fieldset className="field choice">
        <legend className="field-label">Will you join us?</legend>
        <label className="pill">
          <input type="radio" name="coming" checked={coming === "yes"} onChange={() => setComing("yes")} />
          <span>Yes, with joy</span>
        </label>
        <label className="pill">
          <input type="radio" name="coming" checked={coming === "no"} onChange={() => setComing("no")} />
          <span>Sadly, no</span>
        </label>
      </fieldset>

      {coming === "yes" && (
        <>
          <div className="field">
            <span className="field-label" id="count-label">How many of you</span>
            <div className="stepper" role="group" aria-labelledby="count-label">
              <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="One fewer guest">
                −
              </button>
              <output aria-live="polite">{count}</output>
              <button type="button" onClick={() => setCount((c) => Math.min(12, c + 1))} aria-label="One more guest">
                +
              </button>
            </div>
          </div>

          <fieldset className="field choice">
            <legend className="field-label">Which ceremonies</legend>
            {w.events.map((ev) => (
              <label className="pill" key={ev.name}>
                <input type="checkbox" checked={picked.includes(ev.name)} onChange={() => toggle(ev.name)} />
                <span>{ev.name}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}

      <p className="form-error" role="alert">
        {error}
      </p>
      <button type="submit" className="send">
        Send RSVP on WhatsApp
      </button>
    </form>
  );
}
