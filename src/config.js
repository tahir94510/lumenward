/*!
 * Lumenward — game configuration & feature flags.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * This file is prepended (as a plain script) to the game bundle by build.mjs.
 * It exposes `window.LLConfig`, read defensively by the game core, so the core
 * keeps working even when this prelude is absent.
 *
 * Build-time tokens (replaced by build.mjs per variant):
 *   __LL_VARIANT__   "web" | "playables" | "local"
 *   __LL_VERSION__   semver string
 *   __LL_ADS__       true | false   (developer-implemented ads allowed?)
 *   __LL_CLOUD__     true | false   (host cloud-save available?)
 *   __LL_BOARD__     true | false   (global leaderboard enabled?)
 */
(function () {
  "use strict";
  window.LLConfig = {
    name: "Lumenward",
    version: "__LL_VERSION__",
    variant: "__LL_VARIANT__",
    // Backward-compatible score key: old "last_light_best" is migrated in-game.
    storageKey: "lumenward_best",
    legacyStorageKey: "last_light_best",
    settingsKey: "lumenward_settings",
    features: {
      ads: __LL_ADS__,
      cloudSave: __LL_CLOUD__,
      leaderboard: __LL_BOARD__,
    },
  };
})();
