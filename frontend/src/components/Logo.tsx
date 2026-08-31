import { useEffect, useId, useRef } from "react";
import { prefersReducedMotion } from "../format";

const EYE_R = 46;
const IRIS_R = 18;
const MAX_GAZE = 22;
const LID_TRAVEL = 52;
const POINTER_REACH = 260;
const POINTER_HOLD_MS = 1800;

type Gaze = { x: number; y: number };

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Próximo ponto de fixação: gira bastante em relação ao atual para o olhar parecer intencional. */
function nextTarget(from: Gaze): Gaze {
  if (Math.random() < 0.18) return { x: 0, y: 0 };
  const third = (Math.PI * 2) / 3;
  const turn = third + Math.random() * third;
  const angle = Math.atan2(from.y, from.x) + (Math.random() < 0.5 ? turn : -turn);
  const radius = MAX_GAZE * (0.55 + Math.random() * 0.45);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.8 };
}

export function EyeMark({ size = 28, follow = true }: { size?: number; follow?: boolean }) {
  const clipId = `eye-clip-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const irisRef = useRef<SVGGElement>(null);
  const topLidRef = useRef<SVGRectElement>(null);
  const botLidRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const t0 = performance.now();
    let raf: number | null = null;
    let gaze: Gaze = { x: 0, y: 0 };
    let from: Gaze = { x: 0, y: 0 };
    let to: Gaze = { x: 0, y: 0 };
    let saccadeAt = t0;
    let saccadeMs = 120;
    let holdUntil = t0 + 700;
    let blinkAt = t0 + 2200;
    let blinkFrom = -1;
    let blinkMs = 160;
    let pointer: { x: number; y: number; at: number } | null = null;

    function onPointerMove(e: PointerEvent) {
      pointer = { x: e.clientX, y: e.clientY, at: performance.now() };
    }
    if (follow) window.addEventListener("pointermove", onPointerMove, { passive: true });

    function tracked(now: number): Gaze | null {
      if (!pointer || now - pointer.at > POINTER_HOLD_MS) return null;
      const box = svgRef.current?.getBoundingClientRect();
      if (!box) return null;
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / POINTER_REACH) * MAX_GAZE;
      return { x: (dx / dist) * reach, y: (dy / dist) * reach };
    }

    function tick(now: number) {
      const aim = tracked(now);
      if (aim) {
        gaze.x += (aim.x - gaze.x) * 0.16;
        gaze.y += (aim.y - gaze.y) * 0.16;
        from = { ...gaze };
        to = { ...gaze };
        holdUntil = now + 500;
      } else if (now >= holdUntil) {
        from = { ...gaze };
        to = nextTarget(gaze);
        saccadeAt = now;
        saccadeMs = 90 + Math.random() * 70;
        holdUntil = now + saccadeMs + 700 + Math.random() * 1800;
        if (Math.random() < 0.3) blinkAt = Math.min(blinkAt, now + saccadeMs);
      } else {
        const p = Math.min(1, (now - saccadeAt) / saccadeMs);
        const e = easeOutCubic(p);
        gaze.x = from.x + (to.x - from.x) * e;
        gaze.y = from.y + (to.y - from.y) * e;
      }

      if (blinkFrom < 0 && now >= blinkAt) {
        blinkFrom = now;
        blinkMs = 140 + Math.random() * 60;
      }
      let lid = 0;
      if (blinkFrom >= 0) {
        const p = (now - blinkFrom) / blinkMs;
        if (p >= 1) {
          blinkFrom = -1;
          blinkAt = now + (Math.random() < 0.12 ? 180 : 2600 + Math.random() * 4200);
        } else {
          lid = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
        }
      }

      // deriva de fixação: o olho nunca fica perfeitamente parado
      const driftX = Math.sin(now / 700) * 0.5;
      const driftY = Math.cos(now / 900) * 0.4;
      const breath = 1 + Math.sin(now / 1400) * 0.025;
      irisRef.current?.setAttribute(
        "transform",
        `translate(${(50 + gaze.x + driftX).toFixed(2)} ${(50 + gaze.y + driftY).toFixed(2)}) scale(${breath.toFixed(3)})`,
      );
      topLidRef.current?.setAttribute("transform", `translate(0 ${(LID_TRAVEL * lid).toFixed(2)})`);
      botLidRef.current?.setAttribute("transform", `translate(0 ${(-LID_TRAVEL * lid).toFixed(2)})`);
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (follow) window.removeEventListener("pointermove", onPointerMove);
    };
  }, [follow]);

  return (
    <svg
      ref={svgRef}
      className="eye-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={50} cy={50} r={EYE_R} />
        </clipPath>
      </defs>
      <circle className="eye-white" cx={50} cy={50} r={EYE_R} />
      <g clipPath={`url(#${clipId})`}>
        <g className="eye-iris" ref={irisRef} transform="translate(50 50)">
          <circle className="iris-disc" r={IRIS_R} />
          <circle className="iris-core" r={7.5} />
          <circle className="iris-spec" cx={-6} cy={-6.5} r={4.4} />
          <circle className="iris-spec sm" cx={6.5} cy={7} r={2.1} />
        </g>
        <rect className="eye-lid" ref={topLidRef} x={-10} y={-104} width={120} height={104} />
        <rect className="eye-lid" ref={botLidRef} x={-10} y={100} width={120} height={104} />
      </g>
      <circle className="eye-ring" cx={50} cy={50} r={EYE_R} />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <>
      <EyeMark size={size} />
      <div className="brand">
        VIGIA<span className="ai"> AI</span>
      </div>
    </>
  );
}
