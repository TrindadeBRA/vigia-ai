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
            className={className}
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

    // monochrome é branco — precisa de fundo escuro ou filtro
    const isMonochrome = theme === "monochrome";
    const badgeStyle: React.CSSProperties = bg
        ? { background: bg }
        : isMonochrome
            ? { background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)" }
            : { background: "rgba(255,255,255,0.92)", border: "1px solid var(--card-border)" };

    if (!url || failed) {
        return (
            <span
                className="flex items-center justify-center rounded-xl text-[18px] leading-none shrink-0"
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
            className="flex items-center justify-center rounded-xl shrink-0 overflow-hidden p-1"
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
                style={{
                    width: size - 8,
                    height: size - 8,
                    objectFit: "contain",
                    // monochrome já é branco, não precisa inverter; flatux/daite são coloridos
                    filter: isMonochrome ? "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" : undefined,
                }}
                onError={() => setFailed(true)}
                referrerPolicy="no-referrer"
            />
        </span>
    );
}
