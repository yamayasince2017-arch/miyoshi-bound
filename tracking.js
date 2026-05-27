/**
 * ============================================================
 * MIYOSHI BOUND — Tracking Script (tracking.js)
 * ============================================================
 * * 設定済みURL: https://script.google.com/macros/s/AKfycb...xSflBA0aXqqRTkxNLeQ/exec
 */

;(function (global) {
  'use strict';

  // ── Configuration ──────────────────────────────────────────
  var CONFIG = {
    // 【設定済み】大野さんのGASウェブアプリURL
    GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxXHX3vqinR-Wh4XtouNfqgtXS_LfRmHo-iozUahLpFAG8AWr4LVGwvpFxxIhQf1lysgg/exec',

    MAX_RETRIES: 2,
    RETRY_DELAY: 1500,
    DEBUG: true // テスト中はログが見えるようにtrueにしておきます。本番公開時にfalseにしてください。
  };

  // ── Internal utilities ─────────────────────────────────────

  function getParam(name) {
    try {
      var url    = new URL(global.location.href);
      var value  = url.searchParams.get(name);
      return value ? value.trim().toLowerCase() : '';
    } catch (e) {
      var match = global.location.search.match(
        new RegExp('[?&]' + name + '=([^&]*)')
      );
      return match ? decodeURIComponent(match[1]).trim().toLowerCase() : '';
    }
  }

  function resolveLocation() {
    var fromParam = getParam('from'); // QRコードの末尾が ?from=xxx の場合
    if (fromParam) {
      try {
        sessionStorage.setItem('mb_from', fromParam);
      } catch (e) { }
      return fromParam;
    }
    try {
      return sessionStorage.getItem('mb_from') || 'direct';
    } catch (e) {
      return 'direct';
    }
  }

  function getSessionId() {
    try {
      var sid = sessionStorage.getItem('mb_sid');
      if (!sid) {
        sid = 'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('mb_sid', sid);
      }
      return sid;
    } catch (e) {
      return 'nostorage';
    }
  }

  function sendBeacon(payload, attempt) {
    attempt = attempt || 0;

    if (CONFIG.DEBUG) {
      console.log('[MiyoshiTrack] 送信データ:', payload);
    }

    // ── fetch POST + no-cors 方式 ──────────────────────────
    // GETのクエリパラメータはGoogleのインフラで400ブロックされるため
    // POSTボディにJSONを入れて送信する。
    // Content-Type: text/plain にすることでプリフライト(OPTIONS)が
    // 発生せず、no-corsのままクロスオリジンPOSTが通る。
    // no-corsではレスポンスは読めないが、GAS側での記録は正常に行われる。
    try {
      fetch(CONFIG.GAS_ENDPOINT, {
        method:  'POST',
        mode:    'no-cors',
        cache:   'no-cache',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload)
      }).then(function () {
        if (CONFIG.DEBUG) console.log('[MiyoshiTrack] 送信完了 (POST no-cors)');
      }).catch(function (err) {
        if (CONFIG.DEBUG) console.warn('[MiyoshiTrack] 送信失敗:', err);
        if (attempt < CONFIG.MAX_RETRIES) {
          setTimeout(function () { sendBeacon(payload, attempt + 1); }, CONFIG.RETRY_DELAY);
        }
      });
    } catch (err) {
      if (CONFIG.DEBUG) console.warn('[MiyoshiTrack] 送信エラー:', err);
      if (attempt < CONFIG.MAX_RETRIES) {
        setTimeout(function () { sendBeacon(payload, attempt + 1); }, CONFIG.RETRY_DELAY);
      }
    }
  }

  function serialize(obj) {
    return Object.keys(obj)
      .filter(function (k) { return obj[k] !== undefined && obj[k] !== null; })
      .map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]);
      })
      .join('&');
  }

  // ── Public API ─────────────────────────────────────────────

  function resolveShop(fallback) {
    // URLパラメータ ?shop=xxx を最優先で使用
    var shopParam = getParam('shop');
    if (shopParam) return shopParam;
    // 次にファイル名から自動取得（例: oboke-honey.html → oboke-honey）
    try {
      var path = global.location.pathname;
      var filename = path.split('/').pop().replace(/\.html?$/, '');
      if (filename && filename !== 'index' && filename !== '') return filename;
    } catch (e) { }
    // 最後にコード側で渡された値を使用
    return fallback || 'unknown';
  }

  function send(options) {
    if (!options || !options.type) {
      if (CONFIG.DEBUG) console.warn('[MiyoshiTrack] 設定エラー: typeが必要です');
      return;
    }

    var payload = {
      shop:      resolveShop(options.shop),
      loc:       resolveLocation(),
      type:      options.type,
      sid:       getSessionId(),
      ts:        new Date().toISOString(),
      // ua はUser Agent文字列に & / ; = などの特殊文字が含まれるため
      // GASのURL解析を壊す原因になる。送信から除外する。
      lang:      navigator.language || ''
    };

    sendBeacon(payload);
  }

  global.MiyoshiTrack = {
    send:   send,
    config: CONFIG
  };

}(typeof window !== 'undefined' ? window : this));