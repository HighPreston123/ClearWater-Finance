import { useEffect } from "react";

/** Decorative Aquatic Neo-Aero layer: soft caustic light, a few drifting bubbles, and click ripples. */
const BUBBLES = [
  { left: "6%", size: 46, delay: "0s", dur: "26s" },
  { left: "22%", size: 18, delay: "-8s", dur: "19s" },
  { left: "48%", size: 30, delay: "-14s", dur: "30s" },
  { left: "71%", size: 22, delay: "-4s", dur: "22s" },
  { left: "88%", size: 58, delay: "-18s", dur: "34s" },
];

export function AquaAmbience() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("button, a, [role='button'], [role='tab']");
      if (!target) return;
      const dot = document.createElement("span");
      dot.className = "aqua-ripple";
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      document.body.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove());
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <div aria-hidden className="aqua-ambience">
      <div className="aqua-caustics" />
      <svg className="aqua-hills" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden>
        <path className="aqua-hill-back" d="M0 170 C220 90 420 110 640 160 C860 210 1060 80 1260 110 C1350 124 1410 150 1440 160 L1440 320 L0 320 Z" />
        <path className="aqua-hill-mid" d="M0 220 C180 150 380 170 580 215 C800 265 1000 160 1200 175 C1320 185 1400 215 1440 230 L1440 320 L0 320 Z" />
        <path className="aqua-hill-front" d="M0 265 C240 225 460 240 700 270 C900 295 1120 235 1300 245 C1380 250 1420 262 1440 270 L1440 320 L0 320 Z" />
        <path className="aqua-hill-shine" d="M0 265 C240 225 460 240 700 270 C900 295 1120 235 1300 245 C1380 250 1420 262 1440 270" />
      </svg>
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="aqua-bubble"
          style={{ left: b.left, width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.dur }}
        />
      ))}
    </div>
  );
}
