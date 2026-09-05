import { cn } from "../../../cn";
import { PROVIDER_ICON } from "../../../theme";
import { iconChip, iconImg } from "../../../tw";

export function ProviderIcon({
  provider,
  size = "sm",
  className,
}: {
  provider: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const src = PROVIDER_ICON[provider];
  if (!src) return null;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-chip shadow-[inset_0_0_0_1px_var(--card-border)]",
        size === "lg" ? "size-[42px]" : iconChip,
        className,
      )}
      aria-hidden
    >
      <img
        className={cn("object-contain", size === "lg" ? "size-[26px]" : iconImg)}
        src={src}
        alt=""
        draggable={false}
      />
    </span>
  );
}
