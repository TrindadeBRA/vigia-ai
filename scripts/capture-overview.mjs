import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "http://127.0.0.1:8787";
const OUT_DIRS = [
  path.resolve("docs/assets/web"),
  path.resolve(".agents/assets/web"),
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/display`, { waitUntil: "load" });
  // Espera os cards reais aparecerem (sai do skeleton) em vez de tempo fixo.
  await page.waitForSelector("text=Cursor PRO", { timeout: 15000 });
  await page.waitForTimeout(1000);
  const buf = await page.screenshot({ type: "png" });
  for (const dir of OUT_DIRS) {
    await writeFile(path.join(dir, "web-overview.png"), buf);
  }
  console.log("saved web-overview.png", buf.length, "bytes");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
