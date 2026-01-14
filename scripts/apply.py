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

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown on the LOGIN page using the Code (e.g., 13700)."""
    try:
        logger.info(f"Step: Opening DP dropdown to search for {bank_code}...")
        # Click the 'Select your DP' box
        await page.click("span.select2-selection--single")
        await page.wait_for_timeout(500)
        
        # Type the code into the search field
        logger.info(f"Step: Typing code {bank_code}...")
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(str(bank_code))
        await page.wait_for_timeout(1000) # Wait for filtering
        
        # Click the option that contains the code in parentheses
        # This matches the "(13700)" format in your image
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
        # ignore_https_errors is vital for government/financial sites
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        
        # 1. Login Page
        logger.info(f"--- Starting Account: {account.get('username')} ---")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        
        # 2. Select DP (Bank)
        if not await select_login_dp(page, account['dp']):
            return False

        # 3. Enter Credentials
        logger.info("Step: Entering username and password...")
        await page.fill("#username", str(account['username']))
        await page.fill("#password", str(account['password']))
        await page.click("button[type='submit']")
        
        # 4. Verify Login Success (Wait for sidebar)
        try:
            await page.wait_for_selector(".side-menu", timeout=15000)
            logger.info("SUCCESS: Logged in and reached Dashboard.")
        except:
            logger.error("FAIL: Login failed. Check if username/password or DP is correct.")
            return False

        # 5. Navigate to ASBA
        logger.info("Step: Navigating to ASBA section...")
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(2000)

        # 6. Find and Click Apply
        logger.info("Step: Searching for active 'Ordinary Shares'...")
        apply_btn = page.locator("tr:has-text('Ordinary Shares') button:has-text('Apply')").first
        
        if await apply_btn.is_visible():
            await apply_btn.click()
            logger.info("SUCCESS: IPO Application form opened.")
            await page.wait_for_timeout(2000)
        else:
            logger.warning("FAIL: No active 'Ordinary Shares' found to apply for.")
            return False

        # 7. Final Form Filling (Optional: add your Units, CRN, PIN logic here if needed)
        # ...
        
        return True
    except Exception as e:
        logger.error(f"CRITICAL ERROR for {account.get('username')}: {str(e)}")
        return False
    finally:
        if context:
            await context.close()

async def main():
    try:
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)
        
        async with async_playwright() as p:
            token = os.getenv('BROWSERLESS_TOKEN')
            if token:
                logger.info("Connecting to Browserless (CDP Mode)...")
                endpoint = f"wss://production-sfo.browserless.io?token={token}"
                browser = await p.chromium.connect_over_cdp(endpoint)
            else:
                logger.info("Running locally...")
                browser = await p.chromium.launch(headless=False) # Headless=False helps you see it locally
            
            try:
                for account in accounts:
                    await process_account(browser, account)
                    await asyncio.sleep(random.uniform(2, 5))
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"FATAL ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())