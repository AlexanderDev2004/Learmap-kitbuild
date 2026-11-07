import { test, expect } from "@playwright/test";

import {
	completeConsentStep,
	fillSignupAccountStep,
	fillSignupAcademicStep,
	fillSignupPersonalStep,
	whitelistAccounts,
} from "./signup-helpers";

test.describe.configure({ mode: "serial" });

test.describe("Student Complete Learning Flow", () => {
	test("should sign up, log in, and reach assignments", async ({ page }) => {
		const account = whitelistAccounts[18];
		await page.goto("/signup");
		await fillSignupAccountStep(page, account);
		await page.locator('button:has-text("Next")').click();
		await fillSignupPersonalStep(page, { age: "20" });
		await page.locator('button:has-text("Next")').click();
		await fillSignupAcademicStep(page);
		await page.locator('button:has-text("Next")').click();
		await completeConsentStep(page);
		await page.locator('button:has-text("Create Account")').click();

		await expect(page).toHaveURL("/dashboard/assignments");
	});
});
