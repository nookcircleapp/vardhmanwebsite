// Vardhman Dashboard
// All rendering uses createElement + textContent to avoid XSS — no innerHTML for user data.

const SUPABASE_URL = 'https://ojxtrnxpqvrysvxipaea.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeHRybnhwcXZyeXN2eGlwYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzE0MzMsImV4cCI6MjA5NjE0NzQzM30.4OLm_vG0auBfpiULta_y3xllGdFNJYRsC6wqyoINPFg';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'vardhman-dashboard-auth' }
});

const loginView   = document.getElementById('loginView');
const appView     = document.getElementById('appView');
const loginForm   = document.getElementById('loginForm');
const loginErr    = document.getElementById('loginErr');
const loginBtn    = document.getElementById('loginBtn');
const whoami      = document.getElementById('whoami');
const enqListEl   = document.getElementById('enqList');
const enqCountEl  = document.getElementById('enqCount');
const liveNEl     = document.getElementById('liveN');
const liveSEl     = document.getElementById('liveS');
const liveRowsEl  = document.getElementById('liveRows');

let allEnquiries = [];
let statusFilter = 'all';
let projectFilter = 'all';
let presenceState = {};
let liveTickInterval = null;

function projectKey(label) {
  const s = (label || '').toLowerCase();
  if (s.indexOf('fairmont') !== -1) return 'fairmont';
  if (s.indexOf('celestia') !== -1 && s.indexOf('2 bhk') !== -1) return 'celestia-2';
  if (s.indexOf('celestia') !== -1 && s.indexOf('3 bhk') !== -1) return 'celestia-3';
  if (s.indexOf('celestia') !== -1 && s.indexOf('4 bhk') !== -1) return 'celestia-4';
  return 'other';
}

// ---------- AUTH ----------
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) showApp(session.user);
  else showLogin();
}
function showLogin() {
  loginView.style.display = 'grid';
  appView.classList.remove('show');
}
function showApp(user) {
  loginView.style.display = 'none';
  appView.classList.add('show');
  whoami.textContent = user.email;
  bootApp();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErr.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';
  const email = document.getElementById('lEmail').value.trim();
  const password = document.getElementById('lPass').value;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign in';
  if (error) { loginErr.textContent = error.message || 'Sign in failed'; return; }
  showApp(data.user);
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  if (liveTickInterval) clearInterval(liveTickInterval);
  location.reload();
});

// ---------- BOOT ----------
async function bootApp() {
  await loadEnquiries();
  subscribeEnquiries();
  subscribePresence();
  liveTickInterval = setInterval(renderLive, 5000);
}

// ---------- ENQUIRIES ----------
async function loadEnquiries() {
  const { data, error } = await sb
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    enqListEl.replaceChildren(makeEmpty('Could not load enquiries', error.message || ''));
    return;
  }
  allEnquiries = data || [];
  assignSequenceNumbers();
  renderEnquiries();
}

// Oldest enquiry = #1, newest = #N (stable, lifetime numbering)
function assignSequenceNumbers() {
  const sorted = [...allEnquiries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const seq = new Map();
  sorted.forEach((r, i) => seq.set(r.id, i + 1));
  allEnquiries.forEach(r => { r._seq = seq.get(r.id); });
}

function subscribeEnquiries() {
  sb.channel('enquiries-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enquiries' }, (payload) => {
      allEnquiries.unshift(payload.new);
      assignSequenceNumbers();
      renderEnquiries();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'enquiries' }, (payload) => {
      const i = allEnquiries.findIndex(r => r.id === payload.new.id);
      if (i >= 0) allEnquiries[i] = payload.new;
      renderEnquiries();
    })
    .subscribe();
}

function renderEnquiries() {
  const rows = allEnquiries.filter(r => {
    const sOk = statusFilter === 'all' || (r.status || 'new') === statusFilter;
    const pOk = projectFilter === 'all' || projectKey(r.project) === projectFilter;
    return sOk && pOk;
  });
  enqCountEl.textContent = rows.length;
  updateFilterBadges();
  enqListEl.replaceChildren();

  if (rows.length === 0) {
    enqListEl.appendChild(makeEmpty('No enquiries yet', 'New enquiries will appear here in real time.'));
    return;
  }

  // Header
  const head = el('div', 'enq-row head');
  ['#','Name','Email','Phone','Interested in','Received','Status'].forEach(t => head.appendChild(el('div', '', t)));
  enqListEl.appendChild(head);

  rows.forEach(r => {
    const status = r.status || 'new';
    const row = el('div', 'enq-row');
    row.dataset.id = r.id;
    row.dataset.status = status;

    row.appendChild(el('div', 'seq', '#' + (r._seq || '?')));
    row.appendChild(el('div', 'name', r.name || '—'));
    row.appendChild(el('div', 'email', r.email || '—'));
    row.appendChild(el('div', 'phone', r.phone || '—'));
    row.appendChild(el('div', 'project', r.project || '—'));

    const time = el('div', 'time', formatTime(r.created_at));
    time.title = r.created_at || '';
    row.appendChild(time);

    const sel = document.createElement('select');
    sel.className = 'status-sel';
    sel.dataset.id = r.id;
    ['new','contacted','closed'].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v[0].toUpperCase() + v.slice(1);
      if (v === status) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', async (e) => {
      await sb.from('enquiries').update({ status: e.target.value }).eq('id', e.target.dataset.id);
    });
    const selWrap = document.createElement('div');
    selWrap.appendChild(sel);
    row.appendChild(selWrap);

    if (r.message) {
      const m = el('div', 'msg-box', r.message);
      row.appendChild(m);
    }

    enqListEl.appendChild(row);
  });
}

// Filter buttons — status
document.querySelectorAll('#statusFilter button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#statusFilter button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    statusFilter = b.dataset.f;
    renderEnquiries();
  });
});
// Filter buttons — project/interest
document.querySelectorAll('#projectFilter button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#projectFilter button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    projectFilter = b.dataset.p;
    renderEnquiries();
  });
});

function updateFilterBadges() {
  // Status counts
  const statusCounts = { all: allEnquiries.length, new: 0, contacted: 0, closed: 0 };
  // Project counts
  const projectCounts = { all: allEnquiries.length, 'fairmont': 0, 'celestia-2': 0, 'celestia-3': 0, 'celestia-4': 0 };
  allEnquiries.forEach(r => {
    const s = r.status || 'new';
    if (statusCounts[s] !== undefined) statusCounts[s]++;
    const p = projectKey(r.project);
    if (projectCounts[p] !== undefined) projectCounts[p]++;
  });
  document.querySelectorAll('#statusFilter button').forEach(b => {
    setBadge(b, statusCounts[b.dataset.f]);
  });
  document.querySelectorAll('#projectFilter button').forEach(b => {
    setBadge(b, projectCounts[b.dataset.p]);
  });
}
function setBadge(btn, n) {
  let badge = btn.querySelector('.badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge';
    btn.appendChild(badge);
  }
  badge.textContent = n;
}

// ---------- PRESENCE ----------
function subscribePresence() {
  const ch = sb.channel('online_users', {
    config: { presence: { key: 'dashboard_' + Math.random().toString(36).slice(2) } }
  });
  ch.on('presence', { event: 'sync' }, () => {
    presenceState = ch.presenceState();
    renderLive();
  });
  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await ch.track({
        page: '/dashboard',
        title: 'Dashboard (you)',
        joined_at: new Date().toISOString(),
        is_dashboard: true
      });
    }
  });
}

function renderLive() {
  const visitors = [];
  Object.keys(presenceState).forEach(k => {
    (presenceState[k] || []).forEach(meta => {
      if (meta.is_dashboard) return;
      visitors.push(meta);
    });
  });

  liveNEl.textContent = visitors.length;
  liveSEl.textContent = visitors.length === 1 ? '' : 's';

  liveRowsEl.replaceChildren();
  if (visitors.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3; td.className = 'empty'; td.textContent = 'No one online right now.';
    tr.appendChild(td); liveRowsEl.appendChild(tr);
    return;
  }
  visitors
    .sort((a,b) => new Date(a.joined_at) - new Date(b.joined_at))
    .forEach(v => {
      const tr = document.createElement('tr');
      const tdP = el('td', 'page', v.page || '/');
      const tdT = el('td', '', v.title || '');
      const tdD = el('td', '', durationSince(v.joined_at));
      tr.appendChild(tdP); tr.appendChild(tdT); tr.appendChild(tdD);
      liveRowsEl.appendChild(tr);
    });
}

// ---------- UTILS ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function makeEmpty(title, sub) {
  const wrap = el('div', 'empty-state');
  wrap.appendChild(el('div', 'big', title));
  if (sub) wrap.appendChild(document.createTextNode(sub));
  return wrap;
}
function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
  return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
function durationSince(iso) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return sec + 's';
  if (sec < 3600) return Math.floor(sec/60) + 'm ' + (sec%60) + 's';
  return Math.floor(sec/3600) + 'h ' + Math.floor((sec%3600)/60) + 'm';
}

checkSession();
