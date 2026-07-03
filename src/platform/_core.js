/*!
 * Lumenward — platform adapter core.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Provides a uniform interface (`window.LLPlatform`) that the game core calls
 * regardless of where it runs (self-hosted web, YouTube Playables, itch.io).
 * Every method is safe to call and degrades gracefully. A variant file
 * (web.js / playables.js / local.js) overrides the pieces it supports.
 */
(function () {
  "use strict";
  var cfg = (window.LLConfig || {});
  var KEY = cfg.storageKey || "lumenward_best";
  var LEGACY = cfg.legacyStorageKey || "last_light_best";

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Base adapter: pure local, no network. Variants extend this object.
  window.LLPlatform = {
    id: "local",
    features: (cfg.features || { ads: false, cloudSave: false, leaderboard: false }),

    // Called once, early. Returns a Promise. Variants may load an SDK here.
    init: function () {
      return Promise.resolve();
    },

    // Called when the first frame has rendered and the game is interactive.
    ready: function () {},

    // Persist best score / settings. Local by default; hosts may also sync.
    saveBest: function (score) {
      lsSet(KEY, String(score));
    },
    loadBest: function () {
      var raw = lsGet(KEY);
      if (raw == null) {
        // one-time migration from the old key so players keep their record
        var old = lsGet(LEGACY);
        if (old != null) {
          lsSet(KEY, old);
          raw = old;
        }
      }
      return Number(raw || 0) || 0;
    },
    saveSettings: function (obj) {
      lsSet(cfg.settingsKey || "lumenward_settings", JSON.stringify(obj || {}));
    },
    loadSettings: function () {
      try {
        return JSON.parse(lsGet(cfg.settingsKey || "lumenward_settings") || "{}") || {};
      } catch (e) {
        return {};
      }
    },

    // Report a run's score to the host (Playables sendScore / leaderboard).
    submitScore: function (/* score */) {},

    // Best-effort ads. Resolve(true) if a reward was granted, else Resolve(false).
    rewardedAd: function () {
      return Promise.resolve(false);
    },
    interstitial: function () {
      return Promise.resolve();
    },

    // Whether an ad-driven "continue" should be offered at game over.
    canContinue: function () {
      return false;
    },
  };
})();
