import { useEffect, useRef, useState } from "react";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"] as const;
const STORAGE_KEY = "vigia-konami";
const CLASS = "konami-mode";

function isKonamiKey(key: string, expected: string): boolean {
    if (expected === "b" || expected === "a") return key.toLowerCase() === expected;
    return key === expected;
}

export function useKonamiCode() {
    const pos = useRef(0);
    const [active, setActive] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) === "1";
        if (stored) {
            document.documentElement.classList.add(CLASS);
            setActive(true);
        }

        function toggle(next: boolean) {
            setActive(next);
            if (next) {
                document.documentElement.classList.add(CLASS);
                localStorage.setItem(STORAGE_KEY, "1");
            } else {
                document.documentElement.classList.remove(CLASS);
                localStorage.removeItem(STORAGE_KEY);
            }
            // feedback visual discreto
            const msg = next ? "🎮 MODO RETRÔ ATIVADO — Press Start 2P!" : "↩︎ modo retrô desativado";
            // usa um toast nativo simples sem dependência
            let el = document.getElementById("konami-toast");
            if (!el) {
                el = document.createElement("div");
                el.id = "konami-toast";
                el.setAttribute("role", "status");
                el.setAttribute("aria-live", "polite");
                Object.assign(el.style, {
                    position: "fixed",
                    bottom: "24px",
                    left: "50%",
                    transform: "translateX(-50%) translateY(12px)",
                    background: "var(--card, #1c1c1c)",
                    color: "var(--text, #f5f5f5)",
                    border: "1px solid var(--card-border, #2e2e2e)",
                    padding: "10px 16px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontFamily: '"Press Start 2P", monospace',
                    boxShadow: "0 12px 26px -12px rgba(0,0,0,.55)",
                    zIndex: "9999",
                    opacity: "0",
                    transition: "opacity 220ms ease, transform 220ms ease",
                    pointerEvents: "none",
                    textAlign: "center",
                    maxWidth: "90vw",
                } as CSSStyleDeclaration);
                document.body.appendChild(el);
            }
            el.textContent = msg;
            // força reflow p/ animar
            void el.offsetWidth;
            el.style.opacity = "1";
            el.style.transform = "translateX(-50%) translateY(0)";
            window.setTimeout(() => {
                if (!el) return;
                el.style.opacity = "0";
                el.style.transform = "translateX(-50%) translateY(12px)";
            }, 2200);
        }

        function onKeyDown(e: KeyboardEvent) {
            // ignora se estiver digitando em campo de texto? Não — o easter egg deve funcionar em qualquer lugar,
            // mas evita disparar ao digitar "b" / "a" dentro de inputs se a sequência não começou com setas.
            // Então só processa normalmente; o reset inteligente já cuida disso.
            const key = e.key;
            const expected = KONAMI[pos.current];

            if (isKonamiKey(key, expected)) {
                pos.current += 1;
                if (pos.current === KONAMI.length) {
                    pos.current = 0;
                    // Enter opcional logo após o código não quebra — se o usuário apertar Enter em seguida,
                    // ainda consideramos como parte do mesmo gesto, mas já alternamos aqui.
                    toggle(!document.documentElement.classList.contains(CLASS));
                }
                return;
            }

            // Tecla errada: tenta reaproveitar como início da sequência (ex.: ArrowUp)
            if (isKonamiKey(key, KONAMI[0])) {
                pos.current = 1;
            } else {
                pos.current = 0;
            }

            // Suporte ao Enter opcional no final: se já completou B A e o usuário aperta Enter,
            // não faz nada extra (já alternou). Apenas reseta.
            if (key === "Enter" && pos.current === 0) {
                // nada
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return active;
}
