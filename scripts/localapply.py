import asyncio
import json
import os
import sys
import random
import logging

# Setup Logging - Stream to stderr so the Next.js Relay catches it
logging.basicConfig(
    level=logging.INFO, 
    format='%(levelname)s: %(message)s', 
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed. Run: pip install playwright")
    sys.exit(1)

async def handle_logout(page):
    """Resets the session for the next account"""
    try:
        logger.info("Step: Attempting to logout...")
        logout_selector = "li.header-menu__item--logout-desktop-view a.nav-link"
        await page.wait_for_selector(logout_selector, timeout=5000)
        await page.click(logout_selector)
        await page.wait_for_url("**/#/login", timeout=10000)
        logger.info("Successfully logged out.")
        return True
    except Exception:
        return False

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown on the login page"""
    try:
        logger.info(f"Step: Selecting DP {bank_code}...")
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(800) 
        option_locator = page.locator(f"li.select2-results__option:has-text('({bank_code})')")
        if await option_locator.is_visible():
            await option_locator.click()
            return True
        return False
    except Exception:
        return False

async def process_account(browser, account):
    """Main Application Logic"""
    context = None
    username = str(account.get('username'))
    try:
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        # 1. Login Phase
        logger.info(f"--- Starting Account: {username} ---")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        if not await select_login_dp(page, account['dp']): 
            logger.error(f"FAIL: DP selection failed for {username}")
            return False

        await page.fill("#username", username)
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("✅ Login Successful!")

        # 2. Navigation to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        logger.info("✅ Directed to ASBA")
        await page.wait_for_timeout(2000)

        # 3. Identify IPO Row
        ipo_row = page.locator(".company-list", has=page.locator("span.isin", has_text="Ordinary Shares")).first
        if await ipo_row.count() == 0:
            logger.warning(f"FAIL: No Ordinary Shares found for {username}")
            await handle_logout(page)
            return False

        apply_btn = ipo_row.locator("button.btn-issue:has-text('Apply')")
        #edit_btn = ipo_row.locator("button.btn-issue:has-text('Edit')")

        if await apply_btn.is_visible():
            await apply_btn.click()
            
            # Form Filling
            await page.wait_for_selector("#selectBank", state="visible")
            await page.select_option("#selectBank", index=1)
            
            # Wait for Account Number to load
            await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
            await page.select_option("#accountNumber", index=1)
            
            # -----------------------------------------------------------
            # OPTIONAL BRANCH HANDLING (COMMENTED OUT AS REQUESTED)
            # -----------------------------------------------------------
            # await page.wait_for_timeout(1000)
            # await page.input_value('#selectBranch')
            # -----------------------------------------------------------
            
            # Pause to allow auto-calculation of branch/amount
            await page.wait_for_timeout(1500)
            
            # Fill Kitta (Units) & Trigger Validation
            await page.fill("#appliedKitta", str(account['units']))
            await page.focus("#appliedKitta")
            await page.keyboard.press("Tab")
            await page.locator("#appliedKitta").dispatch_event("blur")
            
            # CRN and Submit
            await page.fill("#crnNumber", str(account['crn']))
            await page.check("#disclaimer", force=True)
            await page.click("button[type='submit']:has-text('Proceed')")
            
            # 4. PIN Screen
            await page.wait_for_selector("#transactionPIN", state="visible")
            await page.fill("#transactionPIN", str(account['pin']))
            await page.click("button[type='submit']:has-text('Apply')")
            
            # Final Confirmation Wait
            await page.wait_for_timeout(2000)
            logger.info(f"🚀 SUCCESS: IPO submitted for {username}")
            
        else:
            logger.info(f"SKIP: Already applied for {username}")

        await handle_logout(page)
        return True

    except Exception as e:
        logger.error(f"❌ ERROR for {username}: {str(e)}")
        
        # ERROR SCREENSHOT (COMMENTED OUT)
        # if context:
        #    page = context.pages[0]
        #    await page.screenshot(path=f"FAILED_{username}.png")
        
        return False
    finally:
        if context: await context.close()

async def main():
    try:
        # Check if running locally (args) or GitHub (env)
        if len(sys.argv) > 1:
            accounts = json.loads(sys.argv[1])
            is_headless = False # Visible browser locally
        else:
            accounts = json.loads(os.getenv('ACCOUNTS_JSON', '[]'))
            is_headless = True # Silent in Cloud

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=is_headless)
            for account in accounts:
                await process_account(browser, account)
                # Random delay to prevent bot detection
                await asyncio.sleep(random.uniform(3, 6))
            
            await browser.close()
            logger.info("--- FINISHED ---")

    except Exception as e:
        logger.error(f"FATAL: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())