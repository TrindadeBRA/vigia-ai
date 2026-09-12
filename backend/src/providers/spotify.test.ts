import { describe, it, expect } from "vitest";
import { pickCoverUrl, summarizePlayback } from "./spotify.js";

const IMAGES = [
  { url: "https://i.scdn.co/image/big", width: 640, height: 640 },
  { url: "https://i.scdn.co/image/mid", width: 300, height: 300 },
  { url: "https://i.scdn.co/image/tiny", width: 64, height: 64 },
];

describe("pickCoverUrl", () => {
  it("escolhe a menor capa que ainda cobre o tamanho pedido", () => {
    expect(pickCoverUrl(IMAGES, 48)).toBe("https://i.scdn.co/image/tiny");
    expect(pickCoverUrl(IMAGES, 80)).toBe("https://i.scdn.co/image/mid");
    expect(pickCoverUrl(IMAGES, 400)).toBe("https://i.scdn.co/image/big");
  });

  it("ignora entradas sem URL http(s)", () => {
    expect(pickCoverUrl([{ url: "ftp://x", width: 64, height: 64 }, IMAGES[2]], 48)).toBe("https://i.scdn.co/image/tiny");
  });

  it("devolve null se não houver imagens", () => {
    expect(pickCoverUrl([], 48)).toBeNull();
    expect(pickCoverUrl(null, 48)).toBeNull();
  });
});

describe("summarizePlayback", () => {
  it("preenche track.image_url a partir das capas do álbum", () => {
    const out = summarizePlayback({
      is_playing: true,
      progress_ms: 12,
      item: {
        id: "abc",
        name: "Faixa",
        duration_ms: 180000,
        artists: [{ name: "Artista" }],
        album: { name: "Disco", images: IMAGES },
        external_urls: { spotify: "https://open.spotify.com/track/abc" },
      },
    });
    expect(out.track?.id).toBe("abc");
    expect(out.track?.artists).toBe("Artista");
    expect(out.track?.image_url).toBe("https://i.scdn.co/image/mid");
  });

  it("devolve track null quando nada está tocando", () => {
    expect(summarizePlayback(null).track).toBeNull();
  });
});
