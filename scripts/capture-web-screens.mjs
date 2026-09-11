import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "http://127.0.0.1:8787";
const OUT_DIRS = [
  path.resolve("docs/assets/web"),
  path.resolve(".agents/assets/web"),
];

async function saveTo(page, filename) {
  const buf = await page.screenshot({ type: "png" });
  const fs = await import("node:fs/promises");
  for (const dir of OUT_DIRS) {
    await mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buf);
  }
  console.log("saved", filename, buf.length, "bytes");
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 1) Visão geral (board)
  await page.goto(`${BASE}/display`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await saveTo(page, "web-overview.png");

  // 2) Agora
  await page.goto(`${BASE}/display/now`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await saveTo(page, "web-now.png");

  // 3) Configurações (contas)
  await page.goto(`${BASE}/display/config`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await saveTo(page, "web-config.png");

  // 4) Editor de tema
  await page.goto(`${BASE}/display/theme`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await saveTo(page, "web-theme-editor.png");

  // 5) Detalhe de conta (Cursor)
  await page.goto(`${BASE}/display`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const cursorCard = page.locator("text=Cursor PRO").first();
  if (await cursorCard.count()) {
    await cursorCard.click();
    await page.waitForTimeout(1500);
    await saveTo(page, "web-detail-cursor.png");
  } else {
    console.warn("Cursor card not found, skipping web-detail-cursor.png");
  }

  // 6) Settings drawer (aparência)
  await page.goto(`${BASE}/display`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const gear = page.locator('button[title="Aparência"]').first();
  if (await gear.count()) {
    await gear.click();
    await page.waitForTimeout(800);
    await saveTo(page, "web-settings.png");
  } else {
    console.warn("Settings trigger not found by aria-label, trying icon in header");
  }

  await context.close();

  // 7) Mobile viewport
  const mobileContext = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/display`, { waitUntil: "load" });
  await mobilePage.waitForTimeout(2000);
  const buf = await mobilePage.screenshot({ type: "png" });
  const fs = await import("node:fs/promises");
  for (const dir of OUT_DIRS) {
    await fs.writeFile(path.join(dir, "web-mobile.png"), buf);
  }
  console.log("saved web-mobile.png", buf.length, "bytes");
  await mobileContext.close();

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
