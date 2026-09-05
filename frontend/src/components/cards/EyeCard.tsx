import type { CardSize } from "../../board";
import { normalizeSize } from "../../board";
import type { T } from "../../i18n";
import { EyeMark } from "../Logo";

/** Widget do nosso olho/logo — não vem de conta/backend, é só visual. */
export function eyeAllowedSizes(): CardSize[] {
  return ["xs", "sm", "md", "lg", "free"];
}

export function eyeSizeLabel(size: CardSize, t: T): string {
  const s = normalizeSize(size);
  if (s === "xs") return t.widgetQuarter;
  if (s === "sm") return t.widgetSmall;
  if (s === "md") return t.cardNormal;
  if (s === "free") return t.cardFree;
  return t.cardLarge;
}

const EYE_PX: Record<string, number> = { xs: 22, sm: 40, md: 64, lg: 96 };

export function EyeBoardCard({ size }: { size: CardSize }) {
  const s = normalizeSize(size);
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center">
      <EyeMark size={EYE_PX[s] ?? 64} />
    </div>
  );
}
