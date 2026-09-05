import { useEffect, useId, useRef } from "react";
import { prefersReducedMotion } from "../format";

const EYE_R = 46;
const IRIS_R = 18;
const MAX_GAZE = 22;
const LID_TRAVEL = 52;
const POINTER_REACH = 260;
const POINTER_HOLD_MS = 1800;

const DIZZY_MS = 3400;
const DIZZY_REQUIRED = Math.PI * 2 * 2.2;
const DIZZY_WINDOW_MS = 2800;

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

function spiralPath(): string {
  const turns = 3.1;
  const steps = 110;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const r = 1.4 + (IRIS_R - 1.6) * (i / steps);
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}
const SPIRAL_D = spiralPath();

export function EyeMark({ size = 28, follow = true }: { size?: number; follow?: boolean }) {
  const clipId = `eye-clip-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const irisRef = useRef<SVGGElement>(null);
  const topLidRef = useRef<SVGRectElement>(null);
  const botLidRef = useRef<SVGRectElement>(null);
  const spiralRef = useRef<SVGGElement>(null);
  const spiralInnerRef = useRef<SVGGElement>(null);
  const dizzyUntilRef = useRef(0);
  const dizzyStartRef = useRef(0);

  useEffect(() => {
    const reduced = prefersReducedMotion();
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

    // detecção de círculo ao redor do olho
    let lastAngle: number | null = null;
    let accum = 0;
    let winStart = t0;
    let cooldownUntil = 0;

    function onPointerMove(e: PointerEvent) {
      pointer = { x: e.clientX, y: e.clientY, at: performance.now() };
      if (!follow || reduced) return;
      const now = performance.now();
      if (now < cooldownUntil) return;
      const box = svgRef.current?.getBoundingClientRect();
      if (!box) return;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const rPx = Math.max(14, size / 2);
      const minDist = rPx * 0.65;
      const maxDist = rPx * 3.4;
      if (dist < minDist || dist > maxDist) {
        lastAngle = null;
        return;
      }
      const ang = Math.atan2(dy, dx);
      if (lastAngle !== null) {
        let delta = ang - lastAngle;
        // normaliza para [-PI, PI]
        delta = ((delta + Math.PI) % (2 * Math.PI)) - Math.PI;
        // ignora saltos grandes (teleporte do ponteiro)
        if (Math.abs(delta) > 1.2) {
          lastAngle = ang;
          return;
        }
        if (now - winStart > DIZZY_WINDOW_MS) {
          accum = 0;
          winStart = now;
        }
        accum += delta;
        if (Math.abs(accum) >= DIZZY_REQUIRED) {
          accum = 0;
          winStart = now;
          lastAngle = null;
          cooldownUntil = now + DIZZY_MS + 600;
          dizzyStartRef.current = now;
          dizzyUntilRef.current = now + DIZZY_MS;
          // avisa todos os olhos + dashboard
          window.dispatchEvent(new CustomEvent("vigia:eye-dizzy", { detail: { at: now } }));
        }
      }
      lastAngle = ang;
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    function onDizzy(e: Event) {
      const now = performance.now();
      // se já está tonto, estende um pouco
      if (now < dizzyUntilRef.current) {
        dizzyUntilRef.current = Math.max(dizzyUntilRef.current, now + DIZZY_MS * 0.7);
        return;
      }
      const detail = (e as CustomEvent).detail as { at?: number } | undefined;
      // evita loop infinito: se o evento veio deste mesmo olho há <50ms, já tratamos acima
      dizzyStartRef.current = now;
      dizzyUntilRef.current = now + DIZZY_MS;
      void detail;
    }
    window.addEventListener("vigia:eye-dizzy", onDizzy as EventListener);

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
      const isDizzy = now < dizzyUntilRef.current;

      if (isDizzy) {
        const elapsed = now - dizzyStartRef.current;
        const rot = reduced ? 0 : (elapsed * 0.62) % 360;
        const pulse = 1 + Math.sin(now / 180) * 0.06;
        const wobbleX = Math.sin(now / 90) * 1.2;
        const wobbleY = Math.cos(now / 110) * 1.0;
        spiralRef.current?.setAttribute("opacity", "1");
        irisRef.current?.setAttribute("opacity", "0");
        spiralRef.current?.setAttribute("transform", `translate(${(50 + wobbleX).toFixed(2)} ${(50 + wobbleY).toFixed(2)})`);
        spiralInnerRef.current?.setAttribute("transform", `rotate(${rot.toFixed(1)}) scale(${pulse.toFixed(3)})`);
        // pálpebras levemente entreabertas quando tonto
        topLidRef.current?.setAttribute("transform", `translate(0 ${(LID_TRAVEL * 0.08).toFixed(2)})`);
        botLidRef.current?.setAttribute("transform", `translate(0 ${(-LID_TRAVEL * 0.08).toFixed(2)})`);
        raf = requestAnimationFrame(tick);
        return;
      }

      // volta ao normal
      spiralRef.current?.setAttribute("opacity", "0");
      irisRef.current?.setAttribute("opacity", "1");

      if (reduced) {
        irisRef.current?.setAttribute("transform", `translate(50 50)`);
        topLidRef.current?.setAttribute("transform", `translate(0 0)`);
        botLidRef.current?.setAttribute("transform", `translate(0 0)`);
        raf = requestAnimationFrame(tick);
        return;
      }

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
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("vigia:eye-dizzy", onDizzy as EventListener);
    };
  }, [follow, size]);

  return (
    <svg
      ref={svgRef}
      className="block shrink-0 overflow-visible drop-shadow-[0_2px_4px_var(--shadow)] transition-transform duration-[180ms] ease-out group-hover/brand:scale-[1.08] [.flat_&]:drop-shadow-none cursor-pointer"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={50} cy={50} r={EYE_R} />
        </clipPath>
      </defs>
      <circle className="fill-white" cx={50} cy={50} r={EYE_R} />
      <g clipPath={`url(#${clipId})`}>
        <g className="drop-shadow-[0_0_4px_var(--glow)] [.flat_&]:drop-shadow-none" ref={irisRef} transform="translate(50 50)">
          <circle className="fill-accent" r={IRIS_R} />
          <circle className="fill-black/55" r={7.5} />
          <circle className="fill-white opacity-[.92]" cx={-6} cy={-6.5} r={4.4} />
          <circle className="fill-white opacity-45" cx={6.5} cy={7} r={2.1} />
        </g>
        <g ref={spiralRef} opacity={0} transform="translate(50 50)">
          <circle className="fill-accent" r={IRIS_R} />
          <g ref={spiralInnerRef} transform="rotate(0)">
            <path d={SPIRAL_D} fill="none" stroke="white" strokeWidth={2.4} strokeLinecap="round" opacity={0.96} />
            <circle r={2.6} fill="white" opacity={0.95} />
          </g>
        </g>
        <rect className="fill-canvas stroke-ink2 [stroke-width:2.5]" ref={topLidRef} x={-10} y={-104} width={120} height={104} />
        <rect className="fill-canvas stroke-ink2 [stroke-width:2.5]" ref={botLidRef} x={-10} y={100} width={120} height={104} />
      </g>
      <circle className="fill-none stroke-ink2 [stroke-width:2.5]" cx={50} cy={50} r={EYE_R} />
    </svg>
  );
}

export function Logo({ size = 28, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <>
      <EyeMark size={size} />
      {showText && (
        <div className="whitespace-nowrap text-[15px] font-extrabold tracking-[.2px]">
          VIGIA<span className="text-accent"> AI</span>
        </div>
      )}
    </>
  );
}
