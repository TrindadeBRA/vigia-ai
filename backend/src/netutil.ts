import * as dgram from "node:dgram";
import * as os from "node:os";

export function lanIPv4(): string[] {
  const found: string[] = [];

  // Attempt UDP connect trick (similar to Python socket.connect to 8.8.8.8:80)
  // Node dgram doesn't expose getSockName easily without async, so we use
  // networkInterfaces as reliable fallback. We attempt to emulate the fast path
  // by checking routable interfaces.
  // The UDP trick in Node would require creating a socket, connecting, and reading address.
  // We try synchronous-like via os.networkInterfaces which covers same result.
  try {
    const nets = os.networkInterfaces();
    for (const addrs of Object.values(nets)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === "IPv4" && !addr.internal) {
          if (addr.address && !addr.address.startsWith("127.") && !found.includes(addr.address)) {
            found.push(addr.address);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return found;
}

export function panelLanUrl(port: number): string {
  const ips = lanIPv4();
  if (ips.length === 0) return "";
  return `http://${ips[0]}:${Number(port)}/`;
}

export function displayLanUrl(port: number): string {
  const ips = lanIPv4();
  if (ips.length === 0) return "";
  return `http://${ips[0]}:${Number(port)}/display`;
}

// snake_case aliases for Python compat
export const lan_ipv4 = lanIPv4;
export const panel_lan_url = panelLanUrl;
export const display_lan_url = displayLanUrl;
