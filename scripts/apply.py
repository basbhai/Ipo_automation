import asyncio
import json
import os
import sys
import random
import logging

# ================= LOGGING =================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# ================= PLAYWRIGHT =================
try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed")
    sys.exit(1)

# ================= LOGOUT =================
async def handle_logout(page):
    try:
        logger.info("Logging out...")
        selector = "li.header-menu__item--logout-desktop-view a.nav-link"
        await page.wait_for_selector(selector, timeout=5000)
        await page.click(selector)
        await page.wait_for_url("**/#/login", timeout=10000)
        logger.info("Logout successful")
        return True
    except Exception as e:
        logger.warning(f"Logout skipped: {e}")
        return False

# ================= DP SELECTION =================
async def select_login_dp(page, dp_code):
    try:
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)

        search = page.locator("input.select2-search__field")
        await search.fill(str(dp_code))
        await page.wait_for_timeout(1000)

        option = page.locator(
            f"li.select2-results__option:has-text('({dp_code})')"
        )

        if await option.is_visible():
            await option.click()
            logger.info("DP selected")
            return True

        logger.error("DP not found")
        return False

    except Exception as e:
        logger.error(f"DP selection error: {e}")
        return False

# ================= ACCOUNT PROCESSOR =================
async def process_account(browser, account):
    context = None

    try:
        context = await browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()

        logger.info(f"===== {account['username']} =====")

        # ---------- LOGIN ----------
        await page.goto(
            "https://meroshare.cdsc.com.np/",
            wait_until="networkidle",
            timeout=60000
        )

        if not await select_login_dp(page, account["dp"]):
            return False

        await page.fill("#username", str(account["username"]))
        await page.fill("#password", str(account["password"]))
        await page.click("button[type='submit']")

        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("Login successful")

        # ---------- ASBA ----------
        await page.goto(
            "https://meroshare.cdsc.com.np/#/asba",
            wait_until="networkidle"
        )

        # ---------- WAIT FOR ANGULAR TEXT ----------
        await page.wait_for_selector(".company-list", timeout=20000)
        await page.wait_for_function(
            "() => document.querySelectorAll('.company-list span.isin').length > 0"
        )

        rows = page.locator(".company-list")
        total = await rows.count()
        logger.info(f"Found {total} issue rows")

        ipo_row = None

        for i in range(total):
            row = rows.nth(i)

            isin_text = (await row.locator("span.isin").inner_text()).strip().lower()
            share_type = (await row.locator("span.share-of-type").inner_text()).strip().lower()

            if "ordinary" in isin_text and "ipo" in share_type:
                ipo_row = row
                break

        if not ipo_row:
            logger.warning("No active Ordinary IPO found")
            await handle_logout(page)
            return False

        logger.info("Ordinary IPO located")

        # ---------- APPLY / EDIT ----------
        apply_btn = ipo_row.locator(
            "button.btn-issue i"
        ).filter(has_text="Apply").locator("..")

        edit_btn = ipo_row.locator(
            "button.btn-issue i"
        ).filter(has_text="Edit").locator("..")

        if await apply_btn.is_visible():
            await apply_btn.click()
            logger.info("Apply clicked")
        elif await edit_btn.is_visible():
            logger.info("Already applied")
            await handle_logout(page)
            return True
        else:
            logger.warning("Apply/Edit button missing")
            await handle_logout(page)
            return False

        # ---------- FORM STEP 1 ----------
        await page.wait_for_selector("#selectBank", state="visible")
        await page.select_option("#selectBank", index=1)

        await page.wait_for_selector(
            "#accountNumber option:not([value=''])",
            state="attached"
        )
        await page.select_option("#accountNumber", index=1)

        await page.fill("#appliedKitta", str(account["units"]))
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(1000)

        await page.fill("#crnNumber", str(account["crn"]))
        await page.check("#disclaimer", force=True)

        await page.click("button[type='submit']:has-text('Proceed')")

        # ---------- FORM STEP 2 ----------
        await page.wait_for_selector("#transactionPIN", state="visible")
        await page.fill("#transactionPIN", str(account["pin"]))
        await page.click("button[type='submit']:has-text('Apply')")

        await page.wait_for_timeout(2000)
        logger.info("IPO submitted successfully")

        # ---------- LOGOUT ----------
        await handle_logout(page)
        return True

    except Exception as e:
        logger.error(f"CRITICAL ERROR: {e}")
        return False

    finally:
        if context:
            await context.close()

# ================= MAIN =================
async def main():
    accounts_json = os.getenv("ACCOUNTS_JSON", "[]")
    accounts = json.loads(accounts_json)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )

        try:
            for account in accounts:
                await process_account(browser, account)
                await asyncio.sleep(random.uniform(5, 10))
        finally:
            await browser.close()

# ================= ENTRY =================
if __name__ == "__main__":
    asyncio.run(main())
