import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const LOGIN_URL = "https://www.apdclrms.com/cbs/login";
const REPORT_URL =
  "https://www.apdclrms.com/dashboard/performanceReport/daily";

function isTruthy(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

async function findDateInput(page) {
  // First try common date input selectors.
  const candidates = [
    'input[type="date"]',
    'input[name*="date" i]',
    'input[id*="date" i]',
    'input[placeholder*="date" i]',
    'input[placeholder*="Date" i]'
  ];

  for (const selector of candidates) {
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      try {
        if (await loc.isVisible()) return loc;
      } catch {}
    }
  }

  // Fallback: look for a label containing Date and its nearby input.
  const labels = page.getByText(/date/i);
  const count = await labels.count();
  for (let i = 0; i < Math.min(count, 20); i++) {
    const label = labels.nth(i);
    try {
      if (!(await label.isVisible())) continue;
      const parent = label.locator("xpath=..");
      const input = parent.locator("input").first();
      if (await input.count()) return input;
    } catch {}
  }

  throw new Error(
    "Could not find the date input on the Daily Performance Report page. " +
    "Please inspect the page and add its exact selector in lib/apdcl.js."
  );
}

async function findExcelButton(page) {
  const candidates = [
    page.getByRole("button", { name: /excel/i }).first(),
    page.getByRole("link", { name: /excel/i }).first(),
    page.getByText(/excel/i).first(),
    page.locator('button:has-text("Excel")').first(),
    page.locator('a:has-text("Excel")').first()
  ];

  for (const loc of candidates) {
    try {
      if (await loc.count() && await loc.isVisible()) return loc;
    } catch {}
  }

  throw new Error(
    "Could not find the Excel button/link on the report page. " +
    "Please inspect the page and add its exact selector in lib/apdcl.js."
  );
}

async function maybeGenerate(page) {
  // Some versions generate the report automatically when the date changes;
  // others have a Generate/Search/View button. Try common names without
  // failing if no such button exists.
  const candidates = [
    page.getByRole("button", { name: /generate/i }).first(),
    page.getByRole("button", { name: /search/i }).first(),
    page.getByRole("button", { name: /view/i }).first(),
    page.getByRole("button", { name: /submit/i }).first(),
    page.getByRole("button", { name: /show/i }).first()
  ];

  for (const loc of candidates) {
    try {
      if (await loc.count() && await loc.isVisible() && await loc.isEnabled()) {
        await loc.click();
        await page.waitForTimeout(1500);
        return true;
      }
    } catch {}
  }

  return false;
}

export async function downloadDailyPerformanceReport(reportDate) {
  const username = process.env.APDCL_USERNAME;
  const password = process.env.APDCL_PASSWORD;

  if (!isTruthy(username) || !isTruthy(password)) {
    throw new Error("Missing APDCL_USERNAME or APDCL_PASSWORD.");
  }

  const executablePath =
    process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
    (process.env.NODE_ENV === "production"
      ? await chromium.executablePath()
      : undefined);

  const browser = await playwrightChromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args:
      process.env.NODE_ENV === "production"
        ? chromium.args
        : ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({
    acceptDownloads: true
  });
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // These selectors are intentionally flexible. If the RMS page uses
    // different names, update them here after inspecting the login form.
    const userInput = page.locator(
      'input[name="username"], input[name="userName"], input[type="text"]'
    ).first();
    const passwordInput = page.locator(
      'input[name="password"], input[type="password"]'
    ).first();

    await userInput.fill(username);
    await passwordInput.fill(password);

    const loginButton = page.getByRole("button", { name: /login|sign in/i }).first();
    if (await loginButton.count()) {
      await loginButton.click();
    } else {
      await page.locator('button[type="submit"], input[type="submit"]').first().click();
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Confirm that login did not remain on the login page.
    if (page.url().includes("/cbs/login")) {
      throw new Error(
        "APDCL login did not complete. Check APDCL_USERNAME/APDCL_PASSWORD."
      );
    }

    await page.goto(REPORT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(1500);

    const dateInput = await findDateInput(page);

    // HTML date inputs normally accept YYYY-MM-DD.
    await dateInput.fill(reportDate);
    await dateInput.dispatchEvent("change");
    await dateInput.dispatchEvent("input");

    await maybeGenerate(page);

    // Give the report a little time to render.
    await page.waitForTimeout(2000);

    const excelButton = await findExcelButton(page);

    const downloadPromise = page.waitForEvent("download", {
      timeout: 60000
    });

    await excelButton.click();

    const download = await downloadPromise;
    const suggestedName = download.suggestedFilename() || "daily-performance.xlsx";
    const buffer = await download.createReadStream();

    // Convert stream to Buffer.
    const chunks = [];
    for await (const chunk of buffer) chunks.push(chunk);
    const fileBuffer = Buffer.concat(chunks);

    return {
      fileBuffer,
      fileName: suggestedName,
      finalUrl: page.url()
    };
  } finally {
    await browser.close();
  }
}
