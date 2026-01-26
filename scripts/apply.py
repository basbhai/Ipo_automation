import asyncio
import json
import os
import sys
import random
import logging

# -------------------- Logging --------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# -------------------- Playwright Import --------------------
try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed.")
    sys.exit(1)

# -------------------- Logout Handler --------------------
async def handle_logout(page):
    try:
        logger.info("Step: Attempting logout...")
        logout_selector = "li.header-menu__item--logout-desktop-view a.nav-link"
        await page.wait_for_selector(logout_selector, timeout=5000)
        await page.click(logout_selector)
        await page.wait_for_url("**/#/login", timeout=10000)
        logger.info("Logout successful.")
        return True
    except Exception as e:
        logger.warning(f"Logout skipped or failed: {e}")
        return False

# -------------------- DP Selection --------------------
async def select_login_dp(page, bank_code):
    try:
        logger.info(f"Selecting DP: {bank_code}")
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)

        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(1000)

        option = page.locator(
            f"li.select2-results__option:has-text('({bank_code})')"
        )

        if await option.is_visible():
            await option.click()
            logger.info("DP selected.")
            return True

        logger.error("DP not found.")
        return False

    except Exception as e:
        logger.error(f"DP selection error: {e}")
        return False

# -------------------- Account Processor --------------------
async def process_account(browser, account):
    context = None
    try:
        context = await browser.new_context(
            ignore_https_errors=True,
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()

        logger.info(f"===== Processing {account['username']} =====")

        # -------- Login --------
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
        logger.info("Login successful.")

        # -------- Navigate to ASBA --------
        await page.goto(
            "https://meroshare.cdsc.com.np/#/asba",
            wait_until="networkidle"
        )
        await page.wait_for_timeout(2000)

        # -------- Locate IPO Row (ROBUST) --------
        ipo_row = page.locator(
            ".company-list",
            has=page.locator("span.isin:has-text('Ordinary')")
        ).filter(
            has=page.locator("span.share-of-type:has-text('IPO')")
        ).first

        if await ipo_row.count() == 0:
            logger.warning("No active Ordinary IPO found.")
            await handle_logout(page)
            return False

        # -------- Apply / Edit Button Detection --------
        apply_btn = ipo_row.locator(
            "button.btn-issue i:has-text('Apply')"
        ).locator("..")

        edit_btn = ipo_row.locator(
            "button.btn-issue i:has-text('Edit')"
        ).locator("..")

        if await apply_btn.is_visible():
            await apply_btn.click()
            logger.info("Apply button clicked.")
        elif await edit_btn.is_visible():
            logger.info("IPO already applied. Skipping.")
            await handle_logout(page)
            return True
        else:
            logger.warning("Apply/Edit button not found.")
            await handle_logout(page)
            return False

        # -------- Wizard Step 1 --------
        await page.wait_for_selector("#selectBank", state="visible")
        await page.select_option("#selectBank", index=1)

        await page.wait_for_selector(
            "#accountNumber option:not([value=''])",
            state="attached"
        )
        await page.select_option("#accountNumber", index=1)

        await page.wait_for_timeout(1000)
        branch = await page.input_value("#selectBranch")
        logger.info(f"Branch detected: {branch}")

        await page.fill("#appliedKitta", str(account["units"]))
        await page.keyboard.press("Tab")
        await page.wait_for_timeout(1000)

        amount = await page.input_value("#amount")
        logger.info(f"Units: {account['units']} | Amount: {amount}")

        await page.fill("#crnNumber", str(account["crn"]))
        await page.check("#disclaimer", force=True)

        await page.click("button[type='submit']:has-text('Proceed')")
        logger.info("Proceeding to PIN screen.")

        # -------- Wizard Step 2 --------
        await page.wait_for_selector("#transactionPIN", state="visible")
        await page.fill("#transactionPIN", str(account["pin"]))
        await page.click("button[type='submit']:has-text('Apply')")

        await page.wait_for_timeout(2000)
        logger.info(f"IPO successfully submitted for {account['username']}")

        # -------- Logout --------
        await handle_logout(page)
        return True

    except Exception as e:
        logger.error(f"CRITICAL ERROR ({account['username']}): {e}")
        return False

    finally:
        if context:
            await context.close()

# -------------------- Main (GitHub Actions / Local) --------------------
async def main():
    try:
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

    except Exception as e:
        logger.error(f"FATAL ERROR: {e}")

# -------------------- Entry --------------------
if __name__ == "__main__":
    asyncio.run(main())
