/* ============================================================
   Vardhman Visitor Analytics — Full Journey Tracker
   Captures: pageviews, clicks (incl. dead/rage), form submits,
   scroll depth, heartbeats. Batches to ingest-events edge function.
   Honours vc_optout cookie. PII-scrubs visible text client-side.
   ============================================================ */
(function () {
  var SUPABASE_URL      = 'https://ojxtrnxpqvrysvxipaea.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeHRybnhwcXZyeXN2eGlwYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzE0MzMsImV4cCI6MjA5NjE0NzQzM30.4OLm_vG0auBfpiULta_y3xllGdFNJYRsC6wqyoINPFg';

  if (location.pathname.indexOf('/dashboard') === 0) return;

  var VISITOR_KEY        = 'vardhman_visitor_id';
  var SESSION_KEY        = 'vardhman_session_id';
  var LAST_ACTIVITY_KEY  = 'vardhman_last_activity';
  var FINGERPRINT_KEY    = 'vardhman_fp';
  var OPTOUT_COOKIE      = 'vc_optout';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var HEARTBEAT_MS       = 15 * 1000;
  var FLUSH_MS           = 5 * 1000;
  var MAX_QUEUE          = 100;
  var DEAD_TAGS          = { A:1, BUTTON:1, INPUT:1, SELECT:1, TEXTAREA:1, LABEL:1 };
  var PII_RE             = /([\w.+-]+@[\w-]+\.[\w.-]+|\b\d{12,19}\b|\+?\d[\d\s().-]{8,})/g;

  function uuid() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; var v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16);
    });
  }
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, val, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(val) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }

  if (readCookie(OPTOUT_COOKIE) === '1') return;

  function getVisitorId() {
    try {
      var v = localStorage.getItem(VISITOR_KEY);
      if (!v) { v = uuid(); localStorage.setItem(VISITOR_KEY, v); }
      return v;
    } catch (e) { return uuid(); }
  }
  function getOrCreateSession() {
    var now = Date.now();
    var id, last, isNew = false;
    try {
      id   = sessionStorage.getItem(SESSION_KEY);
      last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
      if (!id || !last || (now - last) > SESSION_TIMEOUT_MS) {
        id = uuid(); isNew = true; sessionStorage.setItem(SESSION_KEY, id);
      }
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch (e) { id = uuid(); isNew = true; }
    return { id: id, isNew: isNew };
  }
  function computeFingerprint() {
    try {
      var cached = sessionStorage.getItem(FINGERPRINT_KEY);
      if (cached) return Promise.resolve(cached);
    } catch (e) {}
    var parts = [
      navigator.userAgent || '',
      navigator.language || '',
      String(screen.width) + 'x' + String(screen.height) + 'x' + String(screen.colorDepth || ''),
      String(navigator.hardwareConcurrency || ''),
      String(navigator.platform || ''),
      (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })(),
      String(new Date().getTimezoneOffset()),
    ].join('|');
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) return Promise.resolve(null);
    var enc = new TextEncoder().encode(parts);
    return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      var arr = Array.from(new Uint8Array(buf));
      var hex = arr.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { sessionStorage.setItem(FINGERPRINT_KEY, hex); } catch (e) {}
      return hex;
    }).catch(function () { return null; });
  }

  function selectorFor(el) {
    if (!el || el === document) return 'document';
    var path = [];
    var depth = 0;
    while (el && el.nodeType === 1 && depth < 4) {
      var part = el.tagName ? el.tagName.toLowerCase() : '*';
      if (el.id) { part = part + '#' + el.id; path.unshift(part); break; }
      var dt = null;
      if (el.dataset) {
        for (var k in el.dataset) { if (el.dataset.hasOwnProperty(k)) { dt = 'data-' + k + '=' + el.dataset[k]; break; } }
      }
      if (dt) part += '[' + dt + ']';
      else if (el.className && typeof el.className === 'string') {
        var cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) part += '.' + cls;
      }
      path.unshift(part);
      el = el.parentElement; depth++;
    }
    return path.join(' > ').slice(0, 500);
  }
  function isInteractive(el) {
    if (!el || el.nodeType !== 1) return false;
    if (DEAD_TAGS[el.tagName]) return true;
    var role = el.getAttribute && el.getAttribute('role');
    if (role === 'button' || role === 'link') return true;
    if (el.onclick || (el.getAttribute && el.getAttribute('onclick'))) return true;
    if (el.closest && el.closest('a,button,[role=button],[role=link],[onclick]')) return true;
    return false;
  }
  function scrubText(s) {
    return typeof s === 'string' ? s.replace(PII_RE, '[scrubbed]') : null;
  }

  var queue = [];
  var visitorId, session, fingerprintHash = null;

  function enqueue(ev) {
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push(ev);
  }
  function flush(useBeacon) {
    if (queue.length === 0) return;
    var batch = queue.splice(0, queue.length);
    var url  = SUPABASE_URL + '/functions/v1/ingest-events';
    var body = JSON.stringify({
      visitor_id: visitorId,
      session_id: session.id,
      fingerprint_hash: fingerprintHash,
      events: batch,
    });
    try {
      if (useBeacon && navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(url + '?apikey=' + encodeURIComponent(SUPABASE_ANON_KEY), blob)) return;
      }
      fetch(url, {
        method: 'POST', keepalive: true, mode: 'cors', credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        },
        body: body,
      }).catch(function () {});
    } catch (e) {}
  }

  var clickHistory = [];
  function detectRage(x, y, ts) {
    clickHistory.push({ x: x, y: y, ts: ts });
    clickHistory = clickHistory.filter(function (c) { return ts - c.ts < 800; });
    if (clickHistory.length < 3) return false;
    var ref = clickHistory[clickHistory.length - 1];
    var near = clickHistory.filter(function (c) {
      return Math.abs(c.x - ref.x) < 50 && Math.abs(c.y - ref.y) < 50;
    });
    return near.length >= 3;
  }

  function start() {
    visitorId = getVisitorId();
    session   = getOrCreateSession();
    var path  = location.pathname + location.search;
    var dnt   = navigator.doNotTrack === '1' || window.doNotTrack === '1';

    var fpPromise = dnt ? Promise.resolve(null) : computeFingerprint();
    fpPromise.then(function (fp) {
      fingerprintHash = fp;
      if (session.isNew) {
        enqueue({
          event_type: 'session_start',
          occurred_at: new Date().toISOString(),
          page_path: path,
          page_title: document.title || null,
          metadata: { referrer: document.referrer || null },
        });
      }
      enqueue({
        event_type: 'pageview',
        occurred_at: new Date().toISOString(),
        page_path: path,
        page_title: document.title || null,
      });
      flush(false);
    });

    var lastPath = path;
    function onNav() {
      var p = location.pathname + location.search;
      if (p === lastPath) return;
      lastPath = p;
      enqueue({
        event_type: 'pageview',
        occurred_at: new Date().toISOString(),
        page_path: p,
        page_title: document.title || null,
      });
    }
    window.addEventListener('popstate', onNav);
    var origPush = history.pushState; var origReplace = history.replaceState;
    history.pushState    = function () { var r = origPush.apply(this, arguments);    onNav(); return r; };
    history.replaceState = function () { var r = origReplace.apply(this, arguments); onNav(); return r; };

    document.addEventListener('click', function (e) {
      try {
        var t  = e.target;
        var ts = Date.now();
        var x  = e.clientX | 0; var y = e.clientY | 0;
        var rage = detectRage(x, y, ts);
        var interactive = isInteractive(t);
        var type = rage ? 'rage_click' : (interactive ? 'click' : 'dead_click');
        var text = (t && t.textContent) ? t.textContent.trim().slice(0, 200) : null;
        enqueue({
          event_type: type,
          occurred_at: new Date(ts).toISOString(),
          page_path: location.pathname + location.search,
          page_title: document.title || null,
          target_selector: selectorFor(t),
          target_text: scrubText(text),
          target_tag: (t && t.tagName) ? t.tagName.toLowerCase() : null,
          viewport_x: x, viewport_y: y,
        });
      } catch (e) {}
    }, true);

    document.addEventListener('submit', function (e) {
      try {
        var f = e.target;
        if (!f || f.nodeType !== 1) return;
        var fields = [];
        if (f.elements) {
          for (var i = 0; i < f.elements.length && i < 30; i++) {
            var el = f.elements[i];
            if (el && el.name) fields.push(el.name);
          }
        }
        enqueue({
          event_type: 'form_submit',
          occurred_at: new Date().toISOString(),
          page_path: location.pathname + location.search,
          target_selector: selectorFor(f),
          target_tag: 'form',
          metadata: { form_id: f.id || null, form_name: f.name || null, fields: fields },
        });
      } catch (e) {}
    }, true);

    var scrollMarks = { 25: false, 50: false, 75: false, 100: false };
    function onScroll() {
      try {
        var doc = document.documentElement;
        var scrolled = doc.scrollTop + window.innerHeight;
        var pct = Math.min(100, Math.round((scrolled / doc.scrollHeight) * 100));
        [25, 50, 75, 100].forEach(function (m) {
          if (pct >= m && !scrollMarks[m]) {
            scrollMarks[m] = true;
            enqueue({
              event_type: 'scroll_depth',
              occurred_at: new Date().toISOString(),
              page_path: location.pathname + location.search,
              metadata: { depth: m },
            });
          }
        });
      } catch (e) {}
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    var hb = setInterval(function () {
      try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch (e) {}
      enqueue({
        event_type: 'heartbeat',
        occurred_at: new Date().toISOString(),
        page_path: location.pathname + location.search,
      });
    }, HEARTBEAT_MS);

    var flusher = setInterval(function () { flush(false); }, FLUSH_MS);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('pagehide', function () {
      try { clearInterval(hb); clearInterval(flusher); } catch (e) {}
      flush(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.VardhmanTracking = {
    optOut: function () {
      try {
        setCookie(OPTOUT_COOKIE, '1', 3650);
        try { localStorage.removeItem(VISITOR_KEY); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(FINGERPRINT_KEY); } catch (e) {}
      } catch (e) {}
    },
    isOptedOut: function () { return readCookie(OPTOUT_COOKIE) === '1'; },
  };
})();
