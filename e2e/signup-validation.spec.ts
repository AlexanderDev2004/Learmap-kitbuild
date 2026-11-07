import { test, expect } from "@playwright/test";

import {
	fillSignupAccountStep,
	fillSignupAcademicStep,
	fillSignupPersonalStep,
	selectWhitelistAccount,
	whitelistAccounts,
} from "./signup-helpers";

const ACC = whitelistAccounts[17];

test.describe("Signup - Step 1 Validation", () => {
	test("should keep next disabled when student id is empty", async ({ page }) => {
		await page.goto("/signup");
		await page.locator("#password").fill("password123");
		await page.locator("#confirmPassword").fill("password123");
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
	});

	test("should keep next disabled when password is empty", async ({ page }) => {
		await page.goto("/signup");
		await selectWhitelistAccount(page, ACC);
		await page.locator("#confirmPassword").fill("password123");
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
	});

	test("should keep next disabled when confirm password is empty", async ({ page }) => {
		await page.goto("/signup");
		await selectWhitelistAccount(page, ACC);
		await page.locator("#password").fill("password123");
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
	});
});

test.describe("Signup - Step 2 Validation", () => {
	test("should keep next disabled when age is missing", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, ACC);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
	});
});

test.describe("Signup - Step 3 Validation", () => {
	test("should require cohort selection before continuing", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, ACC);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
		await fillSignupAcademicStep(page);
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});
});

test.describe("Signup - Step 4 Validation", () => {
	test("should require consent checkbox", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, ACC);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator('button:has-text("Create Account")')).toBeDisabled();
	});

	test("should enable submit after consent click", async ({ page }) => {
		await page.goto("/signup");
		await fillSignupAccountStep(page, ACC);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();
		await expect(page.locator('button:has-text("Create Account")')).toBeDisabled();
		await page.locator("#consentGiven").click();
		await expect(page.locator('button:has-text("Create Account")')).toBeEnabled();
	});
});

test.describe("Signup - Error Recovery", () => {
	test("should clear password mismatch by fixing confirm password", async ({ page }) => {
		await page.goto("/signup");
		await selectWhitelistAccount(page, ACC);
		await page.locator("#password").fill("recovery123");
		await page.locator("#confirmPassword").fill("wrong");
		await expect(page.locator('button:has-text("Next")')).toBeDisabled();
		await page.locator("#confirmPassword").fill("recovery123");
		await expect(page.locator('button:has-text("Next")')).toBeEnabled();
	});
});
