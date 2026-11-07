import { test, expect } from "@playwright/test";

import {
	completeConsentStep,
	fillSignupAccountStep,
	fillSignupAcademicStep,
	fillSignupPersonalStep,
	selectWhitelistAccount,
	whitelistAccounts,
} from "./signup-helpers";

test.describe.configure({ mode: "serial" });

const TEST_ACCOUNT_1 = whitelistAccounts[10];
const TEST_ACCOUNT_2 = whitelistAccounts[11];

test.describe("Signup - Complete Flow", () => {
	test("should complete full signup wizard and auto-login", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, TEST_ACCOUNT_1);
		await page.locator('button:has-text("Next")').click();

		await fillSignupPersonalStep(page, { age: "21" });
		await page.locator('button:has-text("Next")').click();

		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();

		await completeConsentStep(page);
		await page.locator('button:has-text("Create Account")').click();

		await expect(page.locator("text=Account created successfully")).toBeVisible();
		await expect(page).toHaveURL("/dashboard/assignments");
	});

	test("should be authenticated with newly created account", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, TEST_ACCOUNT_2);
		await page.locator('button:has-text("Next")').click();

		await fillSignupPersonalStep(page, { age: "19" });
		await page.locator('button:has-text("Next")').click();

		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();

		await completeConsentStep(page);
		await page.locator('button:has-text("Create Account")').click();
		await expect(page).toHaveURL("/dashboard/assignments");
	});

	test("should show progress indicator through all steps", async ({ page }) => {
		await page.goto("/signup");
		await expect(page.locator("text=Whitelist").locator("visible=true").first()).toBeVisible();

		await fillSignupAccountStep(page, whitelistAccounts[0]);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator("text=Personal").locator("visible=true").first()).toBeVisible();

		await fillSignupPersonalStep(page, { age: "25" });
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator("text=Academic").locator("visible=true").first()).toBeVisible();

		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator("text=Consent").locator("visible=true").first()).toBeVisible();
	});

	test("should navigate back through steps", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[1]);
		await page.locator('button:has-text("Next")').click();

		await fillSignupPersonalStep(page, { age: "23" });
		await page.locator('button:has-text("Next")').click();

		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Previous")').click();
		await page.locator('button:has-text("Previous")').click();

		await expect(page.locator("#password")).toHaveValue(whitelistAccounts[1].password);
	});

	test("should disable navigation buttons appropriately", async ({ page }) => {
		await page.goto("/signup");
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();

		await selectWhitelistAccount(page, whitelistAccounts[2]);
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();

		await page.locator("#password").fill("complete123");
		await page.locator("#confirmPassword").fill("complete123");
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});
});

test.describe("Signup - Animation/Interaction", () => {
	test("should show step transition animations", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[3]);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator("text=Personal").locator("visible=true").first()).toBeVisible();
	});

	test("should handle rapid button clicks", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[4]);
		const nextButton = page.locator('button:has-text("Next")');
		await nextButton.click();
		// Extra rapid clicks land on a disabled button and must not skip or break the wizard
		await nextButton.click({ force: true }).catch(() => {});
		await expect(page.locator("text=Personal").locator("visible=true").first()).toBeVisible();
	});
});
