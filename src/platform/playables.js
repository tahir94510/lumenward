/*!
 * Lumenward — YouTube Playables platform adapter.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Integrates the YouTube Playables SDK (loaded from
 * https://www.youtube.com/game_api/v1 in the Playables index.html).
 *
 * IMPORTANT (2026 Playables policy): the game must be fully offline and must
 * NOT ship its own ads or IAP. All monetization is served by YouTube through
 * this SDK. Accordingly this adapter makes NO network calls of its own — it
 * only talks to the injected `window.ytgame` bridge.
 *
 * The SDK surface is accessed defensively (feature-detected + try/catch) so a
 * missing or evolving SDK can never crash the game. Confirm exact method names
 * against the live Developer Portal SDK once portal access is granted; the
 * probing below covers the documented shapes.
 */
(function () {
  "use strict";
  var P = window.LLPlatform;
  P.id = "playables";
  // On Playables, developer ads/IAP are forbidden; rewarded/interstitial come
  // from YouTube's own inventory via the SDK. Cloud-save is host-provided.
  P.features = { ads: false, cloudSave: true, leaderboard: true };

  function yt() {
    return window.ytgame || null;
  }
  function call(obj, names, arg) {
    // try a list of possible method paths, return the first that runs
    for (var i = 0; i < names.length; i++) {
      try {
        var parts = names[i].split(".");
        var ctx = obj,
          fn = null,
          host = obj;
        for (var j = 0; j < parts.length; j++) {
          host = ctx;
          fn = ctx ? ctx[parts[j]] : null;
          ctx = fn;
        }
        if (typeof fn === "function") return fn.call(host, arg);
      } catch (e) {
        /* keep trying */
      }
    }
    return undefined;
  }

  P.init = function () {
    return Promise.resolve();
  };

  P.ready = function () {
    var g = yt();
    if (!g) return;
    // Signal the host: first frame painted, then fully interactive.
    call(g, ["game.firstFrameReady", "firstFrameReady"]);
    call(g, ["game.gameReady", "gameReady"]);
  };

  // Cloud save via the signed-in YouTube user (falls back to local).
  var localSaveBest = P.saveBest,
    localLoadBest = P.loadBest,
    localSaveSettings = P.saveSettings,
    localLoadSettings = P.loadSettings;

  P.saveBest = function (score) {
    localSaveBest(score);
    var g = yt();
    if (g) {
      try {
        var payload = JSON.stringify({ best: score, settings: localLoadSettings() });
        call(g, ["game.saveData", "saveData"], payload);
      } catch (e) {}
    }
  };
  P.saveSettings = function (obj) {
    localSaveSettings(obj);
    // settings are folded into the same cloud payload as best score
    P.saveBest(localLoadBest());
  };
  // loadBest/loadSettings stay local-first for a synchronous start; a cloud
  // load can hydrate asynchronously via hydrate() below if desired.
  P.hydrate = function (apply) {
    var g = yt();
    if (!g) return;
    try {
      var r = call(g, ["game.loadData", "loadData"]);
      if (r && typeof r.then === "function") {
        r.then(function (str) {
          try {
            var data = JSON.parse(str || "{}") || {};
            if (typeof apply === "function") apply(data);
          } catch (e) {}
        }).catch(function () {});
      }
    } catch (e) {}
  };

  P.submitScore = function (score) {
    var g = yt();
    if (!g) return;
    call(g, ["engagement.sendScore", "game.sendScore", "sendScore"], { value: score });
  };

  P.rewardedAd = function () {
    var g = yt();
    if (!g) return Promise.resolve(false);
    try {
      var r = call(g, ["ads.requestRewardedAd", "requestRewardedAd"], {});
      if (r && typeof r.then === "function") {
        return r.then(function () {
          return true;
        }).catch(function () {
          return false;
        });
      }
    } catch (e) {}
    return Promise.resolve(false);
  };
  P.interstitial = function () {
    var g = yt();
    if (!g) return Promise.resolve();
    try {
      var r = call(g, ["ads.requestInterstitialAd", "requestInterstitialAd"], {});
      if (r && typeof r.then === "function") return r.then(function () {}).catch(function () {});
    } catch (e) {}
    return Promise.resolve();
  };
  // On Playables, "continue" would rely on YouTube's rewarded inventory, which
  // is a gradual rollout; keep it off by default so gameplay never blocks.
  P.canContinue = function () {
    return false;
  };
})();
