import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config.js";

export type ImageFit = "cover" | "contain";
export type ImageTransform = { x: number; y: number; scale: number };

export type ImageWidget = {
    id: string;
    src: string;
    fit: ImageFit;
    label: string | null;
    countdownAt: string | null;
    countdownLabel: string | null;
    createdAt: string;
    transform: ImageTransform | null;
};

function imagesPath(): string {
    return join(dataDir(), "images.json");
}

function normalizeFit(v: unknown): ImageFit {
    return v === "contain" ? "contain" : "cover";
}

function normalizeTransform(v: unknown): ImageTransform | null {
    if (!v || typeof v !== "object") return null;
    const r = v as Record<string, unknown>;
    const x = Number(r.x);
    const y = Number(r.y);
    const scale = Number(r.scale);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return null;
    return { x, y, scale };
}

function normalizeCountdownAt(v: unknown): string | null {
    if (v == null || v === "") return null;
    const s = String(v).trim();
    if (!s) return null;
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return null;
    return new Date(ms).toISOString();
}

function normalizeOptionalLabel(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
}

export function loadImages(): ImageWidget[] {
    const p = imagesPath();
    if (!existsSync(p)) return [];
    try {
        const raw = JSON.parse(readFileSync(p, "utf-8")) as unknown;
        if (!Array.isArray(raw)) return [];
        return normalizeList(raw);
    } catch {
        return [];
    }
}

function normalizeList(arr: unknown[]): ImageWidget[] {
    const out: ImageWidget[] = [];
    for (const item of arr) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const r = item as Record<string, unknown>;
        const id = String(r.id ?? "").trim();
        const src = String(r.src ?? "");
        if (!id || !src) continue;
        out.push({
            id,
            src,
            fit: normalizeFit(r.fit),
            label: r.label != null ? String(r.label) : null,
            countdownAt: normalizeCountdownAt(r.countdownAt ?? r.countdown_at),
            countdownLabel: normalizeOptionalLabel(r.countdownLabel ?? r.countdown_label),
            createdAt: String(r.createdAt ?? r.created_at ?? new Date().toISOString()),
            transform: normalizeTransform(r.transform),
        });
    }
    return out;
}

export function saveImages(images: ImageWidget[]): void {
    const p = imagesPath();
    mkdirSync(dataDir(), { recursive: true });
    const tmp = p + ".tmp";
    writeFileSync(tmp, JSON.stringify(images, null, 2) + "\n", "utf-8");
    renameSync(tmp, p);
}

export function createImage(src: string, opts: { fit?: ImageFit; label?: string | null; countdownAt?: string | null; countdownLabel?: string | null } = {}): ImageWidget {
    const images = loadImages();
    const id = `img:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
    const image: ImageWidget = {
        id,
        src: String(src ?? "").trim(),
        fit: normalizeFit(opts.fit ?? "cover"),
        label: (opts.label ?? "").toString().trim() || null,
        countdownAt: normalizeCountdownAt(opts.countdownAt),
        countdownLabel: normalizeOptionalLabel(opts.countdownLabel),
        createdAt: new Date().toISOString(),
        transform: null,
    };
    images.push(image);
    saveImages(images);
    return image;
}

export function updateImage(id: string, patch: Partial<Pick<ImageWidget, "src" | "fit" | "label" | "countdownAt" | "countdownLabel" | "transform">>): ImageWidget | null {
    const images = loadImages();
    const idx = images.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    if (patch.src !== undefined) images[idx].src = String(patch.src).trim();
    if (patch.fit !== undefined) images[idx].fit = normalizeFit(patch.fit);
    if (patch.label !== undefined) images[idx].label = patch.label == null ? null : String(patch.label).trim() || null;
    if (patch.countdownAt !== undefined) images[idx].countdownAt = normalizeCountdownAt(patch.countdownAt);
    if (patch.countdownLabel !== undefined) images[idx].countdownLabel = normalizeOptionalLabel(patch.countdownLabel);
    if (patch.transform !== undefined) images[idx].transform = normalizeTransform(patch.transform);
    saveImages(images);
    return images[idx];
}

export function deleteImage(id: string): boolean {
    const images = loadImages();
    const next = images.filter((n) => n.id !== id);
    if (next.length === images.length) return false;
    saveImages(next);
    return true;
}
