// ==========================================================================
// ADMIN PANEL — clean, modular JS
// ==========================================================================

// ── Data ──────────────────────────────────────────────────────────
var vaccinesData = [], sectionsData = [], eventsData = [], resourcesData = [];
try { var _v = document.getElementById('d-vaccines');  if(_v) vaccinesData  = JSON.parse(_v.textContent); } catch(e){}
try { var _s = document.getElementById('d-sections');  if(_s) sectionsData  = JSON.parse(_s.textContent); } catch(e){}
try { var _e = document.getElementById('d-events');    if(_e) eventsData    = JSON.parse(_e.textContent); } catch(e){}
try { var _r = document.getElementById('d-resources'); if(_r) resourcesData = JSON.parse(_r.textContent); } catch(e){}

// ── Custom Date Picker ─────────────────────────────────────────────
var _adminPickerRegistry = [];
var _CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var _CAL_DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function _calEl(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function _calFmt(d) { return d.toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'}); }
function _calStr(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function createAdminDatePicker(opts) {
  var TODAY = new Date(); TODAY.setHours(0,0,0,0);
  var minDate = opts.minDate || null;
  var maxDate = opts.maxDate || null;
  var sel     = opts.defaultDate ? new Date(opts.defaultDate) : null;
  var view    = 'days';
  var dispYear  = (sel || TODAY).getFullYear();
  var dispMonth = (sel || TODAY).getMonth();
  var yearStart = Math.floor((sel || TODAY).getFullYear() / 20) * 20 + 1;

  var widget  = document.getElementById(opts.widgetId);
  var trigger = document.getElementById(opts.triggerId);
  var txtEl   = document.getElementById(opts.triggerTextId);
  var popup   = document.getElementById(opts.popupId);
  var hidden  = opts.hiddenId ? document.getElementById(opts.hiddenId) : null;
  if (!widget || !trigger || !popup) return { getValue:function(){return '';}, reset:function(){}, close:function(){}, setDate:function(){} };

  function isDis(date) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }
  function updateTrigger() {
    if (!txtEl) return;
    if (sel) { txtEl.textContent = _calFmt(sel); txtEl.className = 'dob-trigger-date'; }
    else      { txtEl.textContent = opts.placeholder || 'Select date'; txtEl.className = 'dob-trigger-placeholder'; }
    if (hidden) hidden.value = sel ? _calStr(sel) : '';
  }
  function openPopup() {
    _adminPickerRegistry.forEach(function(p){ p.close(); });
    popup.style.left = '0'; popup.style.right = 'auto';
    popup.classList.remove('hidden');
    trigger.classList.add('open'); trigger.setAttribute('aria-expanded','true');
    var rect = popup.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) { popup.style.left = 'auto'; popup.style.right = '0'; }
  }
  function closePopup() { popup.classList.add('hidden'); trigger.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); }

  function makeHdr(wrap, title, onTitle, onPrev, onNext) {
    var hdr  = _calEl('div','cal-header');
    var prev = _calEl('button','cal-nav-btn'); prev.type='button'; prev.innerHTML='&#8249;'; prev.onclick=onPrev;
    var ttl  = _calEl('button','cal-title-btn'); ttl.type='button'; ttl.textContent=title; ttl.onclick=onTitle;
    var next = _calEl('button','cal-nav-btn'); next.type='button'; next.innerHTML='&#8250;'; next.onclick=onNext;
    hdr.appendChild(prev); hdr.appendChild(ttl); hdr.appendChild(next);
    wrap.appendChild(hdr);
  }
  function renderDays(wrap) {
    makeHdr(wrap, _CAL_MONTHS[dispMonth]+' '+dispYear,
      function(){ view='months'; render(); },
      function(){ dispMonth--; if(dispMonth<0){dispMonth=11;dispYear--;} render(); },
      function(){ dispMonth++; if(dispMonth>11){dispMonth=0;dispYear++;} render(); }
    );
    var hdrRow = _calEl('div','cal-day-headers');
    _CAL_DAYS.forEach(function(d){ var dh=_calEl('div','cal-day-header'); dh.textContent=d; hdrRow.appendChild(dh); });
    wrap.appendChild(hdrRow);
    var grid    = _calEl('div','cal-grid');
    var firstDow = new Date(dispYear, dispMonth, 1).getDay();
    var offset   = firstDow === 0 ? 6 : firstDow - 1;
    var dimCur   = new Date(dispYear, dispMonth+1, 0).getDate();
    var dimPrev  = new Date(dispYear, dispMonth,   0).getDate();
    var cells = [];
    for (var i=offset-1; i>=0; i--) cells.push({d:dimPrev-i, m:dispMonth-1, y:dispYear, out:true});
    for (var d=1; d<=dimCur; d++)   cells.push({d:d,          m:dispMonth,   y:dispYear, out:false});
    while (cells.length < 42)       cells.push({d:cells.length-offset-dimCur+1, m:dispMonth+1, y:dispYear, out:true});
    cells.forEach(function(cell) {
      var btn = _calEl('button','cal-day-btn'); btn.type='button'; btn.textContent=cell.d;
      if (cell.out) btn.classList.add('cal-outside');
      var cellDate = new Date(cell.y, cell.m, cell.d); cellDate.setHours(0,0,0,0);
      var dis  = isDis(cellDate);
      var isSel = !cell.out && sel && cellDate.getTime() === new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()).getTime();
      var isTod = !cell.out && cellDate.getTime() === TODAY.getTime();
      if (isSel) btn.classList.add('cal-selected');
      else if (isTod) btn.classList.add('cal-today');
      if (dis) btn.classList.add('cal-disabled');
      btn.onclick = function() {
        if (dis) return;
        sel = cellDate;
        if (cell.out) { dispMonth=cell.m; dispYear=cell.y; if(dispMonth<0){dispMonth=11;dispYear--;} if(dispMonth>11){dispMonth=0;dispYear++;} }
        render(); updateTrigger(); closePopup();
      };
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
  }
  function renderMonths(wrap) {
    makeHdr(wrap, String(dispYear),
      function(){ yearStart=Math.floor(dispYear/20)*20+1; view='years'; render(); },
      function(){ dispYear--; render(); },
      function(){ dispYear++; render(); }
    );
    var grid = _calEl('div','cal-month-grid');
    _CAL_MONTHS.forEach(function(m,i){
      var btn = _calEl('button','cal-month-btn'); btn.type='button'; btn.textContent=m;
      var fom = new Date(dispYear,i,1); fom.setHours(0,0,0,0);
      var lom = new Date(dispYear,i+1,0); lom.setHours(0,0,0,0);
      var allDis = (maxDate && fom > maxDate) || (minDate && lom < minDate);
      var isSel  = sel && i===sel.getMonth() && dispYear===sel.getFullYear();
      var isTod  = i===TODAY.getMonth() && dispYear===TODAY.getFullYear();
      if (isSel) btn.classList.add('cal-selected'); else if(isTod) btn.classList.add('cal-today');
      if (allDis) btn.classList.add('cal-disabled');
      btn.onclick = function(){ if(allDis) return; dispMonth=i; view='days'; render(); };
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
  }
  function renderYears(wrap) {
    var end = yearStart + 19;
    makeHdr(wrap, yearStart+' – '+end,
      function(){ yearStart-=20; render(); },
      function(){ yearStart-=20; render(); },
      function(){ yearStart+=20; render(); }
    );
    var grid = _calEl('div','cal-year-grid');
    for (var y=yearStart; y<=end; y++) {
      (function(y){
        var btn = _calEl('button','cal-year-btn'); btn.type='button'; btn.textContent=y;
        var allDis = (maxDate && y > maxDate.getFullYear()) || (minDate && y < minDate.getFullYear());
        var isSel  = sel && y===sel.getFullYear();
        var isTod  = y===TODAY.getFullYear();
        if (isSel) btn.classList.add('cal-selected'); else if(isTod) btn.classList.add('cal-today');
        if (allDis) btn.classList.add('cal-disabled');
        btn.onclick = function(){ if(allDis) return; dispYear=y; view='months'; render(); };
        grid.appendChild(btn);
      })(y);
    }
    wrap.appendChild(grid);
  }
  function render() {
    widget.innerHTML = '';
    if (view === 'days') renderDays(widget);
    else if (view === 'months') renderMonths(widget);
    else renderYears(widget);
  }
  function reset() {
    sel = null; view = 'days';
    dispYear = TODAY.getFullYear(); dispMonth = TODAY.getMonth();
    render(); updateTrigger(); closePopup();
  }
  function setDate(dateStr) {
    if (!dateStr) { reset(); return; }
    var d = new Date(dateStr); d.setHours(0,0,0,0);
    if (isNaN(d.getTime())) { reset(); return; }
    sel = d; dispYear = d.getFullYear(); dispMonth = d.getMonth(); view = 'days';
    render(); updateTrigger();
  }

  render(); updateTrigger();
  trigger.addEventListener('click', function(e) { e.stopPropagation(); popup.classList.contains('hidden') ? openPopup() : closePopup(); });
  popup.addEventListener('click', function(e) { e.stopPropagation(); });
  document.addEventListener('click', function() { if (!popup.classList.contains('hidden')) closePopup(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePopup(); });

  var instance = { getValue: function(){ return sel ? _calStr(sel) : ''; }, reset: reset, close: closePopup, setDate: setDate };
  _adminPickerRegistry.push(instance);
  return instance;
}

var eventDatePicker = null;
var eventEndDatePicker = null;

// ── Highlight row helpers (Services panel) ────────────────────────
function addHlRow(listId) {
  var list = getEl(listId);
  if (!list) return;
  var row = document.createElement('div');
  row.className = 'hl-row';
  row.innerHTML = '<input type="text" class="fc hl-input" placeholder="Highlight point..."><button type="button" class="btn-hl-rm" onclick="rmHlRow(this)" title="Remove">🗑</button>';
  list.appendChild(row);
  row.querySelector('input').focus();
}
function rmHlRow(btn) {
  var row = btn.closest('.hl-row');
  if (row) row.remove();
}

// ── Toast notifications ───────────────────────────────────────────
function toast(msg, type) {
  var container = document.getElementById('toast');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast-item toast-' + (type || 'success');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function() { if(el.parentNode) el.parentNode.removeChild(el); }, 4000);
}

// ── Panel navigation ──────────────────────────────────────────────
var panelTitles = {
  overview:'Overview', bookings:'Appointments', contacts:'Inquiries',
  events:'Events', vaccines:'Vaccine Schedule', sections:'Page Sections',
  resources:'Health Resources', services:'Our Services', settings:'Site Settings',
  users:'User Accounts', audit:'Audit Log', profile:'My Profile', social:'Social Media'
};

function switchPanel(name) {
  // Editors cannot access user management or audit log panels
  if (CURRENT_USER_ROLE === 'editor' && (name === 'users' || name === 'audit')) name = 'profile';
  document.querySelectorAll('.nav-link').forEach(function(l) {
    l.classList.toggle('active', l.getAttribute('data-panel') === name);
  });
  document.querySelectorAll('.panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'panel-' + name);
  });
  var t = document.getElementById('page-title');
  if (t) t.textContent = panelTitles[name] || name;
}

// ── Modal helpers ─────────────────────────────────────────────────
function openModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('open');
}
function showErr(elId, msg) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
function clearErr(elId) {
  var el = document.getElementById(elId);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

// ── API wrapper ───────────────────────────────────────────────────
async function api(url, opts) {
  var res  = await fetch(url, opts);
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

// ── PDF viewer — synchronous anchor click ────────────────────────
// Must stay synchronous (no fetch/await before click) so the browser
// preserves the user-gesture context. Any async gap breaks popup-blocker
// exemption and the click is silently swallowed.
function openPdf(filePath) {
  var base = (filePath || '').split('?')[0];
  if (!base) return;
  var a = document.createElement('a');
  a.href = base + '?_t=' + Date.now();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Remove DOM element safely ─────────────────────────────────────
function rmEl(id) { var el = document.getElementById(id); if (el) el.remove(); }
function getEl(id) { return document.getElementById(id); }
function val(id) { var el = getEl(id); return el ? el.value.trim() : ''; }
function setVal(id, v) { var el = getEl(id); if (el) el.value = v; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Booking filter ────────────────────────────────────────────────
function filterBookings(status) {
  document.querySelectorAll('.fb').forEach(function(b) {
    b.classList.toggle('active', b.textContent.trim() === status);
  });
  var visible = 0;
  document.querySelectorAll('.brow').forEach(function(r) {
    var show = status === 'All' || r.getAttribute('data-status') === status;
    r.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  var noRow = document.querySelector('.no-rows');
  if (noRow) noRow.style.display = visible === 0 ? '' : 'none';
}

// ════════════════════════════════════════════════════════════════
// BOOKINGS
// ════════════════════════════════════════════════════════════════

async function bookingStatus(id, status) {
  try {
    await api('/api/admin/bookings/status', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({id: id, status: status})
    });
    toast('Booking updated to ' + status, 'success');
    var badge = getEl('bst-' + id);
    if (badge) { badge.className = 'badge b-' + status.toLowerCase(); badge.textContent = status; }
    var row = getEl('brow-' + id);
    if (row) row.setAttribute('data-status', status);
    // Refresh pending count
    var pending = document.querySelectorAll('.brow[data-status="Pending"]').length;
    var nb = getEl('nb-pending'); if (nb) nb.textContent = pending;
    var sp = getEl('stat-pending'); if (sp) sp.textContent = pending;
  } catch(e) { toast(e.message, 'danger'); }
}

async function delBooking(id) {
  try {
    await api('/api/admin/bookings/' + id, {method: 'DELETE'});
    rmEl('brow-' + id);
    toast('Booking deleted.', 'success');
    var total = document.querySelectorAll('.brow').length;
    var sb = getEl('stat-bookings'); if (sb) sb.textContent = total;
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// CONTACTS
// ════════════════════════════════════════════════════════════════

async function contactStatus(id, status) {
  try {
    await api('/api/admin/contacts/status', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({id: id, status: status})
    });
    toast('Inquiry marked as ' + status, 'success');
    var badge = getEl('cst-' + id);
    if (badge) { badge.className = 'badge b-' + status.toLowerCase(); badge.textContent = status; }
    rmEl('cbtn-' + id);
  } catch(e) { toast(e.message, 'danger'); }
}

async function delContact(id) {
  try {
    await api('/api/admin/contacts/' + id, {method: 'DELETE'});
    rmEl('icard-' + id);
    toast('Inquiry deleted.', 'success');
    var sc = getEl('stat-contacts');
    if (sc) sc.textContent = parseInt(sc.textContent) - 1;
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// VACCINES
// ════════════════════════════════════════════════════════════════

function openVaccineModal(id) {
  clearErr('v-err');
  if (id) {
    var v = null;
    for (var i = 0; i < vaccinesData.length; i++) { if (vaccinesData[i].id === id) { v = vaccinesData[i]; break; } }
    if (!v) { toast('Reload the page and try again.', 'warning'); return; }
    setVal('v-id', v.id); setVal('v-name', v.name);
    setVal('v-age', v.age_text); setVal('v-days', v.offset_days);
    setVal('v-diseases', v.diseases || '');
    var t = getEl('vmodal-title'); if (t) t.textContent = 'Edit Vaccine Entry';
  } else {
    setVal('v-id',''); setVal('v-name',''); setVal('v-age',''); setVal('v-days',''); setVal('v-diseases','');
    var t = getEl('vmodal-title'); if (t) t.textContent = 'Add Vaccine Entry';
  }
  openModal('modal-vaccine');
}

async function saveVaccine() {
  clearErr('v-err');
  var id       = val('v-id');
  var name     = val('v-name');
  var age_text = val('v-age');
  var offset   = val('v-days');
  var diseases = val('v-diseases');
  if (!name || !age_text || offset === '') { showErr('v-err','Name, age text, and offset days are required.'); return; }
  var url = id ? '/api/admin/vaccines/' + id : '/api/admin/vaccines';
  try {
    await api(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name:name, age_text:age_text, offset_days:offset, diseases:diseases})
    });
    toast(id ? 'Vaccine updated.' : 'Vaccine added.', 'success');
    closeModal('modal-vaccine');
    setTimeout(function(){location.reload();}, 600);
  } catch(e) { showErr('v-err', e.message); }
}

async function delVaccine(id) {
  try {
    await api('/api/admin/vaccines/' + id, {method: 'DELETE'});
    rmEl('vrow-' + id);
    toast('Vaccine entry deleted.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

async function moveVaccine(id, direction) {
  try {
    var d = await api('/api/admin/vaccines/' + id + '/move', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({direction: direction})
    });
    if (!d.moved) {
      toast('Already at the ' + (direction==='up'?'top':'bottom') + ' of its day-group.', 'warning');
      return;
    }
    // Live DOM swap — no reload, stays on current panel
    var row = getEl('vrow-' + id);
    if (row) {
      if (direction === 'up') {
        var prev = row.previousElementSibling;
        if (prev) row.parentNode.insertBefore(row, prev);
      } else {
        var next = row.nextElementSibling;
        if (next) row.parentNode.insertBefore(next, row);
      }
      // Refresh serial # column
      var tbody = getEl('vaccines-tbody');
      if (tbody) {
        var rows = tbody.querySelectorAll('tr[id^="vrow-"]');
        for (var i = 0; i < rows.length; i++) {
          var firstCell = rows[i].querySelector('td:first-child');
          if (firstCell) firstCell.textContent = i + 1;
        }
      }
    }
    toast('Order updated.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// SECTIONS
// ════════════════════════════════════════════════════════════════

function openSectionModal(id) {
  clearErr('s-err');
  setVal('s-image', '');
  if (id) {
    var s = null;
    for (var i = 0; i < sectionsData.length; i++) { if (sectionsData[i].id === id) { s = sectionsData[i]; break; } }
    if (!s) { toast('Reload the page and try again.', 'warning'); return; }
    setVal('s-id', s.id); setVal('s-title', s.title); setVal('s-content', s.content);
    var cb = getEl('s-visible'); if (cb) cb.checked = s.is_visible === 1 || s.is_visible === true;
    var t = getEl('smodal-title'); if (t) t.textContent = 'Edit Section';
  } else {
    setVal('s-id',''); setVal('s-title',''); setVal('s-content','');
    var cb = getEl('s-visible'); if (cb) cb.checked = true;
    var t = getEl('smodal-title'); if (t) t.textContent = 'Add Section';
  }
  openModal('modal-section');
}

async function saveSection() {
  clearErr('s-err');
  var id      = val('s-id');
  var title   = val('s-title');
  var content = val('s-content');
  var visEl   = getEl('s-visible');
  var imgEl   = getEl('s-image');
  if (!title || !content) { showErr('s-err','Title and content are required.'); return; }
  var fd = new FormData();
  fd.append('title', title);
  fd.append('content', content);
  fd.append('is_visible', visEl && visEl.checked ? '1' : '0');
  if (imgEl && imgEl.files.length) fd.append('image', imgEl.files[0]);
  var url = id ? '/api/admin/sections/' + id : '/api/admin/sections';
  try {
    await fetch(url, {method:'POST', body:fd}).then(function(r){ return r.json(); }).then(function(d){ if(!d.success) throw new Error(d.error||'Failed'); });
    toast(id ? 'Section updated.' : 'Section added.', 'success');
    closeModal('modal-section');
    setTimeout(function(){location.reload();}, 600);
  } catch(e) { showErr('s-err', e.message); }
}

async function delSection(id) {
  try {
    await api('/api/admin/sections/' + id, {method:'DELETE'});
    rmEl('srow-' + id);
    toast('Section deleted.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

async function moveSection(id, direction) {
  try {
    var d = await api('/api/admin/sections/' + id + '/move', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({direction: direction})
    });
    if (d && d.moved === false) {
      toast('Already at the ' + (direction==='up'?'top':'bottom') + '.', 'warning');
      return;
    }
    // Live DOM swap — stay on current panel
    var row = getEl('srow-' + id);
    if (row) {
      if (direction === 'up') {
        var prev = row.previousElementSibling;
        if (prev) row.parentNode.insertBefore(row, prev);
      } else {
        var next = row.nextElementSibling;
        if (next) row.parentNode.insertBefore(next, row);
      }
    }
    toast('Order updated.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════════════════════════

function openEventModal(id) {
  clearErr('e-err');
  setVal('e-image',''); setVal('e-pdf','');
  if (id) {
    var ev = null;
    for (var i = 0; i < eventsData.length; i++) { if (eventsData[i].id === id) { ev = eventsData[i]; break; } }
    if (!ev) { toast('Reload and try again.', 'warning'); return; }
    setVal('e-id', ev.id); setVal('e-title', ev.title);
    if (eventDatePicker) eventDatePicker.setDate(ev.event_date || '');
    if (eventEndDatePicker) eventEndDatePicker.setDate(ev.event_end_date || '');
    setVal('e-time', ev.event_time || '');
    setVal('e-location', ev.location || ''); setVal('e-category', ev.category || 'General');
    setVal('e-desc', ev.description);
    var pb = getEl('e-published'); if (pb) pb.checked = ev.is_published === 1;
    var t = getEl('emodal-title'); if (t) t.textContent = 'Edit Event';
  } else {
    ['e-id','e-title','e-time','e-location','e-desc'].forEach(function(id){setVal(id,'');});
    if (eventDatePicker) eventDatePicker.reset();
    if (eventEndDatePicker) eventEndDatePicker.reset();
    setVal('e-category','General');
    var pb = getEl('e-published'); if (pb) pb.checked = false;
    var t = getEl('emodal-title'); if (t) t.textContent = 'New Event';
  }
  openModal('modal-event');
}

async function saveEvent() {
  clearErr('e-err');
  var id    = val('e-id');
  var title = val('e-title');
  var desc  = val('e-desc');
  var date    = eventDatePicker    ? eventDatePicker.getValue()    : val('e-date');
  var endDate = eventEndDatePicker ? eventEndDatePicker.getValue() : val('e-end-date');
  if (!title || !desc) { showErr('e-err','Title and description are required.'); return; }
  var fd = new FormData();
  fd.append('title', title);
  fd.append('description', desc);
  fd.append('event_date', date);
  fd.append('event_end_date', endDate);
  fd.append('event_time', val('e-time'));
  fd.append('location',   val('e-location'));
  fd.append('category',   val('e-category'));
  var pb = getEl('e-published');
  fd.append('is_published', pb && pb.checked ? '1' : '0');
  var imgEl = getEl('e-image'); if (imgEl && imgEl.files.length) fd.append('cover_image', imgEl.files[0]);
  var pdfEl = getEl('e-pdf');   if (pdfEl && pdfEl.files.length) fd.append('pdf_file',    pdfEl.files[0]);
  var url = id ? '/api/admin/events/' + id : '/api/admin/events';
  try {
    await fetch(url, {method:'POST', body:fd}).then(function(r){return r.json();}).then(function(d){if(!d.success)throw new Error(d.error||'Failed');});
    toast(id ? 'Event updated.' : 'Event created.', 'success');
    closeModal('modal-event');
    setTimeout(function(){location.reload();}, 600);
  } catch(e) { showErr('e-err', e.message); }
}

async function togglePublish(id) {
  try {
    var d = await api('/api/admin/events/' + id + '/publish', {method:'POST'});
    var badge = getEl('evst-' + id);
    if (badge) {
      badge.textContent  = d.is_published ? 'Published' : 'Draft';
      badge.className    = 'badge ' + (d.is_published ? 'b-published' : 'b-draft');
    }
    toast('Event ' + (d.is_published ? 'published' : 'unpublished') + '.', 'success');
    for (var i=0;i<eventsData.length;i++){if(eventsData[i].id===id){eventsData[i].is_published=d.is_published;break;}}
  } catch(e) { toast(e.message, 'danger'); }
}

async function delEvent(id) {
  try {
    await api('/api/admin/events/' + id, {method:'DELETE'});
    rmEl('evrow-' + id);
    toast('Event deleted.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════════

function openResourceModal(id) {
  clearErr('r-err');
  if (id) {
    var rc = null;
    for (var i = 0; i < resourcesData.length; i++) { if (resourcesData[i].id === id) { rc = resourcesData[i]; break; } }
    if (!rc) { toast('Reload and try again.', 'warning'); return; }
    setVal('r-id', rc.id); setVal('r-title', rc.title);
    setVal('r-type', rc.type || 'GUIDE'); setVal('r-desc', rc.description || '');
    setVal('r-visible', rc.is_visible ? '1' : '0');
    var t = getEl('rmodal-title'); if (t) t.textContent = 'Edit Resource';
  } else {
    setVal('r-id',''); setVal('r-title',''); setVal('r-type','GUIDE'); setVal('r-desc',''); setVal('r-visible','1');
    var t = getEl('rmodal-title'); if (t) t.textContent = 'Add Resource';
  }
  openModal('modal-resource');
}

async function saveResource() {
  clearErr('r-err');
  var id      = val('r-id');
  var title   = val('r-title');
  var typeEl  = getEl('r-type');
  var visEl   = getEl('r-visible');
  var desc    = val('r-desc');
  if (!title) { showErr('r-err', 'Title is required.'); return; }
  var type    = typeEl ? typeEl.value : 'GUIDE';
  var visible = visEl ? visEl.value : '1';
  try {
    if (id) {
      await api('/api/admin/resources/' + id + '/meta', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({title:title, type:type, description:desc, is_visible:visible})
      });
      // Update local data
      for (var i = 0; i < resourcesData.length; i++) {
        if (resourcesData[i].id === parseInt(id)) {
          resourcesData[i].title = title; resourcesData[i].type = type;
          resourcesData[i].description = desc; resourcesData[i].is_visible = parseInt(visible);
          break;
        }
      }
      toast('Resource updated.', 'success');
    } else {
      var d = await api('/api/admin/resources', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({title:title, type:type, description:desc})
      });
      toast('Resource created.', 'success');
      // Add to local data and DOM
      var newRc = {id:d.id, title:title, type:type, description:desc, file_path:'', original_filename:'', is_visible:1};
      resourcesData.push(newRc);
      var tbody = getEl('resources-tbody');
      if (tbody) {
        var tr = document.createElement('tr');
        tr.id = 'rcrow-' + d.id;
        tr.innerHTML = buildResourceRow(newRc);
        tbody.appendChild(tr);
      }
    }
    closeModal('modal-resource');
    if (id) setTimeout(function(){location.reload();}, 400);
  } catch(e) { showErr('r-err', e.message); }
}

function buildResourceRow(rc) {
  var fileBadge = rc.file_path
    ? '<span class="badge" style="background:#D1FAE5;color:#065F46;font-size:.7rem">Attached</span><button class="btn-pdf-view" onclick="openPdf(\'' + rc.file_path + '\')" style="margin-left:6px;font-size:.74rem">View</button>'
    : '<span class="badge" style="background:#FEE2E2;color:#991B1B;font-size:.7rem">No File</span>';
  var canDelete = CURRENT_USER_ROLE === 'admin' || CURRENT_USER_ROLE === 'manager';
  var removeBtn = (rc.file_path && canDelete) ? '<button class="ib ib-del" onclick="delResourceFile(' + rc.id + ')" title="Remove File">🗑📎</button>' : '';
  var deleteBtn = canDelete ? '<button class="ib ib-del" onclick="delResource(' + rc.id + ')" title="Delete Resource">🗑</button>' : '';
  return '<td><strong style="font-size:.85rem">' + escHtml(rc.title) + '</strong></td>'
    + '<td><span class="badge" style="background:#EEF4FF;color:var(--primary);font-size:.7rem">' + escHtml(rc.type) + '</span></td>'
    + '<td id="rcfile-' + rc.id + '">' + fileBadge + '</td>'
    + '<td><span class="badge ' + (rc.is_visible ? 'b-published' : 'b-draft') + '">' + (rc.is_visible ? 'Yes' : 'No') + '</span></td>'
    + '<td><div class="act-row">'
    + '<button class="ib ib-edit" onclick="openResourceModal(' + rc.id + ')" title="Edit">✎</button>'
    + '<label class="ib ib-edit" title="Upload File" style="cursor:pointer">📎<input type="file" id="rfile-' + rc.id + '" accept=".pdf,.doc,.docx" style="display:none" onchange="uploadResourceFile(' + rc.id + ',this)"></label>'
    + removeBtn + deleteBtn
    + '</div></td>';
}

async function uploadResourceFile(id, input) {
  if (!input || !input.files.length) return;
  var fd = new FormData();
  fd.append('file', input.files[0]);
  try {
    var d = await fetch('/api/admin/resources/' + id + '/file', {method:'POST', body:fd}).then(function(r){return r.json();});
    if (!d.success) throw new Error(d.error || 'Upload failed.');
    input.value = '';
    // Update local data
    for (var i = 0; i < resourcesData.length; i++) {
      if (resourcesData[i].id === id) { resourcesData[i].file_path = d.path; resourcesData[i].original_filename = d.original_filename; break; }
    }
    // Update file cell in DOM
    var cell = getEl('rcfile-' + id);
    if (cell) {
      cell.innerHTML = '<span class="badge" style="background:#D1FAE5;color:#065F46;font-size:.7rem">Attached</span>'
        + '<button class="btn-pdf-view" onclick="openPdf(\'' + d.path + '\')" style="margin-left:6px;font-size:.74rem">View</button>';
    }
    toast('File uploaded: ' + d.original_filename, 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

async function delResourceFile(id) {
  try {
    await api('/api/admin/resources/' + id + '/file', {method:'DELETE'});
    for (var i = 0; i < resourcesData.length; i++) {
      if (resourcesData[i].id === id) { resourcesData[i].file_path = ''; resourcesData[i].original_filename = ''; break; }
    }
    var cell = getEl('rcfile-' + id);
    if (cell) cell.innerHTML = '<span class="badge" style="background:#FEE2E2;color:#991B1B;font-size:.7rem">No File</span>';
    toast('File removed.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

async function delResource(id) {
  try {
    await api('/api/admin/resources/' + id, {method:'DELETE'});
    rmEl('rcrow-' + id);
    resourcesData = resourcesData.filter(function(rc){ return rc.id !== id; });
    toast('Resource deleted.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════

async function createUser() {
  clearErr('user-create-err');
  var username = val('nu-username');
  var password = val('nu-password');
  var roleEl   = getEl('nu-role');
  var role     = roleEl ? roleEl.value : 'editor';
  if (!username || !password) { showErr('user-create-err','Username and password are required.'); return; }
  try {
    var d = await api('/api/admin/users', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:username, password:password, role:role})
    });
    toast('User "' + username + '" created.', 'success');
    setVal('nu-username',''); setVal('nu-password',''); if(roleEl) roleEl.value='editor';
    // Add row to table
    var tbody = getEl('users-tbody');
    if (tbody) {
      var tr = document.createElement('tr');
      tr.id = 'urow-' + d.userId;
      tr.innerHTML = '<td><strong>' + escHtml(username) + '</strong></td>'
        + '<td><span class="badge b-' + escHtml(role) + '">' + escHtml(role) + '</span></td>'
        + '<td style="color:var(--muted);font-size:.78rem">Just Now</td>'
        + '<td><div class="act-row">'
        + '<button class="ib ib-key" onclick="openPwdModal(' + d.userId + ',\'' + username + '\')" title="Change Password">🔑</button>'
        + (CURRENT_USER_ROLE==='admin'?'<button class="ib ib-del" onclick="delUser('+d.userId+')" title="Delete">🗑</button>':'')
        + '</div></td>';
      tbody.appendChild(tr);
    }
  } catch(e) { showErr('user-create-err', e.message); }
}

async function delUser(id) {
  try {
    await api('/api/admin/users/' + id, {method:'DELETE'});
    rmEl('urow-' + id);
    toast('User deleted.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

function openPwdModal(userId, username) {
  setVal('pwd-userid', userId);
  var un = getEl('pwd-username'); if (un) un.textContent = username;
  setVal('pwd-new', '');
  clearErr('pwd-err');
  openModal('modal-pwd');
}

async function changePwd() {
  clearErr('pwd-err');
  var userId = val('pwd-userid');
  var newPwd = val('pwd-new');
  if (!newPwd || newPwd.length < 6) { showErr('pwd-err','Password must be at least 6 characters.'); return; }
  try {
    await api('/api/admin/users/change-password', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({userId:userId, newPassword:newPwd})
    });
    toast('Password updated.', 'success');
    closeModal('modal-pwd');
  } catch(e) { showErr('pwd-err', e.message); }
}

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════

async function uploadSettingImg(field) {
  var fi = getEl('fi-' + field);
  if (!fi || !fi.files.length) { toast('Select an image first.', 'warning'); return; }
  var fd = new FormData();
  fd.append('image', fi.files[0]);
  fd.append('field', field);
  try {
    var d = await fetch('/api/admin/upload-setting-image', {method:'POST', body:fd}).then(function(r){return r.json();});
    if (!d.success) throw new Error(d.error || 'Upload failed.');
    var box = getEl('prev-' + field);
    if (box) box.innerHTML = '<img src="' + d.path + '" class="img-prev" alt="">';
    fi.value = '';
    toast('Image updated.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

async function uploadResourcePdf(n) {
  var fi = getEl('pdf-' + n);
  if (!fi || !fi.files.length) { toast('Select a PDF first.', 'warning'); return; }
  var fd = new FormData();
  fd.append('pdf', fi.files[0]);
  try {
    var d = await fetch('/api/admin/resources/' + n + '/pdf', {method:'POST', body:fd}).then(function(r){return r.json();});
    if (!d.success) throw new Error(d.error || 'Upload failed.');
    fi.value = '';
    // Live DOM update — no page reload needed
    var badge = getEl('res-badge-' + n);
    if (badge) {
      badge.textContent = 'PDF attached';
      badge.style.background = '#D1FAE5';
      badge.style.color = '#065F46';
    }
    var viewSpan = getEl('res-view-' + n);
    if (viewSpan) {
      viewSpan.innerHTML = '<button class="btn-pdf-view" onclick="openPdf(\'' + d.path + '\')">View ↗</button>';
    }
    var removeSpan = getEl('res-remove-' + n);
    if (removeSpan && (CURRENT_USER_ROLE === 'admin' || CURRENT_USER_ROLE === 'manager')) {
      removeSpan.innerHTML = '<button class="btn btn-danger btn-sm" onclick="delResourcePdf(' + n + ')">Remove</button>';
    }
    toast('PDF uploaded — live on website now.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

async function delResourcePdf(n) {
  try {
    await api('/api/admin/resources/' + n + '/pdf', {method:'DELETE'});
    // Live DOM update
    var badge = getEl('res-badge-' + n);
    if (badge) {
      badge.textContent = 'No PDF';
      badge.style.background = '#FEE2E2';
      badge.style.color = '#991B1B';
    }
    var viewSpan = getEl('res-view-' + n);
    if (viewSpan) viewSpan.innerHTML = '';
    var removeSpan = getEl('res-remove-' + n);
    if (removeSpan) removeSpan.innerHTML = '';
    toast('PDF removed.', 'success');
  } catch(e) { toast(e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════════════
// DOM READY
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {

  // Event date pickers
  eventDatePicker = createAdminDatePicker({
    widgetId: 'e-date-widget', triggerId: 'e-date-trigger',
    triggerTextId: 'e-date-trigger-text', popupId: 'e-date-popup',
    hiddenId: 'e-date', placeholder: 'Start date'
  });
  eventEndDatePicker = createAdminDatePicker({
    widgetId: 'e-end-date-widget', triggerId: 'e-end-date-trigger',
    triggerTextId: 'e-end-date-trigger-text', popupId: 'e-end-date-popup',
    hiddenId: 'e-end-date', placeholder: 'End date'
  });

  // Sidebar navigation
  document.querySelectorAll('.nav-link').forEach(function(link) {
    link.addEventListener('click', function() {
      switchPanel(link.getAttribute('data-panel'));
    });
  });

  // Services form
  var svf = document.getElementById('services-form');
  if (svf) {
    svf.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('save-services-btn');
      var orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving...';
      var obj = {};
      new FormData(svf).forEach(function(v, k) { obj[k] = v; });
      // Collect dynamic highlight rows and map to hl_1..hl_8 keys
      ['vax','fp','anc','autism'].forEach(function(svc) {
        var list = getEl('hl-' + svc);
        if (!list) return;
        var values = [];
        list.querySelectorAll('.hl-input').forEach(function(inp) {
          var v = inp.value.trim();
          if (v) values.push(v);
        });
        for (var i = 0; i < 8; i++) {
          obj['service_' + svc + '_hl_' + (i + 1)] = values[i] || '';
        }
      });
      try {
        await api('/api/admin/settings', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(obj)
        });
        toast('Services saved — live on website now!', 'success');
      } catch(e) { toast(e.message, 'danger'); }
      btn.disabled = false; btn.textContent = orig;
    });
  }

  // Social media form
  var socf = document.getElementById('social-form');
  if (socf) {
    socf.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('save-social-btn');
      var orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving...';
      var obj = {};
      new FormData(socf).forEach(function(v, k) { obj[k] = v; });
      try {
        await api('/api/admin/settings', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(obj)
        });
        toast('Social links saved — live on website now!', 'success');
      } catch(e) { toast(e.message, 'danger'); }
      btn.disabled = false; btn.textContent = orig;
    });
  }

  // Settings form
  var sf = document.getElementById('settings-form');
  if (sf) {
    sf.addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('save-settings-btn');
      var orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving...';
      var obj = {};
      new FormData(sf).forEach(function(v,k){ obj[k]=v; });
      try {
        await api('/api/admin/settings', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(obj)
        });
        toast('Settings saved successfully!', 'success');
      } catch(e) { toast(e.message, 'danger'); }
      btn.disabled = false; btn.textContent = orig;
    });
  }
});
