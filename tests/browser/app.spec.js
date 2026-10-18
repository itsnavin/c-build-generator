import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

test("responsive UI, accessible file tabs and validation", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your first C build");
  await expect(page.locator("#preview")).toContainText('puts("Hello from C!")');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("tab", { name: "main.c", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Makefile", exact: true })).toBeFocused();
  await expect(page.locator("#preview")).toContainText("$(origin CC)");
  await page.getByLabel("Project & executable name").fill("bad;touch");
  await expect(page.getByRole("button", { name: "Download starter .zip" })).toBeDisabled();
  await expect(page.locator("#name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#preview")).toContainText("Preview paused");
  await page.getByLabel("Project & executable name").fill("weather");
  await expect(page.getByRole("button", { name: "Download starter .zip" })).toBeEnabled();
  await page.getByLabel("CMake", { exact: true }).check();
  await page.getByLabel("Where will your program run?").selectOption("aarch64");
  await expect(page.getByLabel("C compiler", { exact: true })).toHaveValue("aarch64-linux-gnu-gcc");
  await page.getByRole("tab", { name: "toolchain.cmake", exact: true }).click();
  await expect(page.locator("#preview")).toContainText("CMAKE_SYSTEM_PROCESSOR aarch64");
  await expect(page.locator("#commands")).not.toContainText("\n./");
  await page.getByLabel("Sysroot optional").fill("/bad path");
  await expect(page.locator("#sysroot-error")).toBeVisible();
  await page.getByLabel("Sysroot optional").fill("/opt/sdk");
  await page.getByRole("tab", { name: "toolchain.cmake", exact: true }).click();
  await expect(page.locator("#preview")).toContainText('CMAKE_SYSROOT "/opt/sdk"');
  await page.getByText("Native vs cross-compilation:", { exact: false }).click();
  await expect(page.getByText("These starters target Linux", { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath("generator.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("download is a real coherent ZIP and clipboard copies exact preview", async ({ page, context, browserName }) => {
  await page.goto("./");
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy file" }).click();
    await expect(page.getByRole("status")).toContainText("main.c copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // Windows clipboard normalizes newlines to CRLF.
    expect(copied.replace(/\r\n/g, "\n")).toBe(await page.locator("#preview").textContent());
  }
  await page.getByLabel("CMake", { exact: true }).check();
  await page.getByLabel("Where will your program run?").selectOption("armhf");
  await page.getByLabel("Starter program").selectOption("sensor");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download starter .zip" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("hello_c-cmake.zip");
  const path = await download.path();
  const bytes = await readFile(path);
  expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
  execFileSync(process.env.PYTHON || "python3", ["-c",
    "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert set(z.namelist())=={'main.c','CMakeLists.txt','toolchain.cmake','README.md'}; assert b'arm-linux-gnueabihf-gcc' in z.read('toolchain.cmake'); assert b'Sensor reading:' in z.read('main.c'); assert b'Run on the target, NOT' in z.read('README.md')", path]);
});
