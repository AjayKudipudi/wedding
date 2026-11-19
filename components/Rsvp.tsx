"use client";

import { useState } from "react";
import type { Wedding } from "@/content/wedding";

export default function Rsvp({ w, guest }: { w: Wedding; guest: string }) {
  const [typedName, setTypedName] = useState<string | null>(null);
  const name = typedName ?? guest;
  const [phone, setPhone] = useState("");
  const [arrival, setArrival] = useState("");
  const [coming, setComing] = useState<"yes" | "no">("yes");
  const [count, setCount] = useState(2);
  const [picked, setPicked] = useState<string[]>(w.events.map((e) => e.name));
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const toSheet = Boolean(w.rsvpSheetUrl);

  // Guests can arrive any time from two weeks before, up to the wedding day itself.
  const weddingDay = w.muhurtham.slice(0, 10);
  const earliest = new Date(new Date(`${weddingDay}T00:00:00`).getTime() - 14 * 86400_000).toLocaleDateString("en-CA");
  const digits = phone.replace(/\D/g, "");
  const arrivalText = arrival
    ? new Date(`${arrival}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
    : "";

  const toggle = (ev: string) =>
    setPicked((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!name.trim()) {
      setError("Enter your name so we know who is coming.");
      return;
    }
    if (digits.length < 7) {
      setError("Enter a phone number we can reach you on.");
      return;
    }
    if (coming === "yes" && !arrival) {
      setError("Choose the date you will arrive.");
      return;
    }
    if (coming === "yes" && picked.length === 0) {
      setError("Choose at least one ceremony you will join.");
      return;
    }
    setError("");

    if (toSheet) {
      // One row in the couple's Google Sheet per reply.
      setStatus("sending");
      try {
        await fetch(w.rsvpSheetUrl, {
          method: "POST",
          mode: "no-cors", // the sheet's script cannot answer across sites; a completed request means it arrived
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            coming: coming === "yes" ? "Yes" : "No",
            guests: coming === "yes" ? count : 0,
            arriving: coming === "yes" ? arrivalText : "",
            ceremonies: coming === "yes" ? picked.join(", ") : "",
            invitedAs: guest,
          }),
        });
        setStatus("sent");
      } catch {
        setStatus("idle");
        setError("Your reply was not saved. Check your connection and send it again.");
      }
      return;
    }

    const lines =
      coming === "yes"
        ? [
            `Namaste! This is ${name.trim()}.`,
            `We will be there for ${w.groom} & ${w.bride}'s wedding.`,
            `Guests: ${count}`,
            `Arriving: ${arrivalText}`,
            `Joining: ${picked.join(", ")}`,
            `Phone: ${phone.trim()}`,
          ]
        : [
            `Namaste! This is ${name.trim()}.`,
            `We are sorry we cannot make it to ${w.groom} & ${w.bride}'s wedding. Our blessings are with you both.`,
            `Phone: ${phone.trim()}`,
          ];
    const url = `https://wa.me/${w.rsvpWhatsApp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
  };

  if (status === "sent") {
    return (
      <div className="rsvp-form rsvp-thanks" role="status">
        <p className="rsvp-thanks-title">{coming === "yes" ? "Your reply is saved. We will see you there." : "Your reply is saved. You will be missed."}</p>
        <p>
          {w.groom} and {w.bride} can see it now.
        </p>
        <button type="button" className="link-quiet" onClick={() => setStatus("idle")}>
          Change my reply
        </button>
      </div>
    );
  }

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

      <label className="field">
        <span className="field-label">Your phone number</span>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          aria-invalid={!!error && digits.length < 7}
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

          <label className="field">
            <span className="field-label">The date you arrive</span>
            <input
              type="date"
              value={arrival}
              min={earliest}
              max={weddingDay}
              onChange={(e) => setArrival(e.target.value)}
              aria-invalid={!!error && !arrival}
            />
            <span className="field-hint">So the family can plan your stay and travel.</span>
          </label>

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
      <button type="submit" className="send" disabled={status === "sending"}>
        {toSheet ? (status === "sending" ? "Sending your RSVP" : "Send RSVP") : "Send RSVP on WhatsApp"}
      </button>
    </form>
  );
}
