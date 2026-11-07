import { test, expect } from "@playwright/test";

import {
	fillSignupAccountStep,
	fillSignupAcademicStep,
	fillSignupPersonalStep,
	selectWhitelistAccount,
	whitelistAccounts,
} from "./signup-helpers";

test.describe("Signup - Step 1: Account", () => {
	test("should complete account step with valid data", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[0]);
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});

	test("should show error when passwords don't match", async ({ page }) => {
		await page.goto("/signup");
		await selectWhitelistAccount(page, whitelistAccounts[0]);
		await page.locator("#password").fill("password123");
		await page.locator("#confirmPassword").fill("differentpassword");
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
	});
});

test.describe("Signup - Step 2: Personal", () => {
	test("should complete personal step with required fields", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[2]);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});

	test("should fill optional fields in personal step", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[3]);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "22" });
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});
});

test.describe("Signup - Step 3: Academic", () => {
	test("should require academic details step to be valid", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[4]);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
	});

	test("should select study group from dropdown", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[19]);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await fillSignupAcademicStep(page);
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});
});

test.describe("Signup - Step 4: Consent", () => {
	test("should require consent checkbox", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, whitelistAccounts[1]);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator('button:has-text("Create Account")')).toBeDisabled();
	});
});
