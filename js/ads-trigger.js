/* ads-trigger.js — Quiz page ad trigger logic.
 * - Polls /api/ads-config; if publisher empty (env unset OR user is admin/premium) → no-op.
 * - Otherwise loads AdSense library and shows an inline ad every 10 questions
 *   plus one ad inside the exam-result modal when shown.
 * - All logic is wrapped in try/catch so a broken ad never breaks the quiz UI.
 */
(function () {
  'use strict';

  var cfg = null;
  var adWrap = null;
  var seenQs = new Set();
  var lastAdAt = 0;
  var resultAdShown = false;

  function safeLog(/* msg */) { /* keep silent in production */ }

  function loadAdsenseLibrary(publisher) {
    try {
      // Already loaded?
      if (document.querySelector('script[src*="adsbygoogle.js"]')) return;
      var s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(publisher);
      document.head.appendChild(s);
    } catch (e) { safeLog('lib', e); }
  }

  function buildIns() {
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:block;min-height:90px;';
    ins.setAttribute('data-ad-client', cfg.publisher);
    ins.setAttribute('data-ad-slot', cfg.slotInline);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    return ins;
  }

  function pushAd() {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch (e) { safeLog('push', e); }
  }

  function showInlineAd() {
    try {
      if (!cfg || !cfg.publisher || !cfg.slotInline) return;
      var main = document.querySelector('main.container') || document.querySelector('main');
      if (!main) return;
      if (!adWrap) {
        adWrap = document.createElement('div');
        adWrap.id = 'quiz-inline-ad';
        adWrap.style.cssText = 'margin:14px auto;max-width:728px;text-align:center;min-height:90px;';
        main.insertBefore(adWrap, main.firstChild);
      }
      // Replace any previous ins so a new request goes out
      adWrap.innerHTML = '';
      adWrap.appendChild(buildIns());
      pushAd();
    } catch (e) { safeLog('inline', e); }
  }

  function showResultModalAd() {
    try {
      if (resultAdShown) return;
      if (!cfg || !cfg.publisher || !cfg.slotInline) return;
      var body = document.getElementById('exam-result-body');
      if (!body) return;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin:16px 0 4px;text-align:center;min-height:90px;';
      wrap.appendChild(buildIns());
      body.appendChild(wrap);
      pushAd();
      resultAdShown = true;
    } catch (e) { safeLog('result', e); }
  }

  function setupQuestionCounter() {
    try {
      var label = document.getElementById('qnum-label');
      if (!label) return;

      var bump = function () {
        try {
          var t = (label.textContent || '').trim();
          var m = t.match(/^(\d+)\s*\/\s*(\d+)/);
          if (!m) return;
          var cur = parseInt(m[1], 10);
          if (!cur || cur <= 0) return;
          if (seenQs.has(cur)) return;
          seenQs.add(cur);
          var seenCount = seenQs.size;
          if (seenCount > 0 && seenCount % 10 === 0 && seenCount > lastAdAt) {
            lastAdAt = seenCount;
            showInlineAd();
          }
        } catch (e) { safeLog('bump', e); }
      };

      bump(); // initial
      var obs = new MutationObserver(bump);
      obs.observe(label, { childList: true, characterData: true, subtree: true });
    } catch (e) { safeLog('counter', e); }
  }

  function setupResultModalWatcher() {
    try {
      var modal = document.getElementById('exam-result-overlay');
      if (!modal) return;
      var check = function () {
        try {
          var visibleByClass = modal.classList && modal.classList.contains('show');
          var visibleByStyle = modal.style && modal.style.display && modal.style.display !== 'none';
          var visibleByAria = modal.getAttribute && modal.getAttribute('aria-hidden') === 'false';
          if (visibleByClass || visibleByStyle || visibleByAria) {
            showResultModalAd();
          }
        } catch (e) { safeLog('check', e); }
      };
      var obs = new MutationObserver(check);
      obs.observe(modal, { attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
    } catch (e) { safeLog('result-watch', e); }
  }

  function init() {
    fetch('/api/ads-config', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        cfg = j;
        if (!cfg || !cfg.publisher || !cfg.slotInline) return; // no-ad mode
        loadAdsenseLibrary(cfg.publisher);
        setupQuestionCounter();
        setupResultModalWatcher();
      })
      .catch(function (e) { safeLog('cfg', e); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
