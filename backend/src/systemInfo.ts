import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

export type NetworkInfo = {
    name: string;
    type: "wired" | "wifi" | "virtual" | "unknown";
    speed_mbps: number | null;
    rx_bytes: number;
    tx_bytes: number;
    rx_rate_bps: number | null;
    tx_rate_bps: number | null;
    ip: string | null;
    mac: string | null;
    is_up: boolean;
};

export type ThermalSensor = {
    label: string;
    value_c: number;
    type: "cpu" | "gpu" | "other";
    critical_c?: number | null;
};

export type FanInfo = {
    label: string;
    rpm: number;
};

export type BatteryInfo = {
    percent: number;
    is_charging: boolean;
    is_present: boolean;
    time_remaining_min?: number | null;
    health_percent?: number | null;
    model?: string | null;
    status?: string | null;
};

function bytesToGb(bytes: number): number {
    return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

function safeExec(cmd: string, timeout = 3000): string | null {
    try {
        return execSync(cmd, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { return null; }
}

function readFileSafe(p: string): string | null {
    try { return fs.readFileSync(p, "utf8").trim(); } catch { return null; }
}

function parseDfOutput(output: string): DiskInfo[] {
    const lines = output.trim().split("\n");
    if (lines.length < 2) return [];
    const disks: DiskInfo[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/\s+/);
        if (parts.length < 6) continue;
        const filesystem = parts[0];
        const blocks = Number(parts[1]);
        const used = Number(parts[2]);
        const available = Number(parts[3]);
        const capacity = parts[4];
        const mount = parts.slice(5).join(" ");
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
            if (mount !== "/" && !mount.startsWith("/mnt") && !mount.startsWith("/media") && !mount.startsWith("/host") && !mount.startsWith("/data")) {
                if (filesystem === "tmpfs" || filesystem === "devtmpfs" || mount.startsWith("/sys") || mount.startsWith("/proc")) continue;
            }
        }
        if (!Number.isFinite(blocks) || blocks <= 0) continue;
        const totalBytes = blocks * 1024;
        const freeBytes = available * 1024;
        const usedBytes = used * 1024;
        const usePercent = capacity ? Number(capacity.replace("%", "")) : Math.round((usedBytes / totalBytes) * 100);
        let name = mount;
        if (mount === "/") name = filesystem.includes("/") ? filesystem.split("/").pop() || "/" : "/";
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
    const byFs = new Map<string, DiskInfo>();
    for (const d of disks) {
        const existing = byFs.get(d.filesystem);
        if (!existing) { byFs.set(d.filesystem, d); continue; }
        const preferCurrent = d.mount.length < existing.mount.length || (d.mount === "/" && existing.mount !== "/");
        if (preferCurrent) byFs.set(d.filesystem, d);
        else if (d.total_bytes > existing.total_bytes && existing.mount !== "/") byFs.set(d.filesystem, d);
    }
    const byMount = new Map<string, DiskInfo>();
    for (const d of byFs.values()) {
        const existing = byMount.get(d.mount);
        if (!existing || d.total_bytes > existing.total_bytes) byMount.set(d.mount, d);
    }
    return [...byMount.values()].sort((a, b) => b.total_bytes - a.total_bytes);
}

function getStoragePosix(): DiskInfo[] {
    try {
        const out = execSync("df -kP 2>/dev/null", { encoding: "utf8", timeout: 3000 });
        const parsed = parseDfOutput(out);
        if (parsed.length > 0) return parsed;
    } catch { }
    try {
        const out = execSync("df -k 2>/dev/null", { encoding: "utf8", timeout: 3000 });
        return parseDfOutput(out);
    } catch { return []; }
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
                name, mount: String(d.DeviceID), filesystem: String(d.FileSystem || "NTFS"), label: String(d.VolumeName || d.DeviceID),
                total_bytes: size, free_bytes: free, used_bytes: used,
                total_gb: bytesToGb(size), free_gb: bytesToGb(free), used_gb: bytesToGb(used),
                use_percent: Math.round((used / size) * 100),
            });
        }
        return disks.sort((a, b) => b.total_bytes - a.total_bytes);
    } catch { }
    try {
        const out = execSync("wmic logicaldisk get size,freespace,caption,volumename,filesystem /format:csv 2>nul", { encoding: "utf8", timeout: 5000 });
        const lines = out.trim().split("\n").filter((l) => l.trim() && !l.startsWith("Node"));
        const disks: DiskInfo[] = [];
        for (const line of lines) {
            const parts = line.split(",");
            if (parts.length < 6) continue;
            const caption = parts[1]?.trim();
            const fs2 = parts[2]?.trim();
            const free = Number(parts[3]?.trim());
            const size = Number(parts[4]?.trim());
            const vol = parts[5]?.trim();
            if (!caption || !Number.isFinite(size) || size <= 0) continue;
            const used = size - (Number.isFinite(free) ? free : 0);
            disks.push({
                name: vol ? `${caption} (${vol})` : caption, mount: caption, filesystem: fs2 || "NTFS", label: vol || caption,
                total_bytes: size, free_bytes: Number.isFinite(free) ? free : 0, used_bytes: used,
                total_gb: bytesToGb(size), free_gb: bytesToGb(Number.isFinite(free) ? free : 0), used_gb: bytesToGb(used),
                use_percent: Math.round((used / size) * 100),
            });
        }
        return disks;
    } catch { return []; }
}

export function getStorageInfo(): DiskInfo[] {
    const platform = os.platform();
    if (platform === "win32") {
        const win = getStorageWindows();
        if (win.length > 0) return win;
    }
    const posix = getStoragePosix();
    if (posix.length > 0) return posix;
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

// ── Network ──────────────────────────────────────────────────────────
const netPrev = new Map<string, { rx: number; tx: number; t: number }>();

function getIfaceType(name: string): NetworkInfo["type"] {
    const n = name.toLowerCase();
    if (n === "lo" || n.startsWith("docker") || n.startsWith("br-") || n.startsWith("veth") || n.startsWith("virbr") || n.startsWith("tun") || n.startsWith("tap")) return "virtual";
    // check wireless existence
    try {
        if (fs.existsSync(`/sys/class/net/${name}/wireless`) || fs.existsSync(`/sys/class/net/${name}/phy80211`)) return "wifi";
    } catch {}
    if (n.startsWith("wl") || n.startsWith("wlan") || n.startsWith("wifi")) return "wifi";
    if (n.startsWith("eth") || n.startsWith("en") || n.startsWith("eno") || n.startsWith("ens") || n.startsWith("enp")) return "wired";
    return "unknown";
}

function getIfaceSpeed(name: string): number | null {
    const raw = readFileSafe(`/sys/class/net/${name}/speed`);
    if (raw != null) {
        const v = Number(raw);
        if (Number.isFinite(v) && v > 0 && v < 100000) return v;
    }
    return null;
}

function getIfaceBytes(name: string): { rx: number; tx: number } {
    const rxRaw = readFileSafe(`/sys/class/net/${name}/statistics/rx_bytes`);
    const txRaw = readFileSafe(`/sys/class/net/${name}/statistics/tx_bytes`);
    return { rx: rxRaw ? Number(rxRaw) || 0 : 0, tx: txRaw ? Number(txRaw) || 0 : 0 };
}

function getIfaceOperState(name: string): boolean {
    const s = readFileSafe(`/sys/class/net/${name}/operstate`);
    if (s) return s === "up" || s === "unknown" || s === "dormant";
    const carrier = readFileSafe(`/sys/class/net/${name}/carrier`);
    if (carrier) return carrier === "1";
    return true;
}

export function getNetworkInfo(): NetworkInfo[] {
    const platform = os.platform();
    const ifaces = os.networkInterfaces();
    const now = Date.now();

    // Windows: try powershell for richer data
    if (platform === "win32") {
        try {
            const out = safeExec('powershell -NoProfile -Command "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object Name,MediaType,LinkSpeed,MacAddress,Status | ConvertTo-Json -Compress"', 4000);
            if (out) {
                const data = JSON.parse(out);
                const arr = Array.isArray(data) ? data : [data];
                const result: NetworkInfo[] = [];
                for (const a of arr) {
                    const name: string = String(a.Name || "unknown");
                    const media: string = String(a.MediaType || "").toLowerCase();
                    const type: NetworkInfo["type"] = media.includes("802.11") || media.includes("wireless") || media.includes("wifi") ? "wifi" : media.includes("ethernet") ? "wired" : getIfaceType(name);
                    let speed: number | null = null;
                    if (a.LinkSpeed) {
                        const m = String(a.LinkSpeed).match(/([\d.,]+)\s*([GMK]?bps)/i);
                        if (m) {
                            let v = Number(m[1].replace(",", "."));
                            const unit = m[2].toLowerCase();
                            if (unit.startsWith("g")) v *= 1000;
                            else if (unit.startsWith("k")) v /= 1000;
                            if (Number.isFinite(v)) speed = Math.round(v);
                        }
                    }
                    const addrs = ifaces[name] || ifaces[Object.keys(ifaces).find(k => k.toLowerCase() === name.toLowerCase()) || ""] || [];
                    const ipv4 = addrs.find(x => x.family === "IPv4" && !x.internal)?.address || null;
                    const mac = a.MacAddress ? String(a.MacAddress).replace(/-/g, ":") : (addrs[0]?.mac || null);
                    result.push({ name, type, speed_mbps: speed, rx_bytes: 0, tx_bytes: 0, rx_rate_bps: null, tx_rate_bps: null, ip: ipv4, mac, is_up: String(a.Status).toLowerCase() === "up" });
                }
                if (result.length > 0) return result;
            }
        } catch {}
    }

    // POSIX / fallback: use os.networkInterfaces + /sys
    const result: NetworkInfo[] = [];
    const seen = new Set<string>();
    // enumerate from /sys/class/net for completeness (includes down interfaces)
    let sysIfaces: string[] = [];
    try { sysIfaces = fs.readdirSync("/sys/class/net"); } catch { sysIfaces = Object.keys(ifaces); }
    const allNames = new Set([...sysIfaces, ...Object.keys(ifaces)]);
    for (const name of allNames) {
        if (seen.has(name)) continue;
        seen.add(name);
        const type = getIfaceType(name);
        // skip loopback unless it's the only one
        if (name === "lo" && allNames.size > 1) continue;
        // skip virtual unless it has an IP
        const addrs = ifaces[name] || [];
        const hasIp = addrs.some(a => !a.internal);
        if (type === "virtual" && !hasIp) continue;

        const isUp = getIfaceOperState(name);
        const speed = getIfaceSpeed(name);
        const { rx, tx } = getIfaceBytes(name);
        const ipv4 = addrs.find(a => a.family === "IPv4" && !a.internal)?.address || addrs.find(a => a.family === "IPv4")?.address || null;
        const mac = addrs[0]?.mac && addrs[0].mac !== "00:00:00:00:00:00" ? addrs[0].mac : readFileSafe(`/sys/class/net/${name}/address`) || null;

        // rate calc
        let rxRate: number | null = null;
        let txRate: number | null = null;
        const prev = netPrev.get(name);
        if (prev && rx >= prev.rx && tx >= prev.tx) {
            const dt = (now - prev.t) / 1000;
            if (dt > 0.5 && dt < 120) {
                rxRate = Math.round(((rx - prev.rx) * 8) / dt);
                txRate = Math.round(((tx - prev.tx) * 8) / dt);
            }
        }
        netPrev.set(name, { rx, tx, t: now });

        // only include if has IP or is up with speed, or is wifi/wired
        if (!hasIp && !isUp && speed == null && type === "unknown") continue;
        // filter out interfaces with no traffic and no IP and down
        if (!hasIp && rx === 0 && tx === 0 && !isUp) continue;

        result.push({ name, type, speed_mbps: speed, rx_bytes: rx, tx_bytes: tx, rx_rate_bps: rxRate, tx_rate_bps: txRate, ip: ipv4, mac, is_up: isUp });
    }

    // fallback: if nothing, use os.networkInterfaces directly
    if (result.length === 0) {
        for (const [name, addrs] of Object.entries(ifaces)) {
            if (!addrs || addrs.length === 0) continue;
            const ipv4 = addrs.find(a => a.family === "IPv4" && !a.internal)?.address || null;
            if (!ipv4) continue;
            result.push({ name, type: getIfaceType(name), speed_mbps: null, rx_bytes: 0, tx_bytes: 0, rx_rate_bps: null, tx_rate_bps: null, ip: ipv4, mac: addrs[0]?.mac || null, is_up: true });
        }
    }

    // sort: wifi/wired first, then by name
    const order = { wired: 0, wifi: 1, unknown: 2, virtual: 3 } as const;
    result.sort((a, b) => (order[a.type] - order[b.type]) || a.name.localeCompare(b.name));
    return result;
}

// ── Thermal / Fans ─────────────────────────────────────────────────
function parseSensorsOutput(out: string): { temps: ThermalSensor[]; fans: FanInfo[] } {
    const temps: ThermalSensor[] = [];
    const fans: FanInfo[] = [];
    const lines = out.split("\n");
    let currentChip = "";
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (!line.includes(":") && !line.startsWith(" ")) {
            currentChip = line.replace(":", "").trim();
            continue;
        }
        // temp: "Tctl: +45.0°C" or "Core 0: +42.0°C  (high = +80.0°C, crit = +100.0°C)"
        const tempMatch = line.match(/^(.+?):\s*\+?([\d.]+)\s*°C/i);
        if (tempMatch) {
            const labelRaw = tempMatch[1].trim();
            const val = Number(tempMatch[2]);
            if (!Number.isFinite(val)) continue;
            // skip fan labels that look like temp
            if (labelRaw.toLowerCase().includes("fan")) {
                // actually fan line with °C is not fan
            }
            const critMatch = line.match(/crit\s*=\s*\+?([\d.]+)\s*°C/i);
            const crit = critMatch ? Number(critMatch[1]) : null;
            const lower = (currentChip + " " + labelRaw).toLowerCase();
            let type: ThermalSensor["type"] = "other";
            if (lower.includes("gpu") || lower.includes("nvidia") || lower.includes("amdgpu") || lower.includes("radeon")) type = "gpu";
            else if (lower.includes("cpu") || lower.includes("core") || lower.includes("tctl") || lower.includes("tdie") || lower.includes("package") || lower.includes("k10temp") || lower.includes("coretemp")) type = "cpu";
            const label = currentChip ? `${currentChip} ${labelRaw}` : labelRaw;
            // deduplicate: keep highest per label prefix
            temps.push({ label: label.slice(0, 48), value_c: Math.round(val * 10) / 10, type, critical_c: crit });
            continue;
        }
        const fanMatch = line.match(/^(fan\d*|.*fan.*?):\s*([\d]+)\s*RPM/i);
        if (fanMatch) {
            const rpm = Number(fanMatch[2]);
            if (Number.isFinite(rpm) && rpm >= 0) {
                const label = fanMatch[1].trim().slice(0, 32);
                fans.push({ label: currentChip ? `${currentChip} ${label}`.slice(0, 40) : label, rpm });
            }
        }
    }
    return { temps, fans };
}

function getThermalFromSys(): { temps: ThermalSensor[]; fans: FanInfo[] } {
    const temps: ThermalSensor[] = [];
    const fans: FanInfo[] = [];
    // hwmon
    try {
        const hwmons = fs.readdirSync("/sys/class/hwmon");
        for (const hw of hwmons) {
            const base = `/sys/class/hwmon/${hw}`;
            const name = readFileSafe(path.join(base, "name")) || hw;
            const lowerName = name.toLowerCase();
            let type: ThermalSensor["type"] = "other";
            if (lowerName.includes("gpu") || lowerName.includes("nvidia") || lowerName.includes("amdgpu") || lowerName.includes("radeon") || lowerName.includes("nouveau")) type = "gpu";
            else if (lowerName.includes("cpu") || lowerName.includes("k10temp") || lowerName.includes("coretemp") || lowerName.includes("zenpower") || lowerName.includes("acpitz")) type = "cpu";
            // temps
            let idx = 1;
            while (idx <= 10) {
                const tempPath = path.join(base, `temp${idx}_input`);
                if (!fs.existsSync(tempPath)) { idx++; continue; }
                const raw = readFileSafe(tempPath);
                const label = readFileSafe(path.join(base, `temp${idx}_label`)) || `temp${idx}`;
                const critRaw = readFileSafe(path.join(base, `temp${idx}_crit`));
                if (raw) {
                    const v = Number(raw);
                    if (Number.isFinite(v)) {
                        const c = v > 1000 ? v / 1000 : v; // millidegree
                        if (c > -40 && c < 150) {
                            temps.push({ label: `${name} ${label}`.slice(0, 48), value_c: Math.round(c * 10) / 10, type, critical_c: critRaw ? Math.round((Number(critRaw) / 1000) * 10) / 10 : null });
                        }
                    }
                }
                // fans
                const fanPath = path.join(base, `fan${idx}_input`);
                if (fs.existsSync(fanPath)) {
                    const fr = readFileSafe(fanPath);
                    if (fr) {
                        const rpm = Number(fr);
                        if (Number.isFinite(rpm) && rpm >= 0) fans.push({ label: `${name} fan${idx}`.slice(0, 40), rpm });
                    }
                }
                idx++;
                if (idx > 10) break;
            }
            // also check fan without temp index
            for (let f = 1; f <= 6; f++) {
                const fp = path.join(base, `fan${f}_input`);
                if (!fs.existsSync(fp)) continue;
                if (fans.some(x => x.label === `${name} fan${f}`)) continue;
                const fr = readFileSafe(fp);
                if (fr) {
                    const rpm = Number(fr);
                    if (Number.isFinite(rpm) && rpm >= 0) fans.push({ label: `${name} fan${f}`.slice(0, 40), rpm });
                }
            }
        }
    } catch {}
    // thermal_zone
    try {
        const zones = fs.readdirSync("/sys/class/thermal");
        for (const z of zones) {
            if (!z.startsWith("thermal_zone")) continue;
            const base = `/sys/class/thermal/${z}`;
            const typeRaw = readFileSafe(path.join(base, "type")) || z;
            const tempRaw = readFileSafe(path.join(base, "temp"));
            if (!tempRaw) continue;
            const v = Number(tempRaw);
            if (!Number.isFinite(v)) continue;
            const c = v > 1000 ? v / 1000 : v;
            if (c <= -40 || c >= 150) continue;
            const lower = typeRaw.toLowerCase();
            // skip already covered by hwmon with same value
            if (temps.some(t => Math.abs(t.value_c - c) < 0.5 && t.label.toLowerCase().includes(lower.slice(0, 4)))) continue;
            let ttype: ThermalSensor["type"] = "other";
            if (lower.includes("gpu")) ttype = "gpu";
            else if (lower.includes("cpu") || lower.includes("x86_pkg_temp") || lower.includes("acpitz")) ttype = "cpu";
            temps.push({ label: typeRaw.slice(0, 48), value_c: Math.round(c * 10) / 10, type: ttype });
        }
    } catch {}
    return { temps, fans };
}

export function getThermalSensors(): ThermalSensor[] {
    const platform = os.platform();
    if (platform === "win32") {
        // Try WMI thermal zone (decikelvin)
        const out = safeExec('powershell -NoProfile -Command "Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object CurrentTemperature,CriticalTripPoint | ConvertTo-Json -Compress"', 4000);
        if (out) {
            try {
                const data = JSON.parse(out);
                const arr = Array.isArray(data) ? data : [data];
                const res: ThermalSensor[] = [];
                for (const d of arr) {
                    const cur = Number(d.CurrentTemperature);
                    if (!Number.isFinite(cur)) continue;
                    const c = cur / 10 - 273.15;
                    if (c < -40 || c > 150) continue;
                    const crit = Number(d.CriticalTripPoint);
                    const critC = Number.isFinite(crit) ? crit / 10 - 273.15 : null;
                    res.push({ label: "CPU", value_c: Math.round(c * 10) / 10, type: "cpu", critical_c: critC != null ? Math.round(critC * 10) / 10 : null });
                }
                if (res.length > 0) return res;
            } catch {}
        }
        // fallback: OpenHardwareMonitor not available -> return empty
        return [];
    }
    if (platform === "darwin") {
        // macOS: try osx-cpu-temp or powermetrics
        const out = safeExec("osx-cpu-temp 2>/dev/null", 2000);
        if (out) {
            const m = out.match(/([\d.]+)\s*°C/);
            if (m) return [{ label: "CPU", value_c: Math.round(Number(m[1]) * 10) / 10, type: "cpu" }];
        }
        return [];
    }
    // Linux
    const sys = getThermalFromSys();
    // try sensors command to enrich
    const sout = safeExec("sensors -u 2>/dev/null || sensors 2>/dev/null", 3000);
    if (sout) {
        const parsed = parseSensorsOutput(sout);
        // merge: prefer sensors labels but keep sys if not duplicate
        const merged = [...sys.temps];
        for (const t of parsed.temps) {
            if (!merged.some(m => m.label.toLowerCase() === t.label.toLowerCase() && Math.abs(m.value_c - t.value_c) < 1)) {
                merged.push(t);
            }
        }
        // deduplicate by label prefix, keep highest temp per chip
        const byLabel = new Map<string, ThermalSensor>();
        for (const t of merged) {
            const key = t.label.toLowerCase().slice(0, 24);
            const ex = byLabel.get(key);
            if (!ex || t.value_c > ex.value_c) byLabel.set(key, t);
        }
        const out = [...byLabel.values()].sort((a, b) => {
            const order = { cpu: 0, gpu: 1, other: 2 } as const;
            return (order[a.type] - order[b.type]) || b.value_c - a.value_c;
        });
        // filter out unrealistic
        return out.filter(t => t.value_c > -40 && t.value_c < 150).slice(0, 8);
    }
    // try nvidia-smi for GPU
    const nvidia = safeExec("nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null", 2000);
    if (nvidia) {
        const v = Number(nvidia.split("\n")[0].trim());
        if (Number.isFinite(v) && v > 0 && v < 150) {
            if (!sys.temps.some(t => t.type === "gpu")) sys.temps.push({ label: "GPU NVIDIA", value_c: v, type: "gpu" });
        }
    }
    const filtered = sys.temps.filter(t => t.value_c > -40 && t.value_c < 150).slice(0, 8);
    filtered.sort((a, b) => {
        const order = { cpu: 0, gpu: 1, other: 2 } as const;
        return (order[a.type] - order[b.type]) || b.value_c - a.value_c;
    });
    return filtered;
}

export function getFanInfo(): FanInfo[] {
    const platform = os.platform();
    if (platform === "win32") {
        const out = safeExec('powershell -NoProfile -Command "Get-CimInstance Win32_Fan -ErrorAction SilentlyContinue | Select-Object Name,DesiredSpeed | ConvertTo-Json -Compress"', 3000);
        if (out) {
            try {
                const data = JSON.parse(out);
                const arr = Array.isArray(data) ? data : [data];
                const res: FanInfo[] = [];
                for (const d of arr) {
                    const rpm = Number(d.DesiredSpeed);
                    if (Number.isFinite(rpm) && rpm > 0) res.push({ label: String(d.Name || "Fan").slice(0, 40), rpm });
                }
                if (res.length > 0) return res;
            } catch {}
        }
        return [];
    }
    if (platform === "darwin") return [];
    const sys = getThermalFromSys();
    const sout = safeExec("sensors 2>/dev/null", 3000);
    let fans = [...sys.fans];
    if (sout) {
        const parsed = parseSensorsOutput(sout);
        for (const f of parsed.fans) {
            if (!fans.some(x => x.label.toLowerCase() === f.label.toLowerCase())) fans.push(f);
        }
    }
    // deduplicate and filter 0 rpm (stopped)
    const seen = new Map<string, FanInfo>();
    for (const f of fans) {
        const k = f.label.toLowerCase();
        if (!seen.has(k)) seen.set(k, f);
    }
    return [...seen.values()].filter(f => f.rpm >= 0).slice(0, 6);
}

// ── Battery ────────────────────────────────────────────────────────
export function getBatteryInfo(): BatteryInfo | null {
    const platform = os.platform();
    if (platform === "linux") {
        try {
            const supplies = fs.readdirSync("/sys/class/power_supply");
            for (const s of supplies) {
                if (!s.startsWith("BAT")) continue;
                const base = `/sys/class/power_supply/${s}`;
                const capRaw = readFileSafe(path.join(base, "capacity"));
                const statusRaw = readFileSafe(path.join(base, "status"));
                const presentRaw = readFileSafe(path.join(base, "present"));
                if (capRaw == null) continue;
                const pct = Number(capRaw);
                if (!Number.isFinite(pct)) continue;
                const isPresent = presentRaw ? presentRaw === "1" : true;
                const status = statusRaw || "Unknown";
                const isCharging = status.toLowerCase() === "charging" || status.toLowerCase() === "full" && false;
                // actually "Charging" or "Full" means charging/full, "Discharging" means not
                const charging = status.toLowerCase() === "charging";
                const model = readFileSafe(path.join(base, "model_name")) || readFileSafe(path.join(base, "name")) || s;
                // health: energy_full vs energy_full_design
                let health: number | null = null;
                const full = readFileSafe(path.join(base, "energy_full"));
                const design = readFileSafe(path.join(base, "energy_full_design"));
                if (full && design) {
                    const f = Number(full), d = Number(design);
                    if (Number.isFinite(f) && Number.isFinite(d) && d > 0) health = Math.round((f / d) * 100);
                }
                // time remaining: not trivial, skip
                return { percent: Math.max(0, Math.min(100, Math.round(pct))), is_charging: charging, is_present: isPresent, time_remaining_min: null, health_percent: health, model, status };
            }
        } catch {}
        // fallback upower
        const out = safeExec("upower -i $(upower -e 2>/dev/null | grep -i battery | head -n1) 2>/dev/null", 3000);
        if (out) {
            const pctM = out.match(/percentage:\s*([\d.]+)%/i);
            const stateM = out.match(/state:\s*(\w+)/i);
            if (pctM) {
                const pct = Number(pctM[1]);
                const state = stateM ? stateM[1].toLowerCase() : "";
                return { percent: Math.round(pct), is_charging: state === "charging", is_present: true, time_remaining_min: null, model: null, status: state || null };
            }
        }
        return null;
    }
    if (platform === "win32") {
        const out = safeExec('powershell -NoProfile -Command "Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object EstimatedChargeRemaining,BatteryStatus,Name,EstimatedRunTime | ConvertTo-Json -Compress"', 3000);
        if (out) {
            try {
                const data = JSON.parse(out);
                const obj = Array.isArray(data) ? data[0] : data;
                if (obj && obj.EstimatedChargeRemaining != null) {
                    const pct = Number(obj.EstimatedChargeRemaining);
                    const status = Number(obj.BatteryStatus);
                    // BatteryStatus 2 = charging, 1 = discharging
                    const isCharging = status === 2;
                    const rt = Number(obj.EstimatedRunTime);
                    const mins = Number.isFinite(rt) && rt < 100000 ? rt : null;
                    return { percent: Math.round(pct), is_charging: isCharging, is_present: true, time_remaining_min: mins, model: obj.Name ? String(obj.Name).slice(0, 40) : null, status: String(status) };
                }
            } catch {}
        }
        return null;
    }
    if (platform === "darwin") {
        const out = safeExec("pmset -g batt 2>/dev/null", 2000);
        if (out) {
            const pctM = out.match(/(\d+)%/);
            if (pctM) {
                const pct = Number(pctM[1]);
                const isCharging = /charging/i.test(out);
                const timeM = out.match(/(\d+):(\d+)\s+remaining/i);
                let mins: number | null = null;
                if (timeM) mins = Number(timeM[1]) * 60 + Number(timeM[2]);
                return { percent: Math.round(pct), is_charging: isCharging, is_present: true, time_remaining_min: mins, model: null, status: isCharging ? "charging" : "discharging" };
            }
            if (/no.*battery/i.test(out) || /AC Power/i.test(out) && !pctM) return null;
        }
        return null;
    }
    return null;
}
