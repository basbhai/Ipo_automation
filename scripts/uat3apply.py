import asyncio
import json
import os
import sys
import random
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed.")
    sys.exit(1)

async def handle_logout(page):
    """Handles the logout process using the provided DOM structure."""
    try:
        logger.info("Step: Attempting to logout...")
        # Targeting the desktop logout link specifically
        logout_selector = "li.header-menu__item--logout-desktop-view a.nav-link"
        
        await page.wait_for_selector(logout_selector, timeout=5000)
        await page.click(logout_selector)
        
        # Wait for the URL to return to the login page to confirm logout
        await page.wait_for_url("**/#/login", timeout=10000)
        logger.info("Successfully logged out.")
        return True
    except Exception as e:
        logger.warning(f"Logout failed or timed out (might already be logged out): {str(e)}")
        return False

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown on the LOGIN page."""
    try:
        logger.info(f"Step: Opening DP dropdown to search for {bank_code}...")
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)
        
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(1000) 
        
        option_locator = page.locator(f"li.select2-results__option:has-text('({bank_code})')")
        
        if await option_locator.is_visible():
            await option_locator.click()
            logger.info(f"SUCCESS: DP {bank_code} selected.")
            return True
        else:
            logger.error(f"FAIL: Could not find DP result for code {bank_code}.")
            return False
    except Exception as e:
        logger.error(f"EXCEPTION selecting DP: {str(e)}")
        return False

async def process_account(browser, account):
    context = None
    try:
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        # 1. Login
        logger.info(f"--- Starting Account: {account.get('username')} ---")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        
        if not await select_login_dp(page, account['dp']):
            return False

        await page.fill("#username", str(account['username']))
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        
        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("✅ Login Successful!")

        # 2. Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 3. Find Ordinary Share & Click Apply

        ipo_row = page.locator(".company-list", has=page.locator("span.isin", has_text="Ordinary Shares")).first
        
        # Check if row exists first
        if await ipo_row.count() == 0:
            logger.warning("FAIL: No active 'Ordinary Shares' found in the list.")
            await handle_logout(page)
            return False

        # Define locators for both buttons
        apply_btn = ipo_row.locator("button.btn-issue:has-text('Apply')")
        edit_btn = ipo_row.locator("button.btn-issue:has-text('Edit')")

        if await apply_btn.is_visible():
            await apply_btn.click()
            logger.info("SUCCESS: Apply form opened.")
        elif await edit_btn.is_visible():
            logger.info("SKIP: IPO already applied for this account (found 'Edit' button).")
            await handle_logout(page)
            return True # Returning True because the goal (applying) is effectively met
        else:
            logger.warning("FAIL: Found 'Ordinary Shares' but neither 'Apply' nor 'Edit' buttons are visible.")
            await handle_logout(page)
            return False

        # 4. Wizard Step 1: Form Filling
        await page.wait_for_selector("#selectBank", state="visible")
        await page.select_option("#selectBank", index=1)
        
        await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
        await page.select_option("#accountNumber", index=1)
        
        await page.wait_for_timeout(1000)
        branch = await page.input_value("#selectBranch")
        logger.info(f"Step: Bank selected. Branch detected: {branch}")

        await page.fill("#appliedKitta", str(account['units']))
        await page.focus("#appliedKitta")
        await page.keyboard.press("Tab") 
        await page.locator("#appliedKitta").dispatch_event("blur")
        
        await page.wait_for_timeout(1000)
        amount = await page.input_value("#amount")
        logger.info(f"Step: Units {account['units']} entered. Total Amount: NPR {amount}")

        await page.fill("#crnNumber", str(account['crn']))
        await page.check("#disclaimer", force=True)
        
        await page.click("button[type='submit']:has-text('Proceed')")
        logger.info("Step: Proceeding to PIN screen...")

        # 5. Wizard Step 2: PIN & Final Submit
        await page.wait_for_selector("#transactionPIN", state="visible")
        await page.fill("#transactionPIN", str(account['pin']))
        
        await page.click("button[type='submit']:has-text('Apply')")
        await page.wait_for_timeout(2000)
        logger.info(f"🚀 SUCCESS: IPO submitted for {account['username']}!")
        
        # 6. Logout
        await handle_logout(page)
        return True

    except Exception as e:
        logger.error(f"CRITICAL ERROR for {account.get('username')}: {str(e)}")
        return False
    finally:
        if context:
            await context.close()

#============================= below is for githu action ===========================
#===================================================================================
async def main():
    try:
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)

        async with async_playwright() as p:
            logger.info("Launching local Chromium...")
            # Launch local browser in headless mode
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"]
            )
            
            try:
                for account in accounts:
                    await process_account(browser, account)
                    # Gentle delay between accounts
                    await asyncio.sleep(random.uniform(5, 10))
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"FATAL ERROR: {str(e)}")

#-----------------------Below is for Browserless.io==================================================
#====================================================================================================
# async def main():
#     try:
#         accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
#         accounts = json.loads(accounts_json)
#         token = os.getenv('BROWSERLESS_TOKEN')

#         if not token:
#             logger.error("BROWSERLESS_TOKEN is missing.")
#             return

#         async with async_playwright() as p:
#             logger.info("Connecting to Browserless.io...")
#             endpoint = f"wss://production-sfo.browserless.io?token={token}&timeout=3000000"
#             browser = await p.chromium.connect_over_cdp(endpoint)
            
#             try:
#                 for account in accounts:
#                     await process_account(browser, account)
#                     # Gentle delay between accounts
#                     await asyncio.sleep(random.uniform(5, 10))
#             finally:
#                 await browser.close()
#     except Exception as e:
#         logger.error(f"FATAL ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())