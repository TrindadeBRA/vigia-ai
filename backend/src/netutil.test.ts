import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, networkInterfaces: vi.fn() };
});

import * as os from "node:os";
import { displayLanUrl, panelLanUrl } from "./netutil.js";
import { urlButtonMarkup } from "./telegram/bot.js";

function ipv4Interface(address: string): NodeJS.Dict<os.NetworkInterfaceInfo[]> {
  return {
    eth0: [
      {
        address,
        netmask: "255.255.255.0",
        family: "IPv4",
        mac: "00:00:00:00:00:00",
        internal: false,
        cidr: `${address}/24`,
      } as os.NetworkInterfaceInfo,
    ],
  };
}

beforeEach(() => {
  vi.mocked(os.networkInterfaces).mockReset();
});

describe("displayLanUrl / panelLanUrl", () => {
  it("builds URLs from the first non-loopback LAN IPv4", () => {
    vi.mocked(os.networkInterfaces).mockReturnValue(ipv4Interface("192.168.3.58"));
    expect(displayLanUrl(8787)).toBe("http://192.168.3.58:8787/display");
    expect(panelLanUrl(8787)).toBe("http://192.168.3.58:8787/");
  });

  it("returns empty string when there is no LAN IP", () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({});
    expect(displayLanUrl(8787)).toBe("");
  });
});

describe("urlButtonMarkup", () => {
  it("builds an inline keyboard with the default label", () => {
    const markup = urlButtonMarkup("http://192.168.3.58:8787/display");
    expect(markup).toEqual({
      inline_keyboard: [[{ text: "Abrir VigiaAI", url: "http://192.168.3.58:8787/display" }]],
    });
  });
});
