"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import type { Wedding } from "@/content/wedding";
import { Diya, GoldDefs, Kolam, Mandala } from "./Art";
import Scene, { type SceneState } from "./Scene";
import Countdown from "./Countdown";
import Rsvp from "./Rsvp";

gsap.registerPlugin(useGSAP, ScrollTrigger, DrawSVGPlugin, SplitText, ScrollToPlugin);

type Phase = "dark" | "lighting" | "lit";

// A link like ?to=Lakshmi+garu greets that guest by name.
const noSubscribe = () => () => {};
const readGuest = () =>
  (new URLSearchParams(window.location.search).get("to") ?? "").replace(/[<>]/g, "").trim().slice(0, 40);

function calendarUrl(w: Wedding) {
  const start = new Date(w.muhurtham);
  const end = new Date(start.getTime() + 3 * 3600_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${w.groom} & ${w.bride} — wedding`,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: `${w.venue.name}, ${w.venue.address}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export default function Experience({ w }: { w: Wedding }) {
  const root = useRef<HTMLElement>(null);
  const sim = useRef<SceneState>({ lit: -1, intro: 0, progress: 0, petals: 0 });
  const [phase, setPhase] = useState<Phase>("dark");
  const guest = useSyncExternalStore(noSubscribe, readGuest, () => "");

  // The page stays still until the lamps are lit.
  useEffect(() => {
    if (phase === "lit") return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.documentElement.classList.add("locked");
    return () => document.documentElement.classList.remove("locked");
  }, [phase]);

  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const el = root.current!;
        el.classList.add("motion");

        // Scrolling walks the guest down the hall of arches and out into the light.
        gsap
          .timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom bottom", scrub: 0.7 } })
          .to(sim.current, { progress: 1, ease: "none", duration: 1 }, 0)
          .to(".hero-copy", { opacity: 0, y: -50, scale: 1.08, ease: "power1.in", duration: 0.22 }, 0)
          .to(".scroll-cue", { opacity: 0, duration: 0.08 }, 0)
          .to(".hero-light", { opacity: 1, ease: "power2.in", duration: 0.3 }, 0.7);

        gsap.utils.toArray<HTMLElement>(".reveal").forEach((h) => {
          SplitText.create(h, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 110,
                duration: 1.1,
                stagger: 0.12,
                ease: "power4.out",
                scrollTrigger: { trigger: h, start: "top 86%", once: true },
              }),
          });
        });

        gsap.utils.toArray<SVGElement>(".kolam").forEach((k) => {
          gsap.fromTo(
            k.querySelectorAll("path"),
            { drawSVG: "0%" },
            { drawSVG: "100%", ease: "none", scrollTrigger: { trigger: k, start: "top 92%", end: "top 50%", scrub: 0.6 } },
          );
        });

        gsap.fromTo(
          ".thread-fill",
          { scaleY: 0 },
          { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".events", start: "top 62%", end: "bottom 62%", scrub: 0.4 } },
        );
        gsap.utils.toArray<HTMLElement>(".event").forEach((ev) => {
          ScrollTrigger.create({
            trigger: ev,
            start: "top 64%",
            onEnter: () => ev.classList.add("is-lit"),
            onLeaveBack: () => ev.classList.remove("is-lit"),
          });
        });

        gsap
          .timeline({ scrollTrigger: { trigger: ".muhurtham", start: "top 85%", end: "center 45%", scrub: 0.8 } })
          .fromTo(".mandala path, .mandala circle", { drawSVG: "0%" }, { drawSVG: "100%", ease: "none", stagger: 0.01 }, 0)
          .fromTo(".mandala", { rotation: -40 }, { rotation: 0, ease: "none" }, 0);

        return () => el.classList.remove("motion");
      });
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    },
    { scope: root },
  );

  const light = () => {
    if (phase !== "dark") return;
    contextSafe(ignite)();
  };

  const ignite = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const split = SplitText.create(".name", { type: "chars", charsClass: "char" });

    // One lamp, then the rangoli, then the hall, arch by arch.
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(sim.current, { lit: 0 }, { lit: 7, duration: 7, ease: "none" }, 0)
      .to(sim.current, { intro: 1, duration: 6.5, ease: "power2.out" }, 0)
      .to(".veil-copy", { opacity: 0, y: -12, duration: 0.7, stagger: 0.06 }, 0)
      .from(split.chars, { yPercent: 125, duration: 1.3, stagger: 0.07, ease: "power4.out" }, 2.3)
      .fromTo(".hero-fade", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.16 }, 3)
      .to(sim.current, { petals: 1, duration: 2.5, ease: "power1.inOut" }, 3.2)
      .call(() => setPhase("lit"), [], 4.4);

    setPhase("lighting");
    if (reduce) {
      tl.progress(1);
      return;
    }
    // Five seconds after the last lamp catches, carry the guest on to the invitation —
    // unless they have already started scrolling, or do so on the way (that cancels it).
    let touched = false;
    const mark = () => (touched = true);
    for (const type of ["wheel", "touchstart", "keydown"]) window.addEventListener(type, mark, { once: true, passive: true });
    tl.call(
      () => {
        if (touched || window.scrollY > 8) return;
        gsap.to(window, { scrollTo: { y: ".invite", autoKill: true }, duration: 3.6, ease: "power2.inOut" });
      },
      [],
      11.6,
    );
  };

  return (
    <main ref={root} data-phase={phase}>
      <GoldDefs />

      <section className="hero">
        <div className="hero-pin">
          <Scene state={sim} />

          {phase !== "lit" && (
            <div className="veil">
              <p className="veil-copy veil-invocation" lang="te">
                {w.invocation}
              </p>
              <p className="veil-copy veil-greeting">
                {guest ? (
                  <>
                    <span className="veil-dear">Dear {guest},</span> the lamps are waiting for you.
                  </>
                ) : (
                  "The lamps are waiting for you."
                )}
              </p>
              <p className="veil-copy veil-hint">Touch anywhere to light them</p>
            </div>
          )}

          <div className="hero-copy">
            <p className="hero-fade gate-te" lang="te">
              {w.invocation}
            </p>
            <h1 className="names">
              <span className="name-line">
                <span className="name">{w.groom}</span>
              </span>
              <span className="hero-fade amp" aria-label="and">
                &amp;
              </span>
              <span className="name-line">
                <span className="name">{w.bride}</span>
              </span>
            </h1>
            <p className="hero-fade gate-date">{w.dateLine}</p>
            <p className="hero-fade gate-city">{w.city}</p>
          </div>

          {phase === "dark" && (
            <button type="button" className="light-btn" onClick={light} aria-label="Light the lamps to open the invitation" />
          )}
          <p className="hero-fade scroll-cue">Scroll to walk in</p>
          <div className="hero-light" aria-hidden="true" />
        </div>
      </section>

      <section className="invite">
        <div className="invite-inner">
          <p className="te-title" lang="te">
            ఆహ్వానం
          </p>
          <p className="invite-hosts">
            {w.hosts.groomSide}
            <span className="invite-and">and</span>
            {w.hosts.brideSide}
          </p>
          <p className="invite-text">{w.invitation[0]}</p>
          <p className="invite-names">
            {w.groom} <span>with</span> {w.bride}
          </p>
          <Kolam />
          <p className="invite-text">{w.invitation[1]}</p>
        </div>
      </section>

      <section className="ceremonies">
        <header className="section-head">
          <p className="te-title" lang="te">
            వేడుకలు
          </p>
          <h2 className="reveal">Three days of celebration</h2>
        </header>
        <div className="events">
          <span className="thread" aria-hidden="true">
            <span className="thread-fill" />
          </span>
          <ol className="event-list">
          {w.events.map((ev) => (
            <li className="event" key={ev.name}>
              <span className="event-lamp" aria-hidden="true">
                <Diya />
              </span>
              <div className="event-body">
                <p className="event-te" lang="te">
                  {ev.te}
                </p>
                <h3>{ev.name}</h3>
                <p className="event-when">
                  {ev.when}
                  {ev.time && `, ${ev.time}`}
                </p>
                {ev.where && <p className="event-where">{ev.where}</p>}
                <p className="event-note">{ev.note}</p>
              </div>
            </li>
          ))}
          </ol>
        </div>
      </section>

      <section className="muhurtham">
        <Mandala />
        <div className="muhurtham-copy">
          <p className="te-title" lang="te">
            సుముహూర్తం
          </p>
          <h2 className="reveal">The muhurtham</h2>
          <p className="muhurtham-date">
            {w.dateLine}
            {w.muhurthamTime && `, ${w.muhurthamTime}`}
          </p>
          <Countdown iso={w.muhurtham} />
        </div>
      </section>

      <section className="venue">
        <div className="venue-inner">
          <p className="te-title" lang="te">
            వేదిక
          </p>
          <h2 className="reveal">{w.venue.name}</h2>
          <p className="venue-address">{w.venue.address}</p>
          <div className="venue-actions">
            <a className="link-btn" href={w.venue.mapsUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps
            </a>
            <a className="link-btn" href={calendarUrl(w)} target="_blank" rel="noopener noreferrer">
              Add to my calendar
            </a>
          </div>
          <Kolam />
        </div>
      </section>

      <section className="rsvp">
        <header className="section-head">
          <p className="te-title" lang="te">
            మీ రాక మాకు ఆనందం
          </p>
          <h2 className="reveal">Tell us you are coming</h2>
          <p className="section-sub">
            {w.rsvpSheetUrl
              ? `Your reply goes straight to ${w.groom} and ${w.bride}.`
              : "Your reply opens in WhatsApp, ready to send to the family."}
          </p>
        </header>
        <Rsvp w={w} guest={guest} />
        <footer className="closing">
          <Diya className="closing-diya" />
          <p>
            With love, {w.groom} &amp; {w.bride}
          </p>
        </footer>
      </section>
    </main>
  );
}
