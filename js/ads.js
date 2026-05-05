/* AdSense init (client-side)
 * - Fetches /api/ads-config; if publisher empty (env unset OR user is admin/premium) → no ads.
 * - Otherwise loads the AdSense library and initializes any <ins class="adsbygoogle" data-slot-key="inline|result"> on the page.
 */
(function () {
  function init() {
    fetch('/api/ads-config', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.publisher) {
          document.querySelectorAll('ins.adsbygoogle').forEach(function (el) { el.remove(); });
          return;
        }
        var slots = document.querySelectorAll('ins.adsbygoogle');
        if (!slots.length) return;

        // Inject AdSense library once
        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.publisher);
        document.head.appendChild(s);

        // Configure each slot before push()
        slots.forEach(function (ins) {
          var key = ins.dataset.slotKey || 'inline';
          var slotId = (key === 'result') ? cfg.slotResult : cfg.slotInline;
          if (!slotId) { ins.remove(); return; }
          ins.setAttribute('data-ad-client', cfg.publisher);
          ins.setAttribute('data-ad-slot', slotId);
          ins.setAttribute('data-ad-format', 'auto');
          ins.setAttribute('data-full-width-responsive', 'true');
          try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
        });
      })
      .catch(function () { /* silent */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
