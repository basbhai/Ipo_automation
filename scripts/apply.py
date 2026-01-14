import asyncio
import json
import os
import sys
import random
from datetime import datetime
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
except ImportError:
    logger.error("Playwright not installed. Install with: pip install playwright")
    sys.exit(1)

async def fill_dp_field_with_select2(page, bank_dp_value):
    """Handles the Select2 search-and-select interaction for the DP (Bank) field."""
    try:
        logger.info(f"Attempting to fill DP field with value: {bank_dp_value}")
        
        # Find and click the Select2 container
        select2_container = page.locator("span.select2.select2-container--default")
        
        if not await select2_container.is_visible():
            logger.warning("Select2 container not visible, attempting to locate by aria-label")
            select2_container = page.locator('[aria-label="Search for option"]').first
        
        await select2_container.click()
        await page.wait_for_timeout(500)
        
        # Find search input
        search_input = page.locator(".select2-search__field, input.select2-search__field")
        if not await search_input.is_visible():
            await page.wait_for_selector("input.select2-search__field", timeout=5000)
            search_input = page.locator("input.select2-search__field")
        
        await search_input.fill(bank_dp_value)
        await page.wait_for_timeout(500)
        
        # Select matching option
        matching_option = page.locator(".select2-results__option").filter(has_text=bank_dp_value).first
        
        if await matching_option.is_visible():
            await matching_option.click()
            logger.info(f"Successfully selected DP: {bank_dp_value}")
            return True
        else:
            logger.error(f"Could not find matching option for DP: {bank_dp_value}")
            return False
            
    except Exception as e:
        logger.error(f"Error filling DP field with Select2: {str(e)}")
        return False

async def process_account(browser, account):
    """Processes a single IPO application."""
    context = None
    page = None
    
    try:
        # Create context with ignore_https_errors to handle target site certificate issues
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        
        logger.info(f"Processing account: {account.get('username', 'unknown')}")
        
        # Step 1: Login
        await page.goto("https://meroshare.cdsc.com.np/", wait_until="networkidle")
        await page.fill("input[name='username']", account['username'])
        await page.fill("input[name='password']", account['password'])
        await page.click("button:has-text('Login')")
        
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        
        # Step 2: Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        
        # Step 3: Click Apply
        apply_button = page.locator("//tr[contains(., 'Ordinary Shares')]//button[text()='Apply']")
        await apply_button.first.wait_for(state="visible", timeout=10000)
        await apply_button.first.click()
        await page.wait_for_timeout(2000)
        
        # Step 4: Fill Form
        await page.locator("input[name='units']").fill(str(account['units']))
        await fill_dp_field_with_select2(page, str(account['dp']))
        await page.locator("input[name='crn']").fill(str(account['crn']))
        
        checkbox = page.locator("input[type='checkbox'][name*='disclaimer']").first
        await checkbox.check()
        
        # Step 5: PIN & Submit
        await page.locator("input[name='pin']").fill(str(account['pin']))
        await page.click("button:has-text('Submit')")
        
        logger.info(f"Application submitted for {account['username']}")
        return True
        
    except Exception as e:
        logger.error(f"Error processing account {account.get('username', 'unknown')}: {str(e)}")
        return False
    finally:
        if context:
            await context.close()

async def main():
    try:
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)
        
        if not accounts:
            logger.error("No accounts provided in ACCOUNTS_JSON")
            return
        
        async with async_playwright() as p:
            token = os.getenv('BROWSERLESS_TOKEN')
            
            if token:
                logger.info("Connecting to Browserless.io (CDP Mode)...")
                # UPDATED: Using CDP endpoint to ignore version mismatch errors
                endpoint = f"wss://production-sfo.browserless.io?token={token}"
                browser = await p.chromium.connect_over_cdp(endpoint)
            else:
                logger.info("Starting local browser...")
                browser = await p.chromium.launch(headless=True)
            
            try:
                for i, account in enumerate(accounts):
                    logger.info(f"--- Account {i+1}/{len(accounts)} ---")
                    await process_account(browser, account)
                    if i < len(accounts) - 1:
                        await asyncio.sleep(random.uniform(3, 7))
            finally:
                await browser.close()
    
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())