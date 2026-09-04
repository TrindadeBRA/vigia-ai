import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { cn } from "../cn";
import { Modal } from "../pages/config/ui";
import { buildPixPayload } from "../lib/pix";

const PIX_KEY = "pix@thetrinityweb.com.br";
const PIX_MERCHANT_NAME = "TrindadeBRA";
const PIX_MERCHANT_CITY = "SAO PAULO";

const AMOUNTS = [5, 10, 20, 50];

export function PixDonateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Modal title="Apoie o projeto via Pix" onClose={onClose} wide>
      <PixDonateContent />
    </Modal>
  );
}

function PixDonateContent() {
  const [amount, setAmount] = useState<number | null>(AMOUNTS[0]);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  const activeAmount = custom.trim() ? Number(custom.replace(",", ".")) || null : amount;

  const payload = useMemo(
    () => buildPixPayload({ key: PIX_KEY, name: PIX_MERCHANT_NAME, city: PIX_MERCHANT_CITY, amount: activeAmount }),
    [activeAmount],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 172,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(() => {});
  }, [payload]);

  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-5 -mt-4 flex items-center gap-4 border-b border-edge bg-gradient-to-br from-[#32BCAD]/14 via-transparent to-transparent px-5 py-4">
        <PixelHeart />
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink2">
          Este projeto é gratuito e mantido nas horas vagas. Se ele te ajuda no dia a dia, considere apoiar com um Pix
          — qualquer valor faz diferença. <span className="text-ink">💛</span>
        </p>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="text-[10.5px] font-bold uppercase tracking-[.6px] text-ink3">Valor da contribuição</span>
          <div className="flex flex-wrap items-center gap-2">
            {AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setCustom("");
                  setShowCustom(false);
                  setAmount((cur) => (cur === v ? null : v));
                }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-all duration-150",
                  amount === v && !custom
                    ? "border-accent bg-accent text-accent-ink shadow-btn"
                    : "border-edge bg-transparent text-ink2 hover:border-accent/40 hover:bg-chip",
                )}
              >
                R$ {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAmount(null);
                setShowCustom((s) => !s);
                requestAnimationFrame(() => customRef.current?.focus());
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-all duration-150",
                showCustom || custom
                  ? "border-accent bg-accent text-accent-ink shadow-btn"
                  : "border-dashed border-edge bg-transparent text-ink2 hover:border-accent/40 hover:bg-chip",
              )}
            >
              Outro
            </button>
          </div>

          {showCustom || custom ? (
            <label className="flex w-full max-w-[200px] animate-fade items-center gap-1 rounded-[10px] border border-edge bg-canvas px-3 py-2 focus-within:border-transparent focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
              <span className="text-[13px] font-bold text-ink3">R$</span>
              <input
                ref={customRef}
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9,.]/g, ""))}
                placeholder="0,00"
                inputMode="decimal"
                className="w-full min-w-0 bg-transparent text-[13px] text-ink placeholder:text-ink3 focus:outline-none"
              />
            </label>
          ) : null}

          <p className="mt-1 text-[11.5px] leading-relaxed text-ink3">
            O valor é só uma sugestão pré-preenchida no QR Code — você pode alterá-lo direto no app do seu banco antes
            de confirmar.
          </p>

          <p className="mt-auto pt-2 text-[11.5px] text-ink3">
            Chave Pix (e-mail): <span className="font-semibold text-ink2">{PIX_KEY}</span>
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col items-center gap-3 sm:w-[212px]">
          <div className="rounded-2xl border border-edge bg-white p-2.5 shadow-card">
            <canvas ref={canvasRef} width={172} height={172} className="block size-[172px]" />
          </div>
          <span className="text-[11px] text-ink3">Aponte a câmera do app do seu banco</span>
        </div>
      </div>
    </div>
  );
}

// Coração em pixel art puro, com uma leve batida (heartbeat).
const HEART_PATTERN = [
  "011000110",
  "111101111",
  "111111111",
  "111111111",
  "011111110",
  "001111100",
  "000111000",
  "000010000",
];

function PixelHeart() {
  const cols = HEART_PATTERN[0].length;
  return (
    <div className="flex size-[60px] shrink-0 animate-heartbeat items-center justify-center drop-shadow-[0_4px_14px_rgba(225,29,72,.45)]">
      <div
        className="grid size-full"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${HEART_PATTERN.length}, 1fr)` }}
      >
        {HEART_PATTERN.flatMap((row, y) =>
          row.split("").map((cell, x) => (
            <span
              key={`${x}-${y}`}
              style={{
                background: cell === "1" ? "#e11d48" : "transparent",
                boxShadow: cell === "1" ? "inset -1.5px -1.5px rgba(0,0,0,.3), inset 1.5px 1.5px rgba(255,255,255,.35)" : undefined,
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}
