import { useState } from "react";
import { getRetroarchIconUrl, type RetroarchTheme } from "../lib/retroarchIcons";

type Props = {
    platform: string;
    theme?: RetroarchTheme;
    size?: number;
    className?: string;
    fallback?: string;
    alt?: string;
    style?: React.CSSProperties;
    wrapperClassName?: string;
    wrapperStyle?: React.CSSProperties;
};

/**
 * Ícone RetroArch XMB via CDN (jsDelivr) com fallback para emoji 🎮.
 * Não baixa nada para o projeto — usa link direto.
 * Quando o download falhar (onError), mostra o emoji.
 */
export function RetroarchIcon({
    platform,
    theme = "monochrome",
    size = 32,
    className,
    fallback = "🎮",
    alt,
    style,
    wrapperClassName,
    wrapperStyle,
}: Props) {
    const [failed, setFailed] = useState(false);
    const url = getRetroarchIconUrl(platform, theme);
    const isMonochrome = theme === "monochrome";

    // se não há mapeamento ou falhou, mostra emoji
    if (!url || failed) {
        return (
            <span
                className={wrapperClassName}
                style={{ fontSize: size * 0.65, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, ...wrapperStyle }}
                aria-hidden={alt ? undefined : true}
                aria-label={alt}
                title={alt}
            >
                {fallback}
            </span>
        );
    }

    return (
        <img
            src={url}
            alt={alt ?? platform}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            className={["ra-icon", isMonochrome ? "ra-mono" : "", className ?? ""].filter(Boolean).join(" ")}
            style={{ width: size, height: size, objectFit: "contain", imageRendering: "auto", ...style }}
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
        />
    );
}

/**
 * Wrapper com fundo arredondado — usado nos cards/headers onde antes havia o emoji em um quadrado colorido.
 * Mantém o mesmo visual mas com o ícone por cima.
 */
export function RetroarchIconBadge({
    platform,
    theme = "monochrome",
    size = 36,
    bg,
    fallback = "🎮",
    alt,
}: {
    platform: string;
    theme?: RetroarchTheme;
    size?: number;
    bg?: string;
    fallback?: string;
    alt?: string;
}) {
    const [failed, setFailed] = useState(false);
    const url = getRetroarchIconUrl(platform, theme);

    // Cores do badge vivem em index.css (.ra-badge-mono / .ra-badge-color) para
    // reagirem ao modo claro via [data-vigia-theme]; `bg` continua vencendo como override.
    const isMonochrome = theme === "monochrome";
    const badgeTone = isMonochrome ? "ra-badge-mono" : "ra-badge-color";
    const badgeStyle: React.CSSProperties | undefined = bg ? { background: bg } : undefined;

    if (!url || failed) {
        return (
            <span
                className={`flex items-center justify-center rounded-xl text-[18px] leading-none shrink-0 ${badgeTone}`}
                style={{ width: size, height: size, ...badgeStyle }}
                aria-label={alt}
                title={alt}
            >
                {fallback}
            </span>
        );
    }

    return (
        <span
            className={`flex items-center justify-center rounded-xl shrink-0 overflow-hidden p-1 ${badgeTone}`}
            style={{ width: size, height: size, ...badgeStyle }}
            title={alt}
            aria-label={alt}
        >
            <img
                src={url}
                alt={alt ?? platform}
                width={size - 8}
                height={size - 8}
                loading="lazy"
                decoding="async"
                className={isMonochrome ? "ra-icon ra-mono" : "ra-icon"}
                style={{
                    width: size - 8,
                    height: size - 8,
                    objectFit: "contain",
                }}
                onError={() => setFailed(true)}
                referrerPolicy="no-referrer"
            />
        </span>
    );
}
