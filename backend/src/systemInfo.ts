import { execSync } from "node:child_process";
import os from "node:os";

export type DiskInfo = {
    name: string;
    mount: string;
    filesystem: string;
    label: string;
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    total_gb: number;
    free_gb: number;
    used_gb: number;
    use_percent: number;
};

export type SystemDetails = {
    hostname: string;
    platform: string;
    arch: string;
    release: string;
    cpu_model: string;
    cpu_cores: number;
    total_mem_mb: number;
    free_mem_mb: number;
    used_mem_mb: number;
    mem_percent: number;
    uptime_s: number;
    load1: number;
    load5: number;
    load15: number;
};

function bytesToGb(bytes: number): number {
    return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

function parseDfOutput(output: string): DiskInfo[] {
    const lines = output.trim().split("\n");
    if (lines.length < 2) return [];
    // header: Filesystem 1024-blocks Used Available Capacity Mounted on
    // or: Filesystem     1024-blocks      Used Available Capacity Mounted on
    const disks: DiskInfo[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // df -kP guarantees 6 columns, mount may contain spaces but -P avoids
        const parts = line.split(/\s+/);
        if (parts.length < 6) continue;
        const filesystem = parts[0];
        const blocks = Number(parts[1]);
        const used = Number(parts[2]);
        const available = Number(parts[3]);
        const capacity = parts[4]; // e.g. "42%"
        const mount = parts.slice(5).join(" ");

        // skip pseudo filesystems
        if (
            filesystem.startsWith("tmpfs") ||
            filesystem.startsWith("devtmpfs") ||
            filesystem.startsWith("udev") ||
            filesystem === "none" ||
            filesystem.startsWith("overlay") && mount !== "/" ||
            mount.startsWith("/dev") && !mount.startsWith("/dev/disk") ||
            mount.startsWith("/sys") ||
            mount.startsWith("/proc") ||
            mount.startsWith("/run")
        ) {
            // keep root overlay and main mounts, skip noise
            if (mount !== "/" && !mount.startsWith("/mnt") && !mount.startsWith("/media") && !mount.startsWith("/host") && !mount.startsWith("/data")) {
                // allow / and /host etc, but skip pure virtual
                if (filesystem === "tmpfs" || filesystem === "devtmpfs" || mount.startsWith("/sys") || mount.startsWith("/proc")) continue;
            }
        }

        if (!Number.isFinite(blocks) || blocks <= 0) continue;
        const totalBytes = blocks * 1024;
        const freeBytes = available * 1024;
        const usedBytes = used * 1024;
        const usePercent = capacity ? Number(capacity.replace("%", "")) : Math.round((usedBytes / totalBytes) * 100);

        // derive friendly name: use mount or filesystem basename
        let name = mount;
        if (mount === "/") name = filesystem.includes("/") ? filesystem.split("/").pop() || "/" : "/";
        // try to get volume label via filesystem name
        const label = filesystem;

        disks.push({
            name: name || filesystem,
            mount,
            filesystem,
            label,
            total_bytes: totalBytes,
            free_bytes: freeBytes,
            used_bytes: usedBytes,
            total_gb: bytesToGb(totalBytes),
            free_gb: bytesToGb(freeBytes),
            used_gb: bytesToGb(usedBytes),
            use_percent: Number.isFinite(usePercent) ? usePercent : 0,
        });
    }
    // deduplicate by filesystem device — same device mounted at /, /home, /var/log etc should appear once
    const byFs = new Map<string, DiskInfo>();
    for (const d of disks) {
        const existing = byFs.get(d.filesystem);
        if (!existing) {
            byFs.set(d.filesystem, d);
            continue;
        }
        // prefer the shortest mount (usually "/" for root) and keep largest total if tie
        const preferCurrent = d.mount.length < existing.mount.length || (d.mount === "/" && existing.mount !== "/");
        if (preferCurrent) byFs.set(d.filesystem, d);
        else if (d.total_bytes > existing.total_bytes && existing.mount !== "/") byFs.set(d.filesystem, d);
    }
    // also deduplicate by mount in case different fs strings point to same mount (bind mounts)
    const byMount = new Map<string, DiskInfo>();
    for (const d of byFs.values()) {
        const existing = byMount.get(d.mount);
        if (!existing || d.total_bytes > existing.total_bytes) byMount.set(d.mount, d);
    }
    return [...byMount.values()].sort((a, b) => b.total_bytes - a.total_bytes);
}

function getStoragePosix(): DiskInfo[] {
    try {
        // -k = 1024 blocks, -P = POSIX portable (one line per fs)
        const out = execSync("df -kP 2>/dev/null", { encoding: "utf8", timeout: 3000 });
        const parsed = parseDfOutput(out);
        if (parsed.length > 0) return parsed;
    } catch { }
    try {
        const out = execSync("df -k 2>/dev/null", { encoding: "utf8", timeout: 3000 });
        return parseDfOutput(out);
    } catch {
        return [];
    }
}

function getStorageWindows(): DiskInfo[] {
    try {
        const out = execSync(
            'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,Size,FreeSpace,FileSystem | ConvertTo-Json -Compress"',
            { encoding: "utf8", timeout: 5000 },
        );
        const trimmed = out.trim();
        if (!trimmed) return [];
        const data = JSON.parse(trimmed);
        const arr = Array.isArray(data) ? data : [data];
        const disks: DiskInfo[] = [];
        for (const d of arr) {
            const size = Number(d.Size);
            const free = Number(d.FreeSpace);
            if (!Number.isFinite(size) || size <= 0) continue;
            const used = size - free;
            const name = d.VolumeName ? `${d.DeviceID} (${d.VolumeName})` : String(d.DeviceID);
            disks.push({
                name,
                mount: String(d.DeviceID),
                filesystem: String(d.FileSystem || "NTFS"),
                label: String(d.VolumeName || d.DeviceID),
                total_bytes: size,
                free_bytes: free,
                used_bytes: used,
                total_gb: bytesToGb(size),
                free_gb: bytesToGb(free),
                used_gb: bytesToGb(used),
                use_percent: Math.round((used / size) * 100),
            });
        }
        return disks.sort((a, b) => b.total_bytes - a.total_bytes);
    } catch { }
    // fallback wmic
    try {
        const out = execSync("wmic logicaldisk get size,freespace,caption,volumename,filesystem /format:csv 2>nul", {
            encoding: "utf8",
            timeout: 5000,
        });
        const lines = out.trim().split("\n").filter((l) => l.trim() && !l.startsWith("Node"));
        const disks: DiskInfo[] = [];
        for (const line of lines) {
            const parts = line.split(",");
            // Node,Caption,FileSystem,FreeSpace,Size,VolumeName
            if (parts.length < 6) continue;
            const caption = parts[1]?.trim();
            const fs = parts[2]?.trim();
            const free = Number(parts[3]?.trim());
            const size = Number(parts[4]?.trim());
            const vol = parts[5]?.trim();
            if (!caption || !Number.isFinite(size) || size <= 0) continue;
            const used = size - (Number.isFinite(free) ? free : 0);
            disks.push({
                name: vol ? `${caption} (${vol})` : caption,
                mount: caption,
                filesystem: fs || "NTFS",
                label: vol || caption,
                total_bytes: size,
                free_bytes: Number.isFinite(free) ? free : 0,
                used_bytes: used,
                total_gb: bytesToGb(size),
                free_gb: bytesToGb(Number.isFinite(free) ? free : 0),
                used_gb: bytesToGb(used),
                use_percent: Math.round((used / size) * 100),
            });
        }
        return disks;
    } catch {
        return [];
    }
}

export function getStorageInfo(): DiskInfo[] {
    const platform = os.platform();
    if (platform === "win32") {
        const win = getStorageWindows();
        if (win.length > 0) return win;
    }
    const posix = getStoragePosix();
    if (posix.length > 0) return posix;
    // fallback: at least report root via os
    return [];
}

export function getSystemDetails(): SystemDetails {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const load = os.loadavg();
    return {
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.arch()}`,
        arch: os.arch(),
        release: os.release(),
        cpu_model: cpus[0]?.model?.trim() || "Unknown",
        cpu_cores: cpus.length,
        total_mem_mb: Math.round(totalMem / 1024 / 1024),
        free_mem_mb: Math.round(freeMem / 1024 / 1024),
        used_mem_mb: Math.round(usedMem / 1024 / 1024),
        mem_percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
        uptime_s: Math.round(os.uptime()),
        load1: load[0],
        load5: load[1],
        load15: load[2],
    };
}
