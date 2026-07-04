/*!
 * Lumenward — self-hosted web platform adapter.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * For your own domain (Vercel / GitHub Pages). Supports, all behind flags and
 * therefore OFF until you supply credentials:
 *   - Google AdSense H5 "Ad Placement API" (adBreak) for rewarded/interstitial
 *   - An optional Supabase-backed global leaderboard via its REST endpoint
 *
 * Credentials arrive via `window.LLEnv`, injected by build.mjs from environment
 * variables at build time (empty by default => every paid feature is inert and
 * the game behaves exactly like the offline build).
 */
(function () {
  "use strict";
  var P = window.LLPlatform;
  var env = window.LLEnv || {};
  var cfg = window.LLConfig || {};
  P.id = "web";

  var adsReady = !!(cfg.features && cfg.features.ads) && !!env.adsenseClient && typeof window.adBreak === "function";
  var boardOn = !!(cfg.features && cfg.features.leaderboard) && !!env.supabaseUrl && !!env.supabaseKey;
  P.features = {
    ads: adsReady,
    cloudSave: false,
    leaderboard: boardOn,
  };

  P.init = function () {
    return Promise.resolve();
  };
  P.ready = function () {};

  // ---- Ads (AdSense H5 Ad Placement API) --------------------------------
  P.rewardedAd = function () {
    if (!adsReady) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var granted = false;
      try {
        window.adBreak({
          type: "reward",
          name: "continue",
          beforeReward: function (showAdFn) {
            showAdFn();
          },
          adViewed: function () {
            granted = true;
          },
          adDismissed: function () {
            granted = false;
          },
          adBreakDone: function () {
            resolve(granted);
          },
        });
      } catch (e) {
        resolve(false);
      }
    });
  };
  P.interstitial = function () {
    if (!adsReady) return Promise.resolve();
    return new Promise(function (resolve) {
      try {
        window.adBreak({
          type: "next",
          name: "round",
          adBreakDone: function () {
            resolve();
          },
        });
      } catch (e) {
        resolve();
      }
    });
  };
  P.canContinue = function () {
    return adsReady;
  };

  // ---- Optional global leaderboard (Supabase REST) ----------------------
  // Table (suggested): scores(name text, score int8, created_at timestamptz).
  // Requires a Row-Level-Security policy allowing anon insert + select.
  P.submitScore = function (score, name) {
    if (!boardOn) return Promise.resolve();
    try {
      return fetch(env.supabaseUrl.replace(/\/$/, "") + "/rest/v1/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.supabaseKey,
          Authorization: "Bearer " + env.supabaseKey,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ name: (name || "GUARDIAN").slice(0, 24), score: score | 0 }),
      }).catch(function () {});
    } catch (e) {}
  };
  P.topScores = function (limit) {
    if (!boardOn) return Promise.resolve([]);
    try {
      var url =
        env.supabaseUrl.replace(/\/$/, "") +
        "/rest/v1/scores?select=name,score&order=score.desc&limit=" +
        (limit || 10);
      return fetch(url, {
        headers: { apikey: env.supabaseKey, Authorization: "Bearer " + env.supabaseKey },
      })
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .catch(function () {
          return [];
        });
    } catch (e) {
      return Promise.resolve([]);
    }
  };
})();
