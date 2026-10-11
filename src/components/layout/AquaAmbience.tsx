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
