import { test, expect } from "@playwright/test";

test.describe('User registration', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/register');
        await expect(page.getByTestId("email")).toBeVisible()
        await expect(page.getByTestId("password")).toBeVisible()
    });


    test("A new email and a valid password create an account (AC-30, AC-34)", async ({ page }) => {
        
    });
});