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
    """Safely logs out the user."""
    try:
        logout_btn = page.locator(".header-menu__item--logout-desktop-view a")
        if await logout_btn.is_visible():
            await logout_btn.click()
            await page.wait_for_selector("#username", timeout=5000)
            logger.info("✅ Logged out successfully.")
    except:
        await page.goto("https://meroshare.cdsc.com.np/#/login")

async def select_login_dp(page, bank_code):
    """Handles the DP dropdown."""
    try:
        await page.click("span.select2-selection--single")
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
    """Core logic with improved row detection."""
    if not browser.is_connected():
        logger.error("Browser disconnected. Skipping account.")
        return False
        
    context = None
    try:
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
        
        # 2. Navigate to ASBA
        await page.goto("https://meroshare.cdsc.com.np/#/asba", wait_until="networkidle")
        
        # Wait for the table rows to actually exist
        await page.wait_for_selector(".company-list tr", timeout=15000)
        await page.wait_for_timeout(2000) 

        # 3. Find Apply Button
        # Instead of strict 'Ordinary Shares', we look for any row that has an active 'Apply' button
        # This avoids issues if the naming in the ISIN column varies.
        apply_btn = page.locator("button.btn-issue:has-text('Apply')").first
        
        if await apply_btn.is_visible():
            # Get the company name for logs
            company_name = await page.locator("span.company-name").first.inner_text()
            logger.info(f"✅ Found IPO: {company_name}. Opening form...")
            await apply_btn.click()
        else:
            logger.warning("❌ No active 'Apply' buttons found. (Already applied or none available)")
            await logout_user(page)
            return False

        # 4. Form Filling
        await page.wait_for_selector("#selectBank", state="visible")
        await page.select_option("#selectBank", index=1)
        
        await page.wait_for_selector("#accountNumber option:not([value=''])", state="attached")
        await page.select_option("#accountNumber", index=1)
        
        await page.wait_for_timeout(1000)
        
        await page.fill("#appliedKitta", str(account['units']))
        await page.focus("#appliedKitta")
        await page.keyboard.press("Tab") 
        await page.locator("#appliedKitta").dispatch_event("blur")
        
        await page.wait_for_timeout(1500)
        amount = await page.input_value("#amount")
        logger.info(f"Step: Units {account['units']} -> NPR {amount}")

        await page.fill("#crnNumber", str(account['crn']))
        await page.check("#disclaimer", force=True)
        await page.click("button[type='submit']:has-text('Proceed')")

        # 5. PIN & Submit
        await page.wait_for_selector("#transactionPIN", state="visible")
        await page.fill("#transactionPIN", str(account['pin']))
        
        await page.click("button[type='submit']:has-text('Apply')")
        await page.wait_for_timeout(3000)
        logger.info(f"🚀 SUCCESS: Applied for {account['username']}")
        
        await logout_user(page)
        return True

    except Exception as e:
        logger.error(f"ERROR for {account.get('username')}: {str(e)}")
        return False
    finally:
        if context:
            await context.close()

async def main():
    browser = None
    try:
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        accounts = json.loads(accounts_json)
        token = os.getenv('BROWSERLESS_TOKEN')

        async with async_playwright() as p:
            endpoint = f"wss://production-sfo.browserless.io?token={token}"
            browser = await p.chromium.connect_over_cdp(endpoint)
            
            for account in accounts:
                if not browser.is_connected():
                    logger.info("Reconnecting to browser...")
                    browser = await p.chromium.connect_over_cdp(endpoint)
                
                await process_account(browser, account)
                # Significant delay to allow MeroShare/Browserless to breathe
                await asyncio.sleep(8)
            
            await browser.close()
            logger.info("🏁 Finished.")
    except Exception as e:
        logger.error(f"FATAL: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())