# POS Quantity Focus (ERPNext v15)

A minimal Frappe app that enhances ERPNext Point of Sale UI so that when an item is added, the quantity field is automatically focused and its value is selected, enabling immediate overwrite (e.g., typing 10/20/100) for faster billing.

## Install

1. Push this repository to GitHub (see commands below).
2. On Frappe Cloud, open your site → Apps → Install App from GitHub → paste the repo URL → Install.
3. After installation, on your site run (from the bench console/SSH) if available:
   - `bench clear-cache`
   - `bench build` (or wait for assets to build automatically)
4. Open POS (`point-of-sale`) and add items. The quantity input of the most-recently added row will auto-focus and select its value.

## Local development (optional)

```bash
git init
git add .
git commit -m "feat: initial pos quantity focus app"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Notes

- Frontend-only customization; no server-side overrides.
- Uses a MutationObserver and route checks to limit behavior to the POS page and newly-added cart rows.
- Designed and tested for ERPNext v15 UI structure; selectors are resilient and fallback across minor variations.


