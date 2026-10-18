# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notes-tab.spec.ts >> closing with unsaved changes prompts to discard; a clean close does not
- Location: tests\notes-tab.spec.ts:153:5

# Error details

```
Error: browserType.launch: Executable doesn't exist at C:\Users\persi\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```