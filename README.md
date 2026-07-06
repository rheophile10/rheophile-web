# rheophile.ca

Source for the official site at rheophile.ca.

**Current state**: We are in planning phase for a proper Vite-based static site.  
The detailed implementation plan lives in `SITE-PLAN.md` (intentionally gitignored).

## Current reference prototype
A complete, beautiful single-file static version already exists at `index.html` (with Tailwind CDN). It includes:

- Hero with @rheophile10 PFP
- Deep featured treatment of the **plastron** project
- Curated projects from GitHub
- Interactive Dev Log + Reading Notes (books blog) with modals
- Direct links to X and GitHub

You can preview it with:
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

This prototype serves as the visual + content reference for the upcoming Vite version.

## Planned stack (Vite)
- Scaffolded with the official Vite CLI (`vanilla-ts`)
- Tailwind CSS v4 via the `@tailwindcss/vite` plugin
- TypeScript, minimal dependencies
- Static `dist/` output for easy deployment anywhere
- Same content and personality as the prototype, but with proper components, data files, HMR, and maintainability

See `SITE-PLAN.md` (gitignored) for the full architecture, exact CLI command, file layout, content migration steps, and open decisions.

## Deploy (future)
After we build the Vite site:
- `npm run build` → `dist/`
- Deploy `dist/` to Netlify, Vercel, GitHub Pages, etc.
- Custom domain (rheophile.ca) configuration will live in the host + possibly a `public/CNAME` file.

## PFP & assets
Profile photo lives at `assets/pfp.jpg` today (will move to `public/` once the Vite project is initialized).

---

Built for rheophile10. Connect via [@rheophile10](https://x.com/rheophile10) on X or [github.com/rheophile10](https://github.com/rheophile10).
