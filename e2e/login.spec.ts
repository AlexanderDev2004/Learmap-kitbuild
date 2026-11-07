import { test, expect } from "@playwright/test";

import {
	fillSignupAccountStep,
	fillSignupAcademicStep,
	fillSignupPersonalStep,
	logout,
	whitelistAccounts,
} from "./signup-helpers";

// Signup auto-logs the user in, so tests that exercise the login form itself
// must log out first.
async function createAccount(page: import("@playwright/test").Page, index: number) {
	const account = whitelistAccounts[index];
	await page.goto("/signup");
	await fillSignupAccountStep(page, account);
	await page.locator('button:has-text("Next")').click();
	await fillSignupPersonalStep(page, { age: "20" });
	await page.locator('button:has-text("Next")').click();
	await fillSignupAcademicStep(page);
	await page.locator('button:has-text("Next")').click();
	await page.locator("#consentGiven").click();
	await page.locator('button:has-text("Create Account")').click();
	await expect(page).toHaveURL("/dashboard/assignments");
	return account;
}

test.describe("Login - Basic Flows", () => {
	test("should login as student and redirect to assignments", async ({ page }) => {
		const account = await createAccount(page, 5);
		await logout(page);
		await page.goto("/login");
		await page.locator("#studentId").fill(account.studentId);
		await page.locator("#password").fill(account.password);
		await page.locator('button[type="submit"]').click();

		await expect(page).toHaveURL("/dashboard/assignments");
		await expect(page.locator("body")).toContainText("Assignments");
	});

	test("should login as teacher with email and redirect to dashboard", async ({ page }) => {
		await page.goto("/login");
		await page.locator("#studentId").fill("banni@kitbuild.mail");
		await page.locator("#password").fill("banni12345");
		await page.locator('button[type="submit"]').click();

		await expect(page).toHaveURL("/dashboard");
		await expect(page.locator("body")).toContainText("Topics");
	});

	test("should show loading state during submit", async ({ page }) => {
		const account = await createAccount(page, 6);
		await logout(page);
		await page.goto("/login");
		await page.locator("#studentId").fill(account.studentId);
		await page.locator("#password").fill(account.password);

		const submitButton = page.locator('button[type="submit"]');
		await submitButton.click();
		await expect(submitButton).toContainText("Signing in...");
	});

	test("should persist session on page reload", async ({ page }) => {
		await createAccount(page, 7);
		await page.reload();
		await expect(page).toHaveURL("/dashboard/assignments");
	});
});

test.describe("Login - Validation Errors", () => {
	test("should show error for empty identifier", async ({ page }) => {
		await page.goto("/login");
		await page.waitForSelector("#password");
		await page.locator("#password").fill("demo12345");
		await page.locator('button[type="submit"]').click();
		await expect(
			page.locator(
				"text=Unable to sign in. Please verify your student ID / email and password.",
			),
		).toBeVisible();
	});

	test("should keep submit disabled when password is empty", async ({ page }) => {
		await page.goto("/login");
		await page.waitForSelector("#studentId");
		await page.locator("#studentId").fill("20260099");
		await expect(page.locator('button[type="submit"]')).toBeDisabled();
	});

	test("should show error for wrong password", async ({ page }) => {
		const account = await createAccount(page, 8);
		await logout(page);
		await page.goto("/login");
		await page.waitForSelector("#studentId");
		await page.locator("#studentId").fill(account.studentId);
		await page.locator("#password").fill("wrongpassword");
		await page.locator('button[type="submit"]').click();
		await expect(
			page.locator(
				"text=Unable to sign in. Please verify your student ID / email and password.",
			),
		).toBeVisible();
	});

	test("should clear error when user fixes input", async ({ page }) => {
		const account = await createAccount(page, 9);
		await logout(page);
		await page.goto("/login");
		await page.waitForSelector("#studentId");
		await page.locator("#studentId").fill(account.studentId);
		await page.locator("#password").fill("wrongpassword");
		await page.locator('button[type="submit"]').click();
		await expect(
			page.locator(
				"text=Unable to sign in. Please verify your student ID / email and password.",
			),
		).toBeVisible();

		await page.locator("#password").fill(account.password);
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL("/dashboard/assignments");
	});
});
