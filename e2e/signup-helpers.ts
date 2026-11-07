import type { Page } from "@playwright/test";

export type WhitelistAccount = {
	studentId: string;
	name: string;
	password: string;
};

// Matches the e2e whitelist entries inserted by scripts/seed (student IDs
// 98000001-98000020). Entries get consumed by signup, so each spec uses a
// distinct account.
export const whitelistAccounts: WhitelistAccount[] = Array.from({ length: 20 }, (_, i) => {
	const n = String(i + 1).padStart(2, "0");
	return {
		studentId: `980000${n}`,
		name: `E2E Student ${n}`,
		password: "password123",
	};
});

export async function selectWhitelistAccount(
	page: Page,
	account: Pick<WhitelistAccount, "studentId" | "name">,
) {
	await page.locator('[data-slot="popover-trigger"]').first().click();
	await page.getByPlaceholder("Search Name (ID)...").fill(account.name);
	await page.getByRole("option", { name: `${account.name} (${account.studentId})` }).click();
}

export async function fillSignupAccountStep(page: Page, account: WhitelistAccount) {
	await selectWhitelistAccount(page, account);
	await page.locator("#password").fill(account.password);
	await page.locator("#confirmPassword").fill(account.password);
}

export async function fillSignupPersonalStep(page: Page, values: { age: string }) {
	await page.locator("#age").fill(values.age);
}

export async function fillSignupAcademicStep(page: Page, values: { cohort?: string } = {}) {
	await page.locator('button:has-text("Select your cohort")').click();
	if (values.cohort) {
		await page.getByText(values.cohort, { exact: true }).first().click();
	} else {
		// Any cohort satisfies the required field; avoid coupling specs to seed data.
		await page
			.locator("[role=option], [data-slot=select-item], [data-slot=command-item]")
			.first()
			.click();
	}
}

export async function completeConsentStep(page: Page) {
	await page.locator("#consentGiven").click();
}

export async function logout(page: Page) {
	const trigger = page.locator('button[aria-haspopup="menu"]').filter({ hasText: "@" });
	await trigger.click();
	await page.getByRole("menuitem", { name: "Log out" }).click();
	await page.waitForURL("**/login");
}

export async function loginWithStudentId(page: Page, studentId: string, password: string) {
	await page.goto("/login");
	await page.waitForSelector("#studentId");
	await page.locator("#studentId").fill(studentId);
	await page.locator("#password").fill(password);
	await page.locator('button[type="submit"]').click();
}
