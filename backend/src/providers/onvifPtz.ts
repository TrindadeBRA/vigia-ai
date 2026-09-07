/**
 * Controle PTZ (pan/tilt/zoom) via ONVIF SOAP — sem dependência externa
 * (mesmo espírito do parser RSS: regex em vez de lib de XML). Fala com o
 * "device service" da câmera pra descobrir o serviço PTZ (GetCapabilities),
 * pega o token do perfil ativo (GetProfiles) e manda ContinuousMove/Stop.
 *
 * Autenticação é WS-Security UsernameToken (nonce + timestamp + digest
 * SHA1), diferente do RTSP Digest que a mesma câmera usa pro vídeo — os
 * dois esquemas coexistem no mesmo dispositivo, em portas diferentes.
 */
import { createHash, randomBytes } from "node:crypto";
import type { CameraItem } from "../schemas/camera.js";

const SOAP_TIMEOUT_MS = 8000;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

export type PtzAction = "up" | "down" | "left" | "right" | "zoom_in" | "zoom_out" | "stop";

type Discovery = { deviceUrl: string; ptzUrl: string; mediaUrl: string; profileToken: string; at: number };
const cache = new Map<string, Discovery>();

function deviceUrl(camera: CameraItem): string {
  return `http://${camera.host}:${camera.onvifPort}/onvif/device_service`;
}

function wsSecurityHeader(username: string, password: string): string {
  const created = new Date().toISOString();
  const nonce = randomBytes(16);
  const digest = createHash("sha1")
    .update(Buffer.concat([nonce, Buffer.from(created, "utf-8"), Buffer.from(password, "utf-8")]))
    .digest("base64");
  return `
    <Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <UsernameToken>
        <Username>${username}</Username>
        <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-username-token-profile-1.0#PasswordDigest">${digest}</Password>
        <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString("base64")}</Nonce>
        <u:Created>${created}</u:Created>
      </UsernameToken>
    </Security>`;
}

async function soapCall(url: string, camera: CameraItem, bodyXml: string): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Header>${wsSecurityHeader(camera.username, camera.password)}</s:Header>
  <s:Body>${bodyXml}</s:Body>
</s:Envelope>`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
    body: envelope,
    signal: AbortSignal.timeout(SOAP_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    const fault = extractTag(text, "Text") || extractTag(text, "Reason") || `HTTP ${res.status}`;
    throw new Error(`ONVIF ${res.status}: ${fault}`);
  }
  return text;
}

// Regex tolerante a prefixo de namespace (tt:XAddr, trt:Profiles, etc.) — mesmo
// approach do parser RSS: sem lib de XML, só o suficiente pra extrair o dado.
function extractTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}>([^<]*)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`).exec(xml);
  return m ? m[1].trim() : null;
}

function extractSection(xml: string, tag: string): string | null {
  const m = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`).exec(xml);
  return m ? m[1] : null;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const m = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*\\b${attr}="([^"]+)"`).exec(xml);
  return m ? m[1] : null;
}

async function discover(camera: CameraItem): Promise<Discovery> {
  const hit = cache.get(camera.id);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) return hit;

  const devUrl = deviceUrl(camera);
  const caps = await soapCall(devUrl, camera, `<GetCapabilities xmlns="http://www.onvif.org/ver10/device/wsdl"><Category>All</Category></GetCapabilities>`);
  const ptzSection = extractSection(caps, "PTZ");
  const mediaSection = extractSection(caps, "Media");
  const ptzUrl = (ptzSection && extractTag(ptzSection, "XAddr")) || devUrl;
  const mediaUrl = (mediaSection && extractTag(mediaSection, "XAddr")) || devUrl;

  const profiles = await soapCall(mediaUrl, camera, `<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>`);
  const profileToken = extractAttr(profiles, "Profiles", "token");
  if (!profileToken) throw new Error("Câmera não devolveu nenhum profile ONVIF (GetProfiles vazio)");

  const entry: Discovery = { deviceUrl: devUrl, ptzUrl, mediaUrl, profileToken, at: Date.now() };
  cache.set(camera.id, entry);
  return entry;
}

// Velocidade normalizada ONVIF é -1..1, mas câmeras clone baratas (confirmado
// na prática) não validam o range — 1.5 dá bem mais deslocamento por toque
// rápido do D-pad do que o 0.5 original, sem risco (o firmware só anda mais
// rápido, não quebra nada fora do range documentado).
const VECTORS: Record<Exclude<PtzAction, "stop">, { x: number; y: number; zoom: number }> = {
  up: { x: 0, y: 1.5, zoom: 0 },
  down: { x: 0, y: -1.5, zoom: 0 },
  left: { x: -1.5, y: 0, zoom: 0 },
  right: { x: 1.5, y: 0, zoom: 0 },
  zoom_in: { x: 0, y: 0, zoom: 0.5 },
  zoom_out: { x: 0, y: 0, zoom: -0.5 },
};

export function invalidatePtzCache(cameraId: string): void {
  cache.delete(cameraId);
}

export async function sendPtz(camera: CameraItem, action: PtzAction): Promise<void> {
  const disc = await discover(camera);
  if (action === "stop") {
    await soapCall(
      disc.ptzUrl,
      camera,
      `<Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl"><ProfileToken>${disc.profileToken}</ProfileToken><PanTilt>true</PanTilt><Zoom>true</Zoom></Stop>`,
    );
    return;
  }
  const v = VECTORS[action];
  await soapCall(
    disc.ptzUrl,
    camera,
    `<ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">
      <ProfileToken>${disc.profileToken}</ProfileToken>
      <Velocity>
        <PanTilt x="${v.x}" y="${v.y}" xmlns="http://www.onvif.org/ver10/schema"/>
        <Zoom x="${v.zoom}" xmlns="http://www.onvif.org/ver10/schema"/>
      </Velocity>
    </ContinuousMove>`,
  );
}
