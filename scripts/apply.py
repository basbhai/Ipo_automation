import asyncio
import json
import os
import sys
import random
import logging

# Enhanced Logging Setup
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed. Install with: pip install playwright")
    sys.exit(1)

async def fill_dp_field_with_select2(page, bank_dp_value):
    try:
        logger.info(f"Step: Opening DP dropdown for {bank_dp_value}")
        select2_container = page.locator("span.select2.select2-container--default")
        await select2_container.click()
        
        logger.info("Step: Typing bank name into search...")
        search_input = page.locator("input.select2-search__field")
        await search_input.fill(bank_dp_value)
        await page.wait_for_timeout(1000)
        
        matching_option = page.locator(".select2-results__option").filter(has_text=bank_dp_value).first
        if await matching_option.is_visible():
            await matching_option.click()
            logger.info(f"SUCCESS: Bank {bank_dp_value} selected.")
            return True
        else:
            logger.error(f"FAIL: Bank {bank_dp_value} not found in dropdown list.")
            return False
    except Exception as e:
        logger.error(f"EXCEPTION in DP field: {str(e)}")
        return False

async def process_account(browser, account):
    context = None
    try:
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        
        # 1. Login Page
        logger.info(f"--- Starting Account: {account.get('username')} ---")
        logger.info("Action: Navigating to Login Page...")
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle", timeout=60000)
        logger.info("Status: Login Page loaded successfully.")

        # 2. Perform Login
        logger.info(f"Action: Entering credentials for {account['username']}...")
        await page.fill("input[name='username']", account['username'])
        await page.fill("input[name='password']", account['password'])
        await page.click("button:has-text('Login')")
        
        # Verify Login Success
        await page.wait_for_load_state("networkidle")
        if "dashboard" in page.url or await page.locator(".side-menu").is_visible():
            logger.info("SUCCESS: Logged in successfully. Dashboard reached.")
        else:
            logger.warning("Check: Login might have failed or is slow.")

        # 3. Navigate to ASBA
        logger.info("Action: Navigating to ASBA (Apply for Issue) page...")
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        logger.info(f"Status: Currently on page: {page.url}")

        # 4. Find Apply Button
        logger.info("Action: Searching for 'Ordinary Shares' Apply button...")
        # We search for the row first to see if it exists
        row_locator = page.locator("//tr[contains(., 'Ordinary Shares')]")
        rows_count = await row_locator.count()
        
        if rows_count == 0:
            logger.error("FAIL: 'Ordinary Shares' row not found in the table. Is there an open IPO?")
            return False
            
        logger.info(f"Status: Found {rows_count} Ordinary Share row(s).")
        apply_button = row_locator.locator("button:has-text('Apply')").first
        
        if await apply_button.is_visible():
            logger.info("Action: Clicking Apply button...")
            await apply_button.click()
            await page.wait_for_load_state("networkidle")
            logger.info("Status: Application form opened.")
        else:
            logger.error("FAIL: Apply button exists but is not visible/clickable.")
            return False

        # 5. Fill Form
        logger.info("Action: Filling application details (Units, DP, CRN)...")
        await page.locator("input[name='units']").fill(str(account['units']))
        await fill_dp_field_with_select2(page, str(account['dp']))
        await page.locator("input[name='crn']").fill(str(account['crn']))
        
        logger.info("Action: Checking disclaimer...")
        await page.locator("input[type='checkbox'][name*='disclaimer']").first.check()
        
        # 6. Final PIN and Submit
        logger.info("Action: Entering Transaction PIN...")
        await page.locator("input[name='pin']").fill(str(account['pin']))
        
        logger.info("Action: Clicking final SUBMIT button...")
        await page.click("button:has-text('Submit')")
        
        # Wait for success message
        await page.wait_for_timeout(3000)
        logger.info(f"FINISH: Application submitted for {account['username']}.")
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
                logger.info("Connecting to Browserless.io (CDP Mode)...")
                endpoint = f"wss://production-sfo.browserless.io?token={token}"
                browser = await p.chromium.connect_over_cdp(endpoint)
            else:
                logger.info("Starting local browser...")
                browser = await p.chromium.launch(headless=True)
            
            try:
                for i, account in enumerate(accounts):
                    logger.info(f"\n=== ACCOUNT {i+1} OF {len(accounts)} ===")
                    await process_account(browser, account)
            finally:
                await browser.close()
    except Exception as e:
        logger.error(f"FATAL: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())