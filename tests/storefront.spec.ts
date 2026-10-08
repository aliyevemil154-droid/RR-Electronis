import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function openStore(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your next upgrade",
  );
  await expect(
    page.getByRole("button", { name: "Shopping bag, 0 items" }),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

test("the storefront has working images, no browser errors, and fits the viewport", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await openStore(page);
  for (const section of await page.locator(".reveal").all()) {
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveClass(/visible/);
  }
  await expectNoHorizontalOverflow(page);
  await expect
    .poll(async () =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  expect(browserErrors).toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const screenshotDir = path.join(tmpdir(), "dubai-screenshots");
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, `storefront-${testInfo.project.name}.png`),
    fullPage: true,
    animations: "disabled",
  });
});

test("category filters and price sorting reveal relevant products", async ({
  page,
}) => {
  await openStore(page);
  const category = page.getByRole("group", { name: "Product category" });
  await category.getByRole("button", { name: "Audio", exact: true }).click();
  const cards = page.locator("#shop .product-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.locator(".product-category")).toHaveText([
    "Audio",
    "Audio",
  ]);
  await page
    .getByRole("combobox", { name: "Sort products" })
    .selectOption("low");
  await expect(cards.first()).toContainText("AirPods Pro 2");
  await expect(cards.last()).toContainText("Bose QuietComfort 45");
  await category.getByRole("button", { name: "Gaming", exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("PlayStation 5");
  await expectNoHorizontalOverflow(page);
});

test("search finds devices and provides a recoverable empty result", async ({
  page,
}) => {
  await openStore(page);
  await page
    .getByRole("button", { name: "Search products", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("textbox", { name: "Search the collection" });
  await expect(input).toBeFocused();
  await input.fill("iPhone");
  await expect(dialog.locator(".search-result")).toHaveCount(1);
  await dialog.getByRole("button", { name: "See search results" }).click();
  await expect(page.locator("#shop .product-card")).toHaveCount(1);
  await expect(page.locator("#shop .product-card")).toContainText(
    "iPhone 16 Pro",
  );
  await page
    .getByRole("button", { name: "Search products", exact: true })
    .click();
  await input.fill("no-such-device-xyz");
  await expect(dialog).toContainText(
    "No matches. Try a different device or brand.",
  );
  await dialog.getByRole("button", { name: "See search results" }).click();
  await expect(
    page.getByRole("heading", { name: "No matches just yet." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore all devices", exact: true })
    .click();
  await expect(page.locator("#shop .product-card")).toHaveCount(6);
});

test("product details add to a persistent bag with accurate quantities and subtotal", async ({
  page,
}) => {
  await openStore(page);
  await page
    .getByRole("button", { name: "View iPhone 16 Pro", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "iPhone 16 Pro", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("A18 Pro chip");
  await dialog
    .getByRole("button", { name: "Add to your bag", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Shopping bag, 1 item" }).click();
  await dialog
    .getByRole("button", { name: "Increase iPhone 16 Pro quantity" })
    .click();
  await expect(dialog.locator(".quantity-control")).toContainText("2");
  await expect(dialog.locator(".cart-summary")).toContainText("4,798");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Shopping bag, 2 items" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Shopping bag, 2 items" }).click();
  await dialog
    .getByRole("button", { name: "Decrease iPhone 16 Pro quantity" })
    .click();
  await expect(dialog.locator(".cart-summary")).toContainText("2,399");
  await dialog
    .getByRole("button", { name: "Remove iPhone 16 Pro from bag" })
    .click();
  await expect(dialog).toContainText("Your bag is empty");
  await expect(
    page.getByRole("button", { name: "Shopping bag, 0 items" }),
  ).toBeVisible();
});

test("saved favourites persist across reloads and can be removed", async ({
  page,
}, testInfo) => {
  await openStore(page);
  await page
    .getByRole("button", {
      name: "Save iPhone 16 Pro to wishlist",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove iPhone 16 Pro from wishlist",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remove iPhone 16 Pro from wishlist",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", { name: /Your favourites/ })
      .click();
  } else {
    await page.getByRole("button", { name: "Wishlist, 1 item" }).click();
  }
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "iPhone 16 Pro", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Remove iPhone 16 Pro from wishlist" })
    .click();
  await expect(dialog).toContainText("Tap the heart on a device");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Save iPhone 16 Pro to wishlist",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("checkout keeps accurate delivery totals and cannot take payment before configuration", async ({
  page,
}, testInfo) => {
  await openStore(page);
  await page
    .getByRole("group", { name: "Product category" })
    .getByRole("button", { name: "Audio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add AirPods Pro 2 to bag", exact: true })
    .click();
  await page.getByRole("button", { name: "Shopping bag, 1 item" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Continue to checkout" })
    .click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(
    page.getByRole("heading", { name: "Your details", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".checkout-costs")).toContainText("449");
  await expect(page.locator(".checkout-costs")).toContainText("35");
  await expect(page.locator(".checkout-total")).toContainText("484");
  await page.getByLabel("Full name", { exact: true }).fill("Test Customer");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("qa-customer@example.com");
  await page
    .getByLabel("Phone number", { exact: true })
    .fill("+994 50 123 45 67");
  await page
    .getByLabel("Street address", { exact: true })
    .fill("Nizami Street 100");
  await page.getByLabel("Postal code", { exact: false }).fill("AZ1000");
  expect(
    await page
      .getByLabel("Phone number", { exact: true })
      .evaluate((input) => (input as HTMLInputElement).checkValidity()),
  ).toBe(true);
  expect(
    await page
      .getByLabel("Postal code", { exact: false })
      .evaluate((input) => (input as HTMLInputElement).checkValidity()),
  ).toBe(true);
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Baku");
  await expect(
    page.getByRole("button", { name: "Payments coming soon", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Online payments are coming soon", { exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page
    .getByRole("button", { name: "Increase AirPods Pro 2 quantity" })
    .click();
  await expect(page.locator(".checkout-total")).toContainText("933");
  await page.reload();
  await expect(page.locator(".checkout-total")).toContainText("933");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const screenshotDir = path.join(tmpdir(), "dubai-screenshots");
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, `checkout-${testInfo.project.name}.png`),
    fullPage: true,
    animations: "disabled",
  });
});

test("newsletter signup submits to the server and returns a real success", async ({
  page,
}, testInfo) => {
  await openStore(page);
  await page
    .getByRole("textbox", { name: "Your email address", exact: true })
    .fill(`qa-${testInfo.project.name}-${Date.now()}@example.com`);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/newsletter") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Join the newsletter", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await expect(page.locator(".newsletter-status")).toContainText(
    "You're on the list",
  );
  await expect(
    page.getByRole("textbox", { name: "Your email address", exact: true }),
  ).toHaveValue("");
});

test("dialogs trap keyboard focus, close on Escape, and restore the trigger", async ({
  page,
}) => {
  await openStore(page);
  const trigger = page.getByRole("button", {
    name: "Search products",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("textbox", { name: "Search the collection" }),
  ).toBeFocused();
  const close = dialog.getByRole("button", { name: "Close dialog" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("navigation reaches categories using the menu on mobile", async ({
  page,
}, testInfo) => {
  await openStore(page);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", { name: "Gaming", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#shop .product-card")).toHaveCount(1);
    await expect(page.locator("#shop .product-card")).toContainText(
      "PlayStation 5",
    );
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Shop all", exact: true })
      .click();
    await expect(page.locator("#shop .product-card")).toHaveCount(6);
  }
  await expectNoHorizontalOverflow(page);
});

test("contact inquiries reach the server and receive an acknowledged response", async ({
  page,
}, testInfo) => {
  await openStore(page);
  await page.getByRole("button", { name: "Get in touch", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name", { exact: true }).fill("QA Customer");
  await dialog
    .getByLabel("Email address", { exact: true })
    .fill(`qa-contact-${testInfo.project.name}-${Date.now()}@example.com`);
  await dialog
    .getByLabel("Your message", { exact: true })
    .fill(
      "Automated local QA inquiry: please confirm delivery availability for Baku.",
    );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/contact") &&
      response.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Send your message", exact: true })
    .click();
  expect((await responsePromise).ok()).toBe(true);
  await expect(dialog.locator(".form-status")).toContainText(
    "Your message has been received",
  );
  await expect(dialog.getByLabel("Your message", { exact: true })).toHaveValue(
    "",
  );
});

test("subscription failures are shown accurately and invalid form payloads are rejected", async ({
  page,
}) => {
  await openStore(page);
  const invalidNewsletter = await page.request.post("/api/newsletter", {
    data: { email: "invalid-email" },
  });
  expect(invalidNewsletter.status()).toBe(400);
  expect(await invalidNewsletter.json()).toHaveProperty("error");
  const invalidInquiry = await page.request.post("/api/contact", {
    data: { name: "Q", email: "valid@example.com", message: "short" },
  });
  expect(invalidInquiry.status()).toBe(400);
  expect(await invalidInquiry.json()).toHaveProperty("error");
  await page.route("**/api/newsletter", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "We couldn't save your email. Please try again shortly." },
    }),
  );
  await page
    .getByRole("textbox", { name: "Your email address", exact: true })
    .fill("qa-server-unavailable@example.com");
  await page
    .getByRole("button", { name: "Join the newsletter", exact: true })
    .click();
  await expect(page.locator(".newsletter-status")).toContainText(
    "We couldn't save your email",
  );
  await expect(
    page.getByRole("textbox", { name: "Your email address", exact: true }),
  ).toHaveValue("qa-server-unavailable@example.com");
  await expect(page.locator(".newsletter-status")).not.toContainText(
    "You're on the list",
  );
});

test("compact phones and tablets have no horizontal page overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Additional responsive sizes are verified in the mobile project.",
  );
  await openStore(page);
  await page
    .getByRole("button", { name: "Explore all products", exact: true })
    .click();
  await expect(page.locator("#shop .product-card")).toHaveCount(6);
  for (const width of [320, 360, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            width: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
          })),
        { message: `The page must fit a ${width}px viewport` },
      )
      .toEqual({ width, documentWidth: width });
  }
});

test("reopening an old paid confirmation preserves the current shopping bag", async ({
  page,
}) => {
  await openStore(page);
  const currentBag = [
    { id: "iphone-16-pro", quantity: 2 },
    { id: "airpods-pro-2", quantity: 1 },
  ];
  await page.evaluate(
    (items) =>
      localStorage.setItem("dubai-electronics-cart", JSON.stringify(items)),
    currentBag,
  );
  // Only the provider lookup is stubbed: this verifies client-side storage safety,
  // while the server's authenticated lookup is covered by the checkout tests.
  await page.route("**/api/orders/status?*", (route) =>
    route.fulfill({
      json: { status: "paid", orderId: "cs_test_old_confirmation" },
    }),
  );
  await page.goto("/order?session_id=cs_test_old_confirmation");
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dubai-electronics-cart") || "[]"),
    ),
  ).toEqual(currentBag);
  await expectNoHorizontalOverflow(page);
});

test("a matching paid receipt subtracts purchased quantities and preserves later additions", async ({
  page,
}) => {
  await openStore(page);
  const sessionId = "cs_test_current_confirmation";
  await page.evaluate((id) => {
    localStorage.setItem(
      "dubai-electronics-cart",
      JSON.stringify([
        { id: "iphone-16-pro", quantity: 3 },
        { id: "airpods-pro-2", quantity: 2 },
      ]),
    );
    sessionStorage.setItem(
      "dubai-electronics-pending-checkout",
      JSON.stringify({
        sessionId: id,
        items: [{ id: "iphone-16-pro", quantity: 2 }],
      }),
    );
  }, sessionId);
  await page.route("**/api/orders/status?*", (route) =>
    route.fulfill({ json: { status: "paid", orderId: sessionId } }),
  );
  await page.goto(`/order?session_id=${sessionId}`);
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toBeVisible();
  const expectedBag = [
    { id: "iphone-16-pro", quantity: 1 },
    { id: "airpods-pro-2", quantity: 2 },
  ];
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dubai-electronics-cart") || "[]"),
    ),
  ).toEqual(expectedBag);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("dubai-electronics-pending-checkout"),
    ),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByText("Payment confirmed", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dubai-electronics-cart") || "[]"),
    ),
  ).toEqual(expectedBag);
});
