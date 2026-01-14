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

async def logout_user(page):
    """Safely logs out the user using the direct desktop logout link from the DOM."""
    try:
        logger.info("Step: Attempting Logout...")
        # Direct selector based on the DOM you provided
        logout_btn = page.locator(".header-menu__item--logout-desktop-view a")
        
        if await logout_btn.is_visible():
            await logout_btn.click()
            # Wait for login page to confirm logout
            await page.wait_for_selector("#username", timeout=10000)
            logger.info("✅ Logged out successfully.")
        else:
            logger.warning("Logout button not visible, forcing redirect to login.")
            await page.goto("https://meroshare.cdsc.com.np/#/login")
    except Exception as e:
        logger.warning(f"Logout failed: {e}")
        # Final safety fallback to clear state
        await page.goto("https://meroshare.cdsc.com.np/#/login")

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown on the LOGIN page."""
    try:
        logger.info(f"Step: Selecting DP code {bank_code}...")
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
    except Exception as e:
        logger.error(f"DP Selection Error: {str(e)}")
        return False

async def process_account(browser, account):
    """Core logic to apply for IPO and then logout."""
    context = None
    try:
        # Create a completely fresh context per account
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()
        
        # 1. Login
        logger.info(f"--- Processing: {account.get('username')} ---")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        
        if not await select_login_dp(page, account['dp']):
            return False

        await page.fill("#username", str(account['username']))
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        
        await page.wait_for_selector(".navbar", timeout=20000)
        logger.info("✅ Login Successful.")

        # 2. Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(3000) 

        # 3. Locate Ordinary Shares Row
        row_selector = "tr:has(span.isin:has-text('Ordinary Shares'))"
        apply_btn = page.locator(f"{row_selector} button.btn-issue:has-text('Apply')").first
        
        if await apply_btn.is_visible():
            await apply_btn.click()
            logger.info("✅ Apply form opened.")
        else:
            logger.warning("❌ 'Apply' button not found. Already applied or session issue.")
            await logout_user(page)
            return False

        # 4. Form Filling (Wizard Step 1)
        await page.wait_for_selector("#selectBank", state="visible")
        await page.select_option("#selectBank", index=1)
        
        # Account Selection
        await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
        await page.select_option("#accountNumber", index=1)
        
        await page.wait_for_timeout(1000)
        
        # Units and Amount Calculation
        await page.fill("#appliedKitta", str(account['units']))
        await page.focus("#appliedKitta")
        await page.keyboard.press("Tab") 
        await page.locator("#appliedKitta").dispatch_event("blur")
        
        await page.wait_for_timeout(1000)
        amount = await page.input_value("#amount")
        logger.info(f"Step: Units {account['units']} -> NPR {amount}")

        # CRN & Disclaimer
        await page.fill("#crnNumber", str(account['crn']))
        await page.check("#disclaimer", force=True)
        
        await page.click("button[type='submit']:has-text('Proceed')")

        # 5. PIN & Final Submit (Wizard Step 2)
        await page.wait_for_selector("#transactionPIN", state="visible")
        await page.fill("#transactionPIN", str(account['pin']))
        
        # FINAL SUBMIT
        await page.click("button[type='submit']:has-text('Apply')")
        await page.wait_for_timeout(2000)
        logger.info(f"🚀 SUCCESS: IPO applied for {account['username']}!")
        
        # --- LOGOUT BEFORE NEXT ACCOUNT ---
        await logout_user(page)
        return True

    except Exception as e:
        logger.error(f"ERROR for {account.get('username')}: {str(e)}")
        try:
            await logout_user(page)
        except:
            pass
        return False
    finally:
        if context:
            await context.close()

async def main():
    try:
        # Load accounts and token from environment variables
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)
        token = os.getenv('BROWSERLESS_TOKEN')

        if not token:
            logger.error("BROWSERLESS_TOKEN is missing!")
            return

        async with async_playwright() as p:
            logger.info("Connecting to Browserless.io...")
            endpoint = f"wss://production-sfo.browserless.io?token={token}"
            browser = await p.chromium.connect_over_cdp(endpoint)
            
            for account in accounts:
                await process_account(browser, account)
                # Random delay to prevent IP blocking/detection
                await asyncio.sleep(random.uniform(5, 10))
            
            await browser.close()
            logger.info("🏁 All accounts processed. Browser closed.")
    except Exception as e:
        logger.info(f"FATAL SYSTEM ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())