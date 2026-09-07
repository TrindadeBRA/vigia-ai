import { useEffect, useRef } from "react";

export const BTN = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    L1: 4,
    R1: 5,
    L2: 6,
    R2: 7,
    SELECT: 8,
    START: 9,
    L3: 10,
    R3: 11,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15,
    HOME: 16,
} as const;

export const AXIS = {
    LEFT_X: 0,
    LEFT_Y: 1,
    RIGHT_X: 2,
    RIGHT_Y: 3,
} as const;

const DEADZONE = 0.35;
const TRIGGER_THRESHOLD = 0.5;
const REPEAT_INITIAL_MS = 220;
const REPEAT_MS = 110;
export const SCROLL_SCALE = 18;
export const ZOOM_STEP = 0.05;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.6;

function deadzone(v: number): number {
    return Math.abs(v) < DEADZONE ? 0 : v;
}

export type GamepadAction = {
    dpadUp: boolean;
    dpadDown: boolean;
    dpadLeft: boolean;
    dpadRight: boolean;
    leftUp: boolean;
    leftDown: boolean;
    leftLeft: boolean;
    leftRight: boolean;
    rightX: number;
    rightY: number;
    a: boolean;
    b: boolean;
    x: boolean;
    y: boolean;
    l1: boolean;
    r1: boolean;
    l2: boolean;
    r2: boolean;
    select: boolean;
    start: boolean;
    home: boolean;
    aJust: boolean;
    bJust: boolean;
    xJust: boolean;
    yJust: boolean;
    l1Just: boolean;
    r1Just: boolean;
    selectJust: boolean;
    startJust: boolean;
    homeJust: boolean;
    dpadUpJust: boolean;
    dpadDownJust: boolean;
    dpadLeftJust: boolean;
    dpadRightJust: boolean;
    l2Value: number;
    r2Value: number;
    comboStartSelect: boolean;
};

function getGamepad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p) return p;
    return null;
}

function isTypingTarget(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
}

export function useGamepad(opts: {
    enabled?: boolean;
    onAction?: (a: GamepadAction, pad: Gamepad | null) => void;
    onTick?: (a: GamepadAction, pad: Gamepad | null) => void;
}) {
    const { enabled = true, onAction, onTick } = opts;
    const onActionRef = useRef(onAction);
    const onTickRef = useRef(onTick);
    onActionRef.current = onAction;
    onTickRef.current = onTick;

    const prevButtonsRef = useRef<boolean[]>([]);
    const repeatRef = useRef<Record<string, number>>({});
    const rafRef = useRef<number | null>(null);
    const comboRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled) return;
        // listen for emulator active flag
        const onEmu = (e: Event) => {
            const detail = (e as CustomEvent).detail as { active?: boolean } | undefined;
            (window as unknown as Record<string, unknown>).__vigiaEmuActive = Boolean(detail?.active);
            const el = document.querySelector("[data-emulator-active]");
            if (detail?.active) {
                if (!el) {
                    const marker = document.createElement("div");
                    marker.setAttribute("data-emulator-active", "true");
                    marker.style.display = "none";
                    document.body.appendChild(marker);
                }
            } else {
                document.querySelectorAll("[data-emulator-active]").forEach((n) => n.remove());
            }
        };
        window.addEventListener("vigia:emulator-active", onEmu as EventListener);
        const loop = () => {
            rafRef.current = requestAnimationFrame(loop);
            // when emulator is active, don't handle dashboard navigation — let emulator consume gamepad
            if (isEmulatorActive()) return;
            const now = performance.now();
            const pad = getGamepad();
            if (!pad) return;

            const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);
            const btnVal = (i: number) => pad.buttons[i]?.value ?? 0;

            const l2Val = btnVal(BTN.L2);
            const r2Val = btnVal(BTN.R2);
            const l2 = l2Val > TRIGGER_THRESHOLD || btn(BTN.L2);
            const r2 = r2Val > TRIGGER_THRESHOLD || btn(BTN.R2);

            const rawLX = pad.axes[AXIS.LEFT_X] ?? 0;
            const rawLY = pad.axes[AXIS.LEFT_Y] ?? 0;
            const rawRX = pad.axes[AXIS.RIGHT_X] ?? 0;
            const rawRY = pad.axes[AXIS.RIGHT_Y] ?? 0;

            const lx = deadzone(rawLX);
            const ly = deadzone(rawLY);
            const rx = deadzone(rawRX);
            const ry = deadzone(rawRY);

            const dpadUp = btn(BTN.DPAD_UP) || ly < -0.5;
            const dpadDown = btn(BTN.DPAD_DOWN) || ly > 0.5;
            const dpadLeft = btn(BTN.DPAD_LEFT) || lx < -0.5;
            const dpadRight = btn(BTN.DPAD_RIGHT) || lx > 0.5;

            const leftUp = ly < -0.5;
            const leftDown = ly > 0.5;
            const leftLeft = lx < -0.5;
            const leftRight = lx > 0.5;

            const prev = prevButtonsRef.current;
            const just = (idx: number) => btn(idx) && !prev[idx];
            const justDir = (cur: boolean, key: string) => {
                if (!cur) {
                    repeatRef.current[key] = 0;
                    return false;
                }
                const last = repeatRef.current[key] || 0;
                if (last === 0) {
                    repeatRef.current[key] = now + REPEAT_INITIAL_MS;
                    return true;
                }
                if (now >= last) {
                    repeatRef.current[key] = now + REPEAT_MS;
                    return true;
                }
                return false;
            };

            const aJust = just(BTN.A);
            const bJust = just(BTN.B);
            const xJust = just(BTN.X);
            const yJust = just(BTN.Y);
            const l1Just = just(BTN.L1);
            const r1Just = just(BTN.R1);
            const selectJust = just(BTN.SELECT);
            const startJust = just(BTN.START);
            const homeJust = pad.buttons[BTN.HOME] ? just(BTN.HOME) : false;
            const dpadUpJust = justDir(dpadUp, "up");
            const dpadDownJust = justDir(dpadDown, "down");
            const dpadLeftJust = justDir(dpadLeft, "left");
            const dpadRightJust = justDir(dpadRight, "right");

            const selectPressed = btn(BTN.SELECT);
            const startPressed = btn(BTN.START);
            let comboStartSelect = false;
            if (selectPressed && startPressed) {
                if (now - comboRef.current > 800) {
                    comboStartSelect = true;
                    comboRef.current = now;
                }
            }

            const action: GamepadAction = {
                dpadUp,
                dpadDown,
                dpadLeft,
                dpadRight,
                leftUp,
                leftDown,
                leftLeft,
                leftRight,
                rightX: rx,
                rightY: ry,
                a: btn(BTN.A),
                b: btn(BTN.B),
                x: btn(BTN.X),
                y: btn(BTN.Y),
                l1: btn(BTN.L1),
                r1: btn(BTN.R1),
                l2,
                r2,
                select: selectPressed,
                start: startPressed,
                home: pad.buttons[BTN.HOME] ? btn(BTN.HOME) : false,
                aJust,
                bJust,
                xJust,
                yJust,
                l1Just,
                r1Just,
                selectJust,
                startJust,
                homeJust,
                dpadUpJust,
                dpadDownJust,
                dpadLeftJust,
                dpadRightJust,
                l2Value: l2Val,
                r2Value: r2Val,
                comboStartSelect,
            };

            prevButtonsRef.current = pad.buttons.map((b) => b.pressed);

            if (onTickRef.current) onTickRef.current(action, pad);

            if (
                aJust ||
                bJust ||
                xJust ||
                yJust ||
                l1Just ||
                r1Just ||
                selectJust ||
                startJust ||
                homeJust ||
                dpadUpJust ||
                dpadDownJust ||
                dpadLeftJust ||
                dpadRightJust ||
                comboStartSelect
            ) {
                if (onActionRef.current) onActionRef.current(action, pad);
            }
        };

        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            window.removeEventListener("vigia:emulator-active", onEmu as EventListener);
        };
    }, [enabled]);
}

export function gamepadScrollMain(rx: number, ry: number) {
    const main = document.querySelector("main");
    const target = main || document.scrollingElement || document.documentElement;
    if (!target) return;
    const dx = rx * SCROLL_SCALE;
    const dy = ry * SCROLL_SCALE;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return;
    if (target === document.scrollingElement || target === document.documentElement) {
        window.scrollBy(dx, dy);
    } else {
        (target as HTMLElement).scrollBy(dx, dy);
    }
}

let zoomLevel = 1;
export function gamepadZoom(delta: number) {
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel + delta));
    document.documentElement.style.setProperty("--gamepad-cards-zoom", String(zoomLevel));
    const target = document.querySelector<HTMLElement>("[data-gamepad-cards]");
    if (target) {
        // zoom só nos cards — não na página toda (header/sidebar/main)
        // usa transform scale para não afetar layout do header/sidebar
        target.style.transform = `scale(${zoomLevel})`;
        target.style.transformOrigin = "top center";
        // mantém zoom como fallback para browsers que suportam (reflow correto)
        (target.style as unknown as Record<string, string>).zoom = String(zoomLevel);
    }
}

export function gamepadResetZoom() {
    zoomLevel = 1;
    document.documentElement.style.removeProperty("--gamepad-cards-zoom");
    const target = document.querySelector<HTMLElement>("[data-gamepad-cards]");
    if (target) {
        target.style.removeProperty("transform");
        target.style.removeProperty("transform-origin");
        target.style.removeProperty("zoom");
    }
}

export function isEmulatorActive(): boolean {
    // EmulatorCard sets this via custom event; also check DOM
    const el = document.querySelector("[data-emulator-active='true']");
    if (el) return true;
    // fallback: check global flag via event detail cache
    return (window as unknown as { __vigiaEmuActive?: boolean }).__vigiaEmuActive ?? false;
}

export function isGamepadTypingActive(): boolean {
    return isTypingTarget(document.activeElement);
}

export function getFocusableElements(root: ParentNode = document): HTMLElement[] {
    const sel =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-gamepad-focusable]';
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(sel));
    return nodes.filter((el) => {
        if (el.closest("[aria-hidden='true']")) return false;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (el.hasAttribute("disabled")) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
    });
}

export function findNearestCard(
    cards: HTMLElement[],
    current: HTMLElement | null,
    dir: "up" | "down" | "left" | "right",
): HTMLElement | null {
    if (!cards.length) return null;
    if (!current) return cards[0] || null;
    const curRect = current.getBoundingClientRect();
    const curCenter = {
        x: curRect.left + curRect.width / 2,
        y: curRect.top + curRect.height / 2,
    };

    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    let bestPrimary = Infinity;

    for (const card of cards) {
        if (card === current) continue;
        const r = card.getBoundingClientRect();
        const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const dx = c.x - curCenter.x;
        const dy = c.y - curCenter.y;

        let inDir = false;
        let primary = 0;
        let secondary = 0;
        if (dir === "up") {
            inDir = dy < -8;
            primary = -dy;
            secondary = Math.abs(dx);
        } else if (dir === "down") {
            inDir = dy > 8;
            primary = dy;
            secondary = Math.abs(dx);
        } else if (dir === "left") {
            inDir = dx < -8;
            primary = -dx;
            secondary = Math.abs(dy);
        } else if (dir === "right") {
            inDir = dx > 8;
            primary = dx;
            secondary = Math.abs(dy);
        }
        if (!inDir) continue;
        const dist = primary + secondary * 0.35;
        if (dist < bestDist || (dist === bestDist && primary < bestPrimary)) {
            bestDist = dist;
            bestPrimary = primary;
            best = card;
        }
    }

    if (!best) {
        if (dir === "right" || dir === "down") {
            const idx = cards.indexOf(current);
            return cards[(idx + 1) % cards.length] || null;
        } else {
            const idx = cards.indexOf(current);
            return cards[(idx - 1 + cards.length) % cards.length] || null;
        }
    }
    return best;
}

export const GAMEPAD_CSS = `
  [data-gamepad-focused="true"] {
    outline: 2px solid var(--accent) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent), var(--shadow, 0 4px 12px rgba(0,0,0,.2)) !important;
    z-index: 2;
  }
  [data-gamepad-focused="true"] .group\\/tile {
    border-color: var(--accent) !important;
  }
  .gamepad-hint {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--card);
    border: 1px solid var(--card-border);
    color: var(--text);
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    z-index: 9999;
    opacity: 0.9;
    pointer-events: none;
  }
`;
