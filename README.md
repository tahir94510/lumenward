# Last Light v35

A compact skill-based retro-neon arcade game for the browser. Sweep through asteroids with the cursor or touch-drag on mobile, protect the final star, chain risky combos, and survive one more run.

## Controls

- Desktop: move the cursor through asteroids and healing sparks.
- Mobile / tablet: hold and drag across the screen.
- Space: start / pause.
- Escape: pause / resume.

## Package

`index.html` is at the root for browser play on itch.io and static web hosts. The runtime is `app.min.js`. The package keeps only the files needed to run and present the game as a web/PWA build: app runtime, manifest, icons, privacy page, robots file, and this README.

Browser JavaScript cannot be made impossible to inspect, but this release excludes source maps, debug hooks, source files, test files, and redundant store-art exports, and ships a minified/mangled runtime build.

Release note: v35 keeps the cleaned release package and sharpens the arcade feel again: faster pressure, tighter sweep windows, safer floating-text placement, stronger brink/combo feedback, shorter heal windows, and a more deliberate skill-first difficulty curve.
