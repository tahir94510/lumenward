/*!
 * Lumenward — "local" / itch.io platform adapter.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Fully offline: local best score only, no ads, no network. This is the
 * safe default used for itch.io and any plain static hosting. It simply
 * keeps the base adapter from _core.js as-is.
 */
(function () {
  "use strict";
  window.LLPlatform.id = "local";
})();
