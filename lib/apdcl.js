import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const LOGIN_URL = "https://www.apdclrms.com/cbs/login";
const DAILY_REPORT_URL =
  "https://www.apdclrms.com/dashboard/performanceReport/daily";

function todayIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function waitForOverlayToDisappear(page) {
  const overlay = page.locator("#outOfSync");

  if (await overlay.count()) {
    try {
      await overlay.waitFor({
        state: "hidden",
        timeout: 60000,
      });
    } catch {
      throw new Error(
        "APDCL login page remained blocked by the #outOfSync overlay."
      );
    }
  }
}

async function clickExactText(page, text, timeout = 30000) {
  const locator = page.getByText(text, { exact: true }).first();

  await locator.waitFor({
    state: "visible",
    timeout,
  });

  await locator.click();

  return locator;
}

export async function downloadTodaysDailyPerformanceReport() {
  const username = process.env.APDCL_USERNAME;
  const password = process.env.APDCL_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "APDCL_USERNAME or APDCL_PASSWORD is missing in Vercel."
    );
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
        : ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
  });

  const page = await context.newPage();

  try {
    // ====================================================
    // 1. APDCL LOGIN
    // ====================================================

    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait for APDCL login form.
    const usernameInput = page.getByLabel(/username/i).first();
    const passwordInput = page.getByLabel(/password/i).first();

    await usernameInput.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await passwordInput.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    // APDCL has a real button with id="loginButton".
    // The #outOfSync overlay can temporarily cover it.
    await waitForOverlayToDisappear(page);

    const loginButton = page.locator("#loginButton");

    await loginButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await loginButton.click();

    // Wait for the login navigation/session to complete.
    await page.waitForLoadState("domcontentloaded", {
      timeout: 60000,
    }).catch(() => {});

    await page.waitForTimeout(1000);

    if (page.url().includes("/cbs/login")) {
      throw new Error(
        "APDCL login did not complete. Check the APDCL username/password."
      );
    }

    // ====================================================
    // 2. OPEN THE USER MENU
    // ====================================================

    const welcome = page.getByText(/Welcome,/i).first();

    await welcome.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await welcome.click();

    // ====================================================
    // 3. ARMS 360 DASHBOARD
    // ====================================================

    const arms360Link = page
      .getByText("ARMS 360 Dashboard", { exact: true })
      .first();

    await arms360Link.waitFor({
      state: "visible",
      timeout: 30000,
    });

    // APDCL opens ARMS 360 in a new browser tab.
    const newPagePromise = context
      .waitForEvent("page", { timeout: 15000 })
      .catch(() => null);

    await arms360Link.click();

    let arms360Page = await newPagePromise;

    // Fallback if APDCL ever opens it in the same tab.
    if (!arms360Page) {
      arms360Page = page;
    }

    await arms360Page.waitForLoadState("domcontentloaded", {
      timeout: 60000,
    }).catch(() => {});

    await arms360Page.waitForTimeout(1000);

    // ====================================================
    // 4. APDCL PERFORMANCE
    // ====================================================

    await clickExactText(
      arms360Page,
      "APDCL Performance"
    );

    // ====================================================
    // 5. DAILY REPORT
    // ====================================================

    await clickExactText(
      arms360Page,
      "Daily Report"
    );

    // Wait for the known final report URL.
    await arms360Page.waitForURL(
      "**/dashboard/performanceReport/daily",
      {
        timeout: 60000,
      }
    ).catch(() => {});

    // ====================================================
    // 6. VERIFY DAILY PERFORMANCE PAGE
    // ====================================================

    await arms360Page
      .getByText("Performance Report for date", {
        exact: false,
      })
      .waitFor({
        state: "visible",
        timeout: 60000,
      });

    // IMPORTANT:
    // APDCL automatically selects today's date.
    // We deliberately DO NOT modify the date.
    const reportDate = todayIndia();

    // ====================================================
    // 7. CLICK EXCEL
    // ====================================================

    const excelButton = arms360Page
      .getByRole("button", { name: /^Excel$/i })
      .first();

    await excelButton.waitFor({
      state: "visible",
      timeout: 30000,
    });

    await excelButton.scrollIntoViewIfNeeded();

    const downloadPromise = arms360Page.waitForEvent("download", {
      timeout: 60000,
    });

    await excelButton.click();

    const download = await downloadPromise;

    const fileName = download.suggestedFilename();

    if (!fileName || !/\.(xlsx|xls)$/i.test(fileName)) {
      throw new Error(
        `APDCL download was detected but it was not an Excel file. Filename: ${
          fileName || "unknown"
        }`
      );
    }

    const stream = await download.createReadStream();

    if (!stream) {
      throw new Error(
        "APDCL Excel download stream could not be opened."
      );
    }

    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const fileBuffer = Buffer.concat(chunks);

    if (!fileBuffer.length) {
      throw new Error("APDCL returned an empty Excel file.");
    }

    return {
      fileBuffer,
      fileName,
      reportDate,
      sourceUrl: arms360Page.url(),
    };
  } finally {
    await browser.close();
  }
}
