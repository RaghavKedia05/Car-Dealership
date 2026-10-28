UI fix (fixes the dark / unreadable colours after the redesign)

Cause: the "Restructured the Files" commit added src/styles/showroom-theme.css (old dark theme).
It was still imported in main.jsx and overrode the new design, so titles/prices became invisible.

STEPS
1. git pull
2. Unzip into the repo root and choose Replace.
3. DELETE this file:  src/styles/showroom-theme.css
4. npm run dev  -> check http://localhost:5173 (home + /showroom)
5. git add -A
   git commit -m "Fix UI colours: remove old showroom theme, allow public showroom browsing"
   git push

ALSO IN THIS FIX
- Showroom can be browsed without signing in again (as in the Restructure commit).
  Reserve / smart car finder ask the visitor to sign in.
- docs/project-structure.md no longer mentions showroom-theme.css.
All 39 backend tests pass (npm test).
