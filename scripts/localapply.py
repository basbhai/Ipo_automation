import asyncio
import json
import os
import sys
import random
import logging

# Setup Logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(levelname)s: %(message)s', # Just "INFO: Message"
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)
try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed. Run: pip install playwright")
    sys.exit(1)

async def handle_logout(page):
    try:
        logger.info("Step: Attempting to logout...")
        logout_selector = "li.header-menu__item--logout-desktop-view a.nav-link"
        await page.wait_for_selector(logout_selector, timeout=5000)
        await page.click(logout_selector)
        await page.wait_for_url("**/#/login", timeout=10000)
        logger.info("Successfully logged out.")
        return True
    except Exception as e:
        logger.warning(f"Logout failed or timed out: {str(e)}")
        return False

async def select_login_dp(page, bank_code):
    try:
        logger.info(f"Step: Selecting DP {bank_code}...")
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(1000) 
        option_locator = page.locator(f"li.select2-results__option:has-text('({bank_code})')")
        if await option_locator.is_visible():
            await option_locator.click()
            return True
        return False
    except Exception:
        return False

async def process_account(browser, account):
    context = None
    try:
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        # 1. Login
        logger.info(f"--- Starting Account: {account.get('username')} ---")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        if not await select_login_dp(page, account['dp']): return False

        await page.fill("#username", str(account['username']))
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("✅ Login Successful!")

        # 2. Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        logger.info("✅ directed to asba")
        await page.wait_for_timeout(2000)

        # 3. Process IPO
        ipo_row = page.locator(".company-list", has=page.locator("span.isin", has_text="Ordinary Shares")).first
        if await ipo_row.count() == 0:
            logger.warning("FAIL: No Ordinary Shares found.")
            await handle_logout(page)
            return False

        apply_btn = ipo_row.locator("button.btn-issue:has-text('Apply')")
        edit_btn = ipo_row.locator("button.btn-issue:has-text('Edit')")
        

        if await apply_btn.is_visible():
            await apply_btn.click()
            # Wizard filling logic
            await page.wait_for_selector("#selectBank", state="visible")
            await page.select_option("#selectBank", index=1)
            await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
            await page.select_option("#accountNumber", index=1)
            await page.wait_for_timeout(1000)
            await page.input_value('#selectBranch')
            await page.fill("#appliedKitta", str(account['units']))
            await page.focus("#appliedKitta")
            await page.keyboard.press("Tab")
            await page.locator("#appliedKitta").dispatch_event("blur")
            await page.fill("#crnNumber", str(account['crn']))
            await page.check("#disclaimer", force=True)
            await page.click("button[type='submit']:has-text('Proceed')")
            
            # PIN screen
            await page.wait_for_selector("#transactionPIN", state="visible")
            await page.fill("#transactionPIN", str(account['pin']))
            await page.click("button[type='submit']:has-text('Apply')")
            logger.info(f"🚀 SUCCESS: IPO submitted for {account['username']}!")
        else:
            logger.info(f"SKIP: Already applied for {account['username']}")

        await handle_logout(page)
        return True
    except Exception as e:
        logger.error(f"CRITICAL ERROR: {str(e)}")
        return False
    finally:
        if context: await context.close()

async def main():
    try:
        # Check for Local Argument (Next.js) first, then Env Var (GitHub)
        if len(sys.argv) > 1:
            accounts = json.loads(sys.argv[1])
            is_headless = False # LOCAL: Watch the browser window pop up
        else:
            accounts = json.loads(os.getenv('ACCOUNTS_JSON', '[]'))
            is_headless = True # CLOUD: Run in background

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=is_headless)
            for account in accounts:
                await process_account(browser, account)
                await asyncio.sleep(random.uniform(3, 7))
            await browser.close()
    except Exception as e:
        logger.error(f"FATAL: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())