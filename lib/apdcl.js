import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const LOGIN_URL = "https://www.apdclrms.com/cbs/login";
const DAILY_REPORT_URL = "https://www.apdclrms.com/dashboard/performanceReport/daily";

function todayIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function visibleFirst(page, locators, name) {
  for (const locator of locators) {
    try {
      if (await locator.count() && await locator.first().isVisible()) return locator.first();
    } catch {}
  }
  throw new Error(`${name} not found on APDCL page.`);
}

export async function downloadTodaysDailyPerformanceReport() {
  const username = process.env.APDCL_USERNAME;
  const password = process.env.APDCL_PASSWORD;
  if (!username || !password) throw new Error("APDCL_USERNAME or APDCL_PASSWORD is missing in Vercel.");

  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
    (process.env.NODE_ENV === "production" ? await chromium.executablePath() : undefined);

  const browser = await playwrightChromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: process.env.NODE_ENV === "production"
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    // 1. Login
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    const usernameInput = await visibleFirst(page, [
      page.getByLabel(/^username$/i),
      page.locator('input[name="username"]'),
      page.locator('input[name="userName"]'),
      page.locator('input[type="text"]')
    ], "Username field");

    const passwordInput = await visibleFirst(page, [
      page.getByLabel(/^password$/i),
      page.locator('input[name="password"]'),
      page.locator('input[type="password"]')
    ], "Password field");

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    const loginButton = await visibleFirst(page, [
      page.getByRole("button", { name: /^log in$/i }),
      page.getByText(/^Log in$/i),
      page.locator('button').filter({ hasText: /log in/i }),
      page.locator('input[type="submit"]')
    ], "Login button");

    await loginButton.click();

    await page.waitForURL("**/cbs/dashboard/mis", { timeout: 60000 }).catch(() => {});
    if (page.url().includes("/cbs/login")) {
      throw new Error("APDCL login failed. Check APDCL_USERNAME and APDCL_PASSWORD.");
    }

    // 2. Open the top-right user menu.
    const welcome = await visibleFirst(page, [
      page.getByText(/Welcome,/i),
      page.locator('text=/Welcome,/i')
    ], "APDCL user menu");
    await welcome.click();

    // 3. ARMS 360 opens a new tab in the workflow shown in the screenshots.
    const armsLink = await visibleFirst(page, [
      page.getByText("ARMS 360 Dashboard", { exact: true }),
      page.getByRole("link", { name: /ARMS 360 Dashboard/i })
    ], "ARMS 360 Dashboard");

    const newPagePromise = context.waitForEvent("page", { timeout: 15000 }).catch(() => null);
    await armsLink.click();
    const popup = await newPagePromise;
    const armsPage = popup || page;

    await armsPage.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});

    // 4. Click APDCL Performance, then Daily Report.
    const performance = await visibleFirst(armsPage, [
      armsPage.getByText("APDCL Performance", { exact: true }),
      armsPage.getByRole("link", { name: /^APDCL Performance$/i })
    ], "APDCL Performance");
    await performance.click();

    const daily = await visibleFirst(armsPage, [
      armsPage.getByText("Daily Report", { exact: true }),
      armsPage.getByRole("link", { name: /^Daily Report$/i })
    ], "Daily Report");
    await daily.click();

    // 5. The APDCL page automatically selects today's date. Do NOT change it.
    await armsPage.waitForURL("**/dashboard/performanceReport/daily", { timeout: 60000 }).catch(() => {});
    await armsPage.getByText(/Performance Report for date/i).first().waitFor({ state: "visible", timeout: 60000 });

    // 6. Click Excel and capture the real download.
    const excel = await visibleFirst(armsPage, [
      armsPage.getByRole("button", { name: /^Excel$/i }),
      armsPage.getByRole("link", { name: /^Excel$/i }),
      armsPage.getByText(/^Excel$/i),
      armsPage.locator('button').filter({ hasText: /^Excel$/i })
    ], "Excel button");

    const downloadPromise = armsPage.waitForEvent("download", { timeout: 60000 });
    await excel.click();
    const download = await downloadPromise;

    const fileName = download.suggestedFilename() || "daily-performance.xlsx";
    if (!/\.(xlsx|xls)$/i.test(fileName)) {
      throw new Error(`Downloaded file is not Excel: ${fileName}`);
    }

    const stream = await download.createReadStream();
    if (!stream) throw new Error("Could not read the APDCL Excel download.");

    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const fileBuffer = Buffer.concat(chunks);
    if (!fileBuffer.length) throw new Error("APDCL returned an empty Excel file.");

    return {
      fileBuffer,
      fileName,
      reportDate: todayIndia(),
      sourceUrl: armsPage.url()
    };
  } finally {
    await browser.close();
  }
}
