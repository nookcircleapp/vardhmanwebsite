// Blog meta enhancer:
//  - Increments + reads view count per article via Supabase RPC
//  - Inserts the count into [data-view-count] in the article-meta strip
(function () {
  var SUPABASE_URL = 'https://ojxtrnxpqvrysvxipaea.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeHRybnhwcXZyeXN2eGlwYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzE0MzMsImV4cCI6MjA5NjE0NzQzM30.4OLm_vG0auBfpiULta_y3xllGdFNJYRsC6wqyoINPFg';

  var slot = document.querySelector('[data-view-count]');
  if (!slot) return;

  // Normalise path so e.g. /blog/foo and /blog/foo.html are the same key
  var path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  if (!path) path = '/';

  var sessionKey = 'viewed:' + path;
  var headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  // Display-only baseline so new posts don't show "1 view" while organic
  // traffic ramps up. Real DB count is preserved underneath.
  var VIEW_BASELINE = 1500;
  function paint(n) {
    if (typeof n !== 'number' || isNaN(n)) return;
    var display = n + VIEW_BASELINE;
    slot.textContent = display.toLocaleString('en-IN') + (display === 1 ? ' view' : ' views');
    slot.dataset.viewCount = String(display);
  }

  function readCount() {
    return fetch(SUPABASE_URL + '/rest/v1/view_counts?path=eq.' + encodeURIComponent(path) + '&select=count', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return rows[0] ? rows[0].count : 0; });
  }

  function incrementCount() {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/increment_view', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ p_path: path })
    }).then(function (r) { return r.ok ? r.json() : null; });
  }

  // Already counted this session — just read + paint
  if (sessionStorage.getItem(sessionKey)) {
    readCount().then(paint).catch(function () {});
    return;
  }

  // First view this session — increment, paint, remember
  incrementCount().then(function (newCount) {
    if (typeof newCount === 'number') {
      paint(newCount);
      try { sessionStorage.setItem(sessionKey, '1'); } catch (e) {}
    } else {
      // Increment failed (rate limit / network) — fall back to a read
      readCount().then(paint).catch(function () {});
    }
  }).catch(function () {
    readCount().then(paint).catch(function () {});
  });
})();
