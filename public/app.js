// Global — called by resource View buttons via inline onclick
// Must be outside DOMContentLoaded so onclick attributes can reach it
function viewResource(filePath) {
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

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. MOBILE MENU TOGGLE
  // ==========================================
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('open');
      navMenu.classList.toggle('open');
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburgerBtn.classList.remove('open');
        navMenu.classList.remove('open');

        // Manual active class toggle
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Reset calculator so results never persist across navigation
        if (calcResults) calcResults.classList.add('hidden');
        if (timelineTableBody) timelineTableBody.innerHTML = '';
        dobPicker.reset();
      });
    });
  }

  // ==========================================
  // 2. SCROLL ACTION & NAVIGATION VISUALS
  // ==========================================
  const sections = document.querySelectorAll('section[id]');
  
  function highlightNavOnScroll() {
    const scrollY = window.pageYOffset;
    
    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 100;
      const sectionId = current.getAttribute('id');
      
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        document.querySelector(`.nav-menu a[data-sec*=${sectionId}]`)?.classList.add('active');
      } else {
        document.querySelector(`.nav-menu a[data-sec*=${sectionId}]`)?.classList.remove('active');
      }
    });
  }
  
  window.addEventListener('scroll', highlightNavOnScroll);

  // Logo home navigation
  const homeLogo = document.getElementById('home-logo');
  if (homeLogo) {
    homeLogo.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navLinks.forEach(l => l.classList.remove('active'));
      document.querySelector('.nav-link[data-sec="hero"]')?.classList.add('active');
      if (calcResults) calcResults.classList.add('hidden');
      if (timelineTableBody) timelineTableBody.innerHTML = '';
      dobPicker.reset();
    });
  }

  // ==========================================
  // 3. BOOKING MODAL LOGIC
  // ==========================================
  const bookingModal = document.getElementById('bookingModal');
  const openBookingBtn = document.getElementById('openBookingBtn');
  const closeBookingBtn = document.getElementById('closeBookingBtn');
  const bookingForm = document.getElementById('bookingForm');
  const bookingSuccess = document.getElementById('bookingSuccess');
  

  // Open Modal function
  function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Stop body scrolling
  }

  // Close Modal function
  function closeModal(modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Resume body scrolling
  }

  if (openBookingBtn && bookingModal && closeBookingBtn) {
    openBookingBtn.addEventListener('click', () => {
      // Reset form states
      bookingForm.classList.remove('hidden');
      bookingSuccess.classList.add('hidden');
      bookingForm.reset();
      bookDobPicker.reset(); bookDatePicker.reset();
      openModal(bookingModal);
    });

    closeBookingBtn.addEventListener('click', () => {
      closeModal(bookingModal);
    });

    // Close when clicking outside of modal container
    bookingModal.addEventListener('click', (e) => {
      if (e.target === bookingModal) {
        closeModal(bookingModal);
      }
    });
  }

  // Form Booking Submission
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const patientName = document.getElementById('bookName').value;
      const phoneNum = document.getElementById('bookPhone').value;
      const service = document.getElementById('bookService').value;
      const appointmentDate = bookDatePicker.getValue();
      const dob = bookDobPicker.getValue();
      if (!appointmentDate) { alert('Please select a Preferred Appointment Date.'); submitBtn.disabled = false; submitBtn.textContent = originalText; return; }
      const timeSlot = document.getElementById('bookTime').value;
      
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Request...';

      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            patientName,
            phone: phoneNum,
            dob,
            service,
            appointmentDate,
            timeSlot
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Basic formatting for output
          const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          // Show success info
          document.getElementById('successPatientName').textContent = patientName;
          document.getElementById('successServiceName').textContent = service;
          document.getElementById('successDate').textContent = formattedDate;
          document.getElementById('successPhone').textContent = phoneNum;

          // Swap views
          bookingForm.classList.add('hidden');
          bookingSuccess.classList.remove('hidden');
        } else {
          alert(data.error || 'Failed to register appointment booking. Please try again.');
        }
      } catch (err) {
        alert('Connection error. Could not reach server.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });

    const closeSuccessBtn = document.getElementById('closeSuccessBtn');
    if (closeSuccessBtn) {
      closeSuccessBtn.addEventListener('click', () => {
        closeModal(bookingModal);
      });
    }
  }

  // ==========================================
  // 4. SERVICE DETAIL MODALS
  // ==========================================
  const serviceDetailModal = document.getElementById('serviceDetailModal');
  const closeServiceDetailBtn = document.getElementById('closeServiceDetailBtn');
  const serviceDetailContent = document.getElementById('serviceDetailContent');
  
  // Data for service details (loaded from server window configs if available)
  const serviceDetails = window.serviceDetails || {
    'vaccination': {
      title: 'EPI Vaccination Services',
      description: 'The Expanded Programme on Immunization (EPI) is a vital global health initiative aimed at protecting infants, children, and pregnant women from vaccine-preventable diseases. At Bliss Bangladesh, we operate a fully authorized vaccination wing conforming to the World Health Organization (WHO) and government guidelines.',
      highlights: [
        'Free governmental routine child vaccines (BCG, Pentavalent, OPV, PCV, MR).',
        'Adult immunization schedules (Hep B, Tetanus, Influenza).',
        'Temperature-controlled cold-chain system for maximum vaccine efficacy.',
        'Official immunization card tracking for school admission & travel.'
      ]
    },
    'family-planning': {
      title: 'Confidential Family Planning',
      description: 'Making informed reproductive choices is foundational to family health and empowerment. Bliss Bangladesh provides comprehensive, respectful, and fully confidential family planning counseling and services overseen by certified specialists.',
      highlights: [
        'Personal consultations with female doctors and counselors.',
        'Temporary birth control options (oral contraceptives, barrier methods, 3-month injections).',
        'Long-acting reversible contraceptives (IUDs, subdermal implants).',
        'Post-partum family planning advice and educational guides.'
      ]
    },
    'antenatal': {
      title: 'Comprehensive Antenatal Care',
      description: 'Antenatal care (ANC) is the clinical care provided to pregnant individuals to ensure the best health conditions for both mother and baby. Our prenatal packages focus on monitoring, early detection of complications, and preparing parents for a safe delivery.',
      highlights: [
        'Regular checkups including blood pressure, weight, and fetal heart rate monitoring.',
        'Diagnostic laboratory tests (blood profiling, blood sugar screening, urine analysis).',
        'Ultrasonography scanning by experienced sonologists.',
        'Prescriptions for vital micronutrients (iron, folic acid, calcium) and diet counseling.'
      ]
    },
    'autism': {
      title: 'Autism Support & Therapy',
      description: 'Neurodevelopmental growth is unique for every child. Bliss Bangladesh hosts an expert-led Autism and Developmental Support Unit designed to assist children with autism spectrum conditions (ASC) and other sensory-cognitive differences in achieving their full potential.',
      highlights: [
        'Early diagnostic screening and standardized developmental assessments.',
        'One-on-one occupational therapy and sensory integration sessions.',
        'Speech and language therapy to support communication milestones.',
        'Family counseling and parent-led home training programs.'
      ]
    }
  };

  // Wire up "Learn More" buttons
  document.querySelectorAll('.learn-more-btn, .service-card').forEach(element => {
    element.addEventListener('click', (e) => {
      // Prevent double trigger if clicking button inside the card
      e.stopPropagation();
      
      let serviceKey = '';
      if (element.classList.contains('service-card')) {
        serviceKey = element.getAttribute('data-service-id');
      } else {
        serviceKey = element.getAttribute('data-service');
      }

      if (serviceKey && serviceDetails[serviceKey]) {
        populateAndOpenServiceDetail(serviceKey);
      }
    });
  });

  function populateAndOpenServiceDetail(key) {
    const data = serviceDetails[key];
    
    // Create HTML structure for modal details
    let highlightsHtml = '';
    data.highlights.forEach(hl => {
      if (!hl || !hl.trim()) return;
      highlightsHtml += `
        <li>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>${hl}</span>
        </li>
      `;
    });

    serviceDetailContent.innerHTML = `
      <div class="svc-detail-header">
        <div class="service-icon-wrapper">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0040A5" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 8 12 12 16 14"/>
          </svg>
        </div>
        <h3>${data.title}</h3>
      </div>
      <div class="svc-detail-body">
        <p>${data.description}</p>
        <h4 style="margin-top:20px; color: var(--color-dark);">What we provide:</h4>
        <ul class="svc-detail-highlights">
          ${highlightsHtml}
        </ul>
        <div style="margin-top: 30px; display: flex; gap: 12px;">
          <button class="btn btn-primary" id="svcBookBtn" data-service-name="${data.title}">Book This Service</button>
          <button class="btn btn-secondary" id="svcCloseBtn">Close</button>
        </div>
      </div>
    `;

    openModal(serviceDetailModal);

    // Modal Close
    document.getElementById('svcCloseBtn').addEventListener('click', () => {
      closeModal(serviceDetailModal);
    });

    // Book from service modal action
    document.getElementById('svcBookBtn').addEventListener('click', (e) => {
      const selectedServiceName = e.target.getAttribute('data-service-name');
      closeModal(serviceDetailModal);
      
      // Open booking modal
      bookingForm.classList.remove('hidden');
      bookingSuccess.classList.add('hidden');
      bookingForm.reset();
      bookDobPicker.reset(); bookDatePicker.reset();

      // Auto-select corresponding service
      const selectElem = document.getElementById('bookService');
      if (selectElem) {
        if (selectedServiceName.includes('Vaccination')) selectElem.value = 'EPI Vaccination';
        else if (selectedServiceName.includes('Family')) selectElem.value = 'Family Planning';
        else if (selectedServiceName.includes('Antenatal')) selectElem.value = 'Antenatal Care';
        else if (selectedServiceName.includes('Autism')) selectElem.value = 'Autism Support';
      }

      openModal(bookingModal);
    });
  }

  if (closeServiceDetailBtn && serviceDetailModal) {
    closeServiceDetailBtn.addEventListener('click', () => {
      closeModal(serviceDetailModal);
    });
    
    serviceDetailModal.addEventListener('click', (e) => {
      if (e.target === serviceDetailModal) {
        closeModal(serviceDetailModal);
      }
    });
  }

  // ==========================================
  // 5. VACCINATION TIMELINE CALCULATOR
  // ==========================================
  const openScheduleBtn = document.getElementById('openScheduleBtn');
  const calcScheduleBtn = document.getElementById('calcScheduleBtn');
  const calcResults     = document.getElementById('calcResults');
  const timelineTableBody = document.getElementById('timelineTableBody');

  // ── Calendar picker factory ─────────────────────────────────────
  // Shared helpers
  const CAL_MONTHS = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const CAL_DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function calEl(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function calFmtDate(d)   { return d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }); }
  function calDateStr(d)   { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  function createDatePicker(opts) {
    // opts: widgetId, triggerId, triggerTextId, popupId, minDate, maxDate, defaultDate, placeholder
    const TODAY = new Date(); TODAY.setHours(0,0,0,0);
    const minDate = opts.minDate || null;
    const maxDate = opts.maxDate || null;

    let sel       = opts.defaultDate ? new Date(opts.defaultDate) : null;
    let view      = 'days';
    let dispYear  = (sel || TODAY).getFullYear();
    let dispMonth = (sel || TODAY).getMonth();
    let yearStart = Math.floor((sel || TODAY).getFullYear() / 20) * 20 + 1;

    const widget  = document.getElementById(opts.widgetId);
    const trigger = document.getElementById(opts.triggerId);
    const txtEl   = document.getElementById(opts.triggerTextId);
    const popup   = document.getElementById(opts.popupId);
    if (!widget || !trigger || !popup) return { getValue: () => '', reset: () => {}, close: () => {} };

    function isDis(date) {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    }

    function updateTrigger() {
      if (!txtEl) return;
      if (sel) { txtEl.textContent = calFmtDate(sel); txtEl.className = 'dob-trigger-date'; }
      else     { txtEl.textContent = opts.placeholder || 'dd/mm/yyyy'; txtEl.className = 'dob-trigger-placeholder'; }
    }

    function openPopup() {
      _pickerRegistry.forEach(p => p.close());
      // Reset alignment before measuring
      popup.style.left = '0'; popup.style.right = 'auto';
      popup.classList.remove('hidden');
      trigger.classList.add('open'); trigger.setAttribute('aria-expanded','true');
      // Flip to right-aligned if popup overflows viewport right edge
      const rect = popup.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) { popup.style.left = 'auto'; popup.style.right = '0'; }
    }
    function closePopup() { popup.classList.add('hidden'); trigger.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); }

    function makeHdr(wrap, title, onTitle, onPrev, onNext) {
      const hdr  = calEl('div','cal-header');
      const prev = calEl('button','cal-nav-btn'); prev.type='button'; prev.innerHTML='&#8249;'; prev.onclick=onPrev;
      const ttl  = calEl('button','cal-title-btn'); ttl.type='button'; ttl.textContent=title; ttl.onclick=onTitle;
      const next = calEl('button','cal-nav-btn'); next.type='button'; next.innerHTML='&#8250;'; next.onclick=onNext;
      hdr.appendChild(prev); hdr.appendChild(ttl); hdr.appendChild(next);
      wrap.appendChild(hdr);
    }

    function renderDays(wrap) {
      makeHdr(wrap, CAL_MONTHS[dispMonth]+' '+dispYear,
        () => { view='months'; render(); },
        () => { dispMonth--; if(dispMonth<0){dispMonth=11;dispYear--;} render(); },
        () => { dispMonth++; if(dispMonth>11){dispMonth=0;dispYear++;} render(); }
      );
      const hdrRow = calEl('div','cal-day-headers');
      CAL_DAYS.forEach(d => { const dh=calEl('div','cal-day-header'); dh.textContent=d; hdrRow.appendChild(dh); });
      wrap.appendChild(hdrRow);

      const grid    = calEl('div','cal-grid');
      const firstDow = new Date(dispYear, dispMonth, 1).getDay();
      const offset   = firstDow === 0 ? 6 : firstDow - 1;
      const dimCur   = new Date(dispYear, dispMonth+1, 0).getDate();
      const dimPrev  = new Date(dispYear, dispMonth,   0).getDate();
      let cells = [];
      for (let i=offset-1; i>=0; i--) cells.push({d:dimPrev-i, m:dispMonth-1, y:dispYear, out:true});
      for (let d=1; d<=dimCur; d++)   cells.push({d:d,          m:dispMonth,   y:dispYear, out:false});
      while (cells.length < 42)       cells.push({d:cells.length-offset-dimCur+1, m:dispMonth+1, y:dispYear, out:true});

      cells.forEach(cell => {
        const btn = calEl('button','cal-day-btn'); btn.type='button'; btn.textContent=cell.d;
        if (cell.out) btn.classList.add('cal-outside');
        const cellDate = new Date(cell.y, cell.m, cell.d); cellDate.setHours(0,0,0,0);
        const dis  = isDis(cellDate);
        const isSel = !cell.out && sel && cellDate.getTime() === new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()).getTime();
        const isTod = !cell.out && cellDate.getTime() === TODAY.getTime();
        if (isSel) btn.classList.add('cal-selected');
        else if (isTod) btn.classList.add('cal-today');
        if (dis) btn.classList.add('cal-disabled');
        btn.onclick = () => {
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
        () => { yearStart=Math.floor(dispYear/20)*20+1; view='years'; render(); },
        () => { dispYear--; render(); },
        () => { dispYear++; render(); }
      );
      const grid = calEl('div','cal-month-grid');
      CAL_MONTHS.forEach((m,i) => {
        const btn = calEl('button','cal-month-btn'); btn.type='button'; btn.textContent=m;
        const fom = new Date(dispYear, i, 1);    fom.setHours(0,0,0,0);
        const lom = new Date(dispYear, i+1, 0);  lom.setHours(0,0,0,0);
        const allDis = (maxDate && fom > maxDate) || (minDate && lom < minDate);
        const isSel  = sel && i===sel.getMonth() && dispYear===sel.getFullYear();
        const isTod  = i===TODAY.getMonth() && dispYear===TODAY.getFullYear();
        if (isSel)    btn.classList.add('cal-selected');
        else if(isTod) btn.classList.add('cal-today');
        if (allDis)   btn.classList.add('cal-disabled');
        btn.onclick = () => { if(allDis) return; dispMonth=i; view='days'; render(); };
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
    }

    function renderYears(wrap) {
      const end = yearStart + 19;
      makeHdr(wrap, yearStart+' – '+end,
        () => { yearStart-=20; render(); },
        () => { yearStart-=20; render(); },
        () => { yearStart+=20; render(); }
      );
      const grid = calEl('div','cal-year-grid');
      for (let y=yearStart; y<=end; y++) {
        const btn = calEl('button','cal-year-btn'); btn.type='button'; btn.textContent=y;
        const allDis = (maxDate && y > maxDate.getFullYear()) || (minDate && y < minDate.getFullYear());
        const isSel  = sel && y===sel.getFullYear();
        const isTod  = y===TODAY.getFullYear();
        if (isSel)    btn.classList.add('cal-selected');
        else if(isTod) btn.classList.add('cal-today');
        if (allDis)   btn.classList.add('cal-disabled');
        btn.onclick = () => { if(allDis) return; dispYear=y; view='months'; render(); };
        grid.appendChild(btn);
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
      sel = opts.defaultDate ? new Date(opts.defaultDate) : null;
      view = 'days';
      dispYear  = (sel || TODAY).getFullYear();
      dispMonth = (sel || TODAY).getMonth();
      render(); updateTrigger(); closePopup();
    }

    // Init
    render();
    updateTrigger();

    // Events — stopPropagation inside popup prevents DOM-wipe bug during month/year navigate
    trigger.addEventListener('click', function(e) { e.stopPropagation(); popup.classList.contains('hidden') ? openPopup() : closePopup(); });
    popup.addEventListener('click', function(e) { e.stopPropagation(); });
    document.addEventListener('click', function() { if (!popup.classList.contains('hidden')) closePopup(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePopup(); });

    const instance = { getValue: () => sel ? calDateStr(sel) : '', reset, close: closePopup };
    _pickerRegistry.push(instance);
    return instance;
  }

  // ── Picker instances ───────────────────────────────────────────
  const _pickerRegistry = [];
  const _calToday    = new Date(); _calToday.setHours(0,0,0,0);
  const _calTomorrow = new Date(_calToday); _calTomorrow.setDate(_calTomorrow.getDate() + 1);

  // Vaccination schedule DOB — defaults to today, past only
  const dobPicker = createDatePicker({
    widgetId: 'dobCalendarWidget', triggerId: 'dobTrigger',
    triggerTextId: 'dobTriggerText', popupId: 'dobCalendarPopup',
    maxDate: _calToday, placeholder: 'dd/mm/yyyy'
  });

  // Booking form DOB — no default, past only
  const bookDobPicker = createDatePicker({
    widgetId: 'bookDobWidget', triggerId: 'bookDobTrigger',
    triggerTextId: 'bookDobTriggerText', popupId: 'bookDobPopup',
    maxDate: _calToday, placeholder: 'Select date of birth'
  });

  // Booking appointment date — no default, tomorrow onwards
  const bookDatePicker = createDatePicker({
    widgetId: 'bookDateWidget', triggerId: 'bookDateTrigger',
    triggerTextId: 'bookDateTriggerText', popupId: 'bookDatePopup',
    minDate: _calTomorrow, placeholder: 'Select appointment date'
  });

  function getDobValue() { return dobPicker.getValue(); }

  // Hero button redirect
  if (openScheduleBtn) {
    openScheduleBtn.addEventListener('click', () => {
      // Fresh start every time hero CTA is clicked
      if (calcResults) calcResults.classList.add('hidden');
      if (timelineTableBody) timelineTableBody.innerHTML = '';
      dobPicker.reset();
      const scheduleSec = document.getElementById('schedules');
      if (scheduleSec) {
        scheduleSec.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => { if (dobTrigger) dobTrigger.focus(); }, 400);
      }
    });
  }

  // EPI Schedule Definition (loaded from the database via /api/vaccines)
  let epiSchedule = [];
  let epiScheduleLoaded = false;

  async function loadEpiSchedule() {
    if (epiScheduleLoaded) return epiSchedule;
    try {
      const response = await fetch('/api/vaccines');
      const data = await response.json();
      epiSchedule = data.map(v => ({
        name: v.name,
        ageText: v.age_text,
        offsetDays: v.offset_days,
        diseases: v.diseases
      }));
      epiScheduleLoaded = true;
    } catch (err) {
      console.error('Failed to load vaccine schedule:', err);
    }
    return epiSchedule;
  }

  if (calcScheduleBtn) {
    calcScheduleBtn.addEventListener('click', async () => {
      const dobValue = getDobValue();
      if (!dobValue) {
        alert('Please select the Day, Month and Year of birth first.');
        return;
      }

      await loadEpiSchedule();

      const dob = new Date(dobValue);
      const today = new Date();
      
      // Clear previous rows
      timelineTableBody.innerHTML = '';

      epiSchedule.forEach(vax => {
        // Calculate recommended date
        const recDate = new Date(dob);
        recDate.setDate(dob.getDate() + vax.offsetDays);
        
        const formattedRecDate = recDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        // Determine Status
        let statusBadge = '';
        const diffTime = recDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          // Date is in the past
          statusBadge = `<span class="badge-status badge-upcoming" style="background-color: var(--color-success-light); color: var(--color-success);">Completed / Due</span>`;
        } else if (diffDays <= 7) {
          // Date is today or in next 7 days
          statusBadge = `<span class="badge-status badge-due">Due Now</span>`;
        } else {
          // Date is in future
          statusBadge = `<span class="badge-status badge-upcoming">Upcoming</span>`;
        }

        // Build Table Row
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${vax.name}</strong></td>
          <td>${vax.ageText}</td>
          <td>${formattedRecDate}</td>
          <td style="color: var(--color-muted); font-size: 0.82rem;">${vax.diseases}</td>
          <td>${statusBadge}</td>
        `;
        
        timelineTableBody.appendChild(row);
      });

      // Show results
      calcResults.classList.remove('hidden');
      
      // Smooth scroll to results
      setTimeout(() => {
        calcResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    });
  }

  // ==========================================
  // 6. CONTACT FORM SUBMISSION
  // ==========================================
  const contactForm = document.getElementById('contactForm');
  const contactFeedback = document.getElementById('contactFeedback');

  if (contactForm && contactFeedback) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      contactFeedback.classList.add('hidden');
      
      const name = document.getElementById('contactName').value;
      const phone = document.getElementById('contactPhone').value;
      const email = document.getElementById('contactEmail')?.value || '';
      const message = document.getElementById('contactMessage').value;
      
      // Disable form buttons during loading animation
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Message...';

      try {
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, phone, email, message })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Show success state
          contactFeedback.textContent = `Thank you, ${name}! Your message has been sent successfully. We will call you at ${phone} shortly.`;
          contactFeedback.className = 'form-feedback feedback-success';
          contactFeedback.classList.remove('hidden');
          
          // Reset form
          contactForm.reset();
        } else {
          contactFeedback.textContent = data.error || 'Failed to send message. Please try again.';
          contactFeedback.className = 'form-feedback feedback-danger';
          contactFeedback.classList.remove('hidden');
        }
      } catch (err) {
        contactFeedback.textContent = 'Connection error. Please try again later.';
        contactFeedback.className = 'form-feedback feedback-danger';
        contactFeedback.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
        // Hide feedback after 8 seconds
        setTimeout(() => {
          contactFeedback.classList.add('hidden');
        }, 8000);
      }
    });
  }

  // Disable right-click and Inspect key shortcuts to prevent simple inspection
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (
      e.key === 'F12' || 
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) || 
      (e.ctrlKey && e.key === 'U')
    ) {
      e.preventDefault();
    }
  });

  // ==========================================
  // PDF LINK — FRESH WINDOW ON EVERY CLICK
  // ==========================================
  // Browser reuses closed window context on 2nd click with target="_blank" + COOP headers.
  // window.open() with a timestamp URL breaks that reuse and guarantees a new tab every time.
  // No longer needed — View is now a button calling viewResource(), Download is a plain anchor

  // BFCache guard — if browser restores this page from back-forward cache
  // (can happen after a _blank navigation in some Chromium builds), force a reload
  // so event listeners are live again.
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) window.location.reload();
  });

  // ==========================================
  // EVENTS PREVIEW SECTION
  // ==========================================
  const eventsGrid = document.getElementById('eventsPreviewGrid');
  if (eventsGrid) {
    fetch('/api/events')
      .then(r => r.json())
      .then(events => {
        if (!events.length) {
          eventsGrid.innerHTML = '<div class="ep-empty"><p>No upcoming events at this time. Check back soon!</p></div>';
          return;
        }
        eventsGrid.innerHTML = events.map(ev => {
          const dateStr = new Date(ev.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          const imgHtml = ev.cover_image
            ? `<img class="ep-card-img" src="${ev.cover_image}" alt="${ev.title}">`
            : `<div class="ep-card-img-ph"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0040A5" stroke-width="1.2" opacity="0.4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>`;
          const timeStr = ev.event_time ? ` · ${ev.event_time}` : '';
          const locStr  = ev.location   ? `<span>${ev.location}</span>` : '';
          return `
            <div class="ep-card">
              ${imgHtml}
              <div class="ep-card-body">
                <span class="ep-cat-badge">${ev.category}</span>
                <h3 class="ep-card-title">${ev.title}</h3>
                <div class="ep-card-meta">
                  <span>${dateStr}${timeStr}</span>
                  ${locStr}
                </div>
                <a href="/events/${ev.id}" class="ep-card-link">View Details →</a>
              </div>
            </div>`;
        }).join('');
      })
      .catch(() => {
        eventsGrid.innerHTML = '<div class="ep-empty"><p>Could not load events.</p></div>';
      });
  }

  // ==========================================
  // PRIVATE VACCINE SCHEDULE MODAL
  // ==========================================
  const PVT_VACCINES = [
    {
      name: 'Hepa A (Child)',
      disease: 'Hepatitis A',
      age: 'Up to 18 years',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 6 months after Dose 1'],
      note: null
    },
    {
      name: 'Hepa A (Adult)',
      disease: 'Hepatitis A',
      age: '≥ 19 years',
      dose: '1.0 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 1 month after Dose 1', 'Dose 3: 6 months after Dose 1'],
      note: null
    },
    {
      name: 'Hepa B (Adult)',
      disease: 'Hepatitis B',
      age: '≥ 19 years',
      dose: '1.0 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 1 month after Dose 1', 'Dose 3: 2 months after Dose 1', 'Dose 4: 6 months after Dose 1'],
      note: null
    },
    {
      name: 'Hepa B (Child)',
      disease: 'Hepatitis B',
      age: 'Up to 18 years',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 1 month after Dose 1', 'Dose 3: 6 months after Dose 1'],
      note: null
    },
    {
      name: 'Rabix VC',
      disease: 'Rabies Virus',
      age: 'Any age',
      dose: '1.0 ML',
      schedule: ['Dose 1: Immediately after bite', 'Dose 2: Day 3', 'Dose 3: Day 7', 'Dose 4: Day 14', 'Dose 5: Day 28'],
      note: 'Post-exposure priority protocol'
    },
    {
      name: 'Cholvax',
      disease: 'Vibrio Cholerae',
      age: '> 12 months',
      dose: '1.5 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 14 days after Dose 1'],
      note: 'Booster: 2 years after Dose 2'
    },
    {
      name: 'Influvax',
      disease: 'Influenza',
      age: '> 6 months',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 4 weeks after Dose 1 (first-time recipients only)'],
      note: 'Annual booster required every year'
    },
    {
      name: 'Papilovax',
      disease: 'Cervical Cancer',
      age: '9–14 yrs / 9–45 yrs',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 6 months after Dose 1 (age 9–14)', 'Dose 2: 1 month after Dose 1 (age 9–45)', 'Dose 3: 6 months after Dose 1 (age 9–45 only)'],
      note: '9–14 yrs: 2 doses · 9–45 yrs: 3 doses (follow WHO guideline)'
    },
    {
      name: 'Rotateq',
      disease: 'Rotavirus Gastroenteritis',
      age: '2–6 months (max < 8 months)',
      dose: '2.0 ML (Oral)',
      schedule: ['Dose 1: Any day', 'Dose 2: 2 months after Dose 1', 'Dose 3: 2 months after Dose 2'],
      note: '3-dose oral series — must complete before 8 months of age'
    },
    {
      name: 'Evimar',
      disease: 'Pneumococcal',
      age: '7 mo–23 mo / ≥ 2 yrs',
      dose: '0.5 ML',
      schedule: ['7–11 mo: 2 doses (2 months apart) + booster at 12–15 months', '12–23 mo: 2 doses (2 months apart)', '≥ 2 yrs: Single dose'],
      note: 'Schedule varies by age group at first dose'
    },
    {
      name: 'Prenovax',
      disease: 'Pneumococcal',
      age: '> 2 years',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day'],
      note: 'Booster: 5 years after Dose 1 (as prescribed by doctor)'
    },
    {
      name: 'VRZ Varizost',
      disease: 'Chicken Pox',
      age: '> 12 months',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day', 'Dose 2: 6 weeks after Dose 1'],
      note: null
    },
    {
      name: 'VPH Vaxphoid',
      disease: 'Typhoid',
      age: '> 12 months',
      dose: '0.5 ML',
      schedule: ['Dose 1: Any day'],
      note: 'Booster: Every 3 years'
    }
  ];

  function renderPvtTable(filter) {
    var tbody = document.getElementById('pvtVaxTbody');
    var noResults = document.getElementById('pvtNoResults');
    if (!tbody) return;
    var q = (filter || '').toLowerCase().trim();
    var rows = PVT_VACCINES.filter(function(v) {
      if (!q) return true;
      return v.name.toLowerCase().indexOf(q) > -1 || v.disease.toLowerCase().indexOf(q) > -1 || v.age.toLowerCase().indexOf(q) > -1;
    });
    if (!rows.length) {
      tbody.innerHTML = '';
      if (noResults) noResults.classList.remove('hidden');
      return;
    }
    if (noResults) noResults.classList.add('hidden');
    tbody.innerHTML = rows.map(function(v) {
      var scheduleHtml = '<ul class="pvt-schedule-list">' +
        v.schedule.map(function(s) { return '<li>' + s + '</li>'; }).join('') +
        '</ul>' +
        (v.note ? '<span class="pvt-note">⚠ ' + v.note + '</span>' : '');
      return '<tr>' +
        '<td><span class="pvt-vaccine-name">' + v.name + '</span></td>' +
        '<td><span class="pvt-disease-tag">' + v.disease + '</span></td>' +
        '<td><span class="pvt-age-badge">' + v.age + '</span></td>' +
        '<td><span class="pvt-dose-vol">' + v.dose + '</span></td>' +
        '<td>' + scheduleHtml + '</td>' +
        '</tr>';
    }).join('');
  }

  var pvtVaxModal = document.getElementById('pvtVaxModal');
  var openPvtBtn  = document.getElementById('openPvtVaxModal');
  var closePvtBtn = document.getElementById('closePvtVaxModal');
  var pvtVaxCard  = document.getElementById('pvtVaxCard');
  var pvtSearch   = document.getElementById('pvtVaxSearch');
  var pvtBookBtn  = document.getElementById('pvtBookBtn');

  function openPrivateVaxModal() {
    renderPvtTable('');
    if (pvtSearch) pvtSearch.value = '';
    if (pvtVaxModal) openModal(pvtVaxModal);
  }

  if (openPvtBtn) {
    openPvtBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openPrivateVaxModal();
    });
  }

  if (pvtVaxCard) {
    pvtVaxCard.addEventListener('click', function(e) {
      var isBtn = e.target === openPvtBtn || (openPvtBtn && openPvtBtn.contains(e.target));
      if (!isBtn) openPrivateVaxModal();
    });
  }

  if (closePvtBtn && pvtVaxModal) {
    closePvtBtn.addEventListener('click', function() {
      closeModal(pvtVaxModal);
    });
  }

  if (pvtVaxModal) {
    pvtVaxModal.addEventListener('click', function(e) {
      if (e.target === pvtVaxModal) closeModal(pvtVaxModal);
    });
  }

  if (pvtSearch) {
    pvtSearch.addEventListener('input', function() {
      renderPvtTable(pvtSearch.value);
    });
  }

  if (pvtBookBtn) {
    pvtBookBtn.addEventListener('click', function() {
      if (pvtVaxModal) closeModal(pvtVaxModal);
      var bookModal = document.getElementById('bookingModal');
      var bookForm  = document.getElementById('bookingForm');
      var bookSvc   = document.getElementById('bookService');
      var bookSucc  = document.getElementById('bookingSuccess');
      if (bookForm) { bookForm.classList.remove('hidden'); bookForm.reset(); }
      if (bookSucc) bookSucc.classList.add('hidden');
      if (bookSvc) {
        var opt = document.createElement('option');
        opt.value = 'Private Vaccination';
        opt.textContent = 'Private Vaccination';
        var exists = false;
        for (var i = 0; i < bookSvc.options.length; i++) {
          if (bookSvc.options[i].value === 'Private Vaccination') { exists = true; break; }
        }
        if (!exists) bookSvc.appendChild(opt);
        bookSvc.value = 'Private Vaccination';
      }
      if (bookModal) openModal(bookModal);
    });
  }
});
