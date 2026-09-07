import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestApp } from "../testUtils.js";
import { dataDir } from "../config.js";

describe("camera router", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("starts with no cameras configured", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "GET", url: "/api/camera/cameras" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ cameras: [] });
  });

  it("adds a camera and never returns the password", async () => {
    app = await createTestApp();
    const post = await app.inject({
      method: "POST",
      url: "/api/camera/cameras",
      payload: { label: "Sala", host: "192.168.3.27", password: "secreta" },
    });
    expect(post.statusCode).toBe(200);
    const body = post.json();
    expect(body.ok).toBe(true);
    expect(body.camera.label).toBe("Sala");
    expect(body.camera.configured).toBe(true);
    expect(body.camera).not.toHaveProperty("password");
    expect(typeof body.camera.id).toBe("string");

    const list = await app.inject({ method: "GET", url: "/api/camera/cameras" });
    expect(list.json().cameras).toHaveLength(1);
  });

  it("rejects adding a camera without a host", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "POST", url: "/api/camera/cameras", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("patches an existing camera", async () => {
    app = await createTestApp();
    const post = await app.inject({ method: "POST", url: "/api/camera/cameras", payload: { host: "192.168.3.27" } });
    const id = post.json().camera.id;

    const patch = await app.inject({ method: "PATCH", url: `/api/camera/cameras/${id}`, payload: { label: "Quintal", ptzEnabled: true, onvifPort: 8000 } });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().camera).toMatchObject({ label: "Quintal", ptzEnabled: true, onvifPort: 8000, host: "192.168.3.27" });
  });

  it("404s patching a camera that doesn't exist", async () => {
    app = await createTestApp();
    const res = await app.inject({ method: "PATCH", url: "/api/camera/cameras/doesnotexist", payload: { label: "x" } });
    expect(res.statusCode).toBe(404);
  });

  it("deletes a camera", async () => {
    app = await createTestApp();
    const post = await app.inject({ method: "POST", url: "/api/camera/cameras", payload: { host: "192.168.3.27" } });
    const id = post.json().camera.id;

    const del = await app.inject({ method: "DELETE", url: `/api/camera/cameras/${id}` });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/camera/cameras" });
    expect(list.json().cameras).toEqual([]);
  });

  it("404s snapshot/stream/ptz for an unknown camera id", async () => {
    app = await createTestApp();
    const snap = await app.inject({ method: "GET", url: "/api/camera/cameras/nope/snapshot" });
    expect(snap.statusCode).toBe(404);
    const ptz = await app.inject({ method: "POST", url: "/api/camera/cameras/nope/ptz", payload: { action: "up" } });
    expect(ptz.statusCode).toBe(404);
  });

  it("rejects ptz when the camera doesn't have it enabled", async () => {
    app = await createTestApp();
    const post = await app.inject({ method: "POST", url: "/api/camera/cameras", payload: { host: "192.168.3.27" } });
    const id = post.json().camera.id;
    const res = await app.inject({ method: "POST", url: `/api/camera/cameras/${id}/ptz`, payload: { action: "up" } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid ptz action", async () => {
    app = await createTestApp();
    const post = await app.inject({ method: "POST", url: "/api/camera/cameras", payload: { host: "192.168.3.27", ptzEnabled: true } });
    const id = post.json().camera.id;
    const res = await app.inject({ method: "POST", url: `/api/camera/cameras/${id}/ptz`, payload: { action: "spin" } });
    expect(res.statusCode).toBe(400);
  });

  it("migrates the legacy single-camera file format", async () => {
    app = await createTestApp();
    // Formato antigo: campos no topo do arquivo, sem "cameras". Escrito
    // depois do createTestApp() pra já ter o dataDir isolado do teste.
    writeFileSync(
      join(dataDir(), "camera.json"),
      JSON.stringify({ host: "10.0.0.5", port: 554, path: "onvif1", username: "admin", password: "hunter2" }),
      "utf-8",
    );
    const res = await app.inject({ method: "GET", url: "/api/camera/cameras" });
    expect(res.statusCode).toBe(200);
    const cameras = res.json().cameras;
    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({ host: "10.0.0.5", port: 554, path: "onvif1", username: "admin", configured: true });
    expect(cameras[0]).not.toHaveProperty("password");
  });
});
