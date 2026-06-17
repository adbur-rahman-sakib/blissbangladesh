// ── Supabase client (uses values from supabase-config.js) ──
const _supabase = (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined')
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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
  
  // Set minimum date for booking to tomorrow
  const bookDateInput = document.getElementById('bookDate');
  if (bookDateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    bookDateInput.min = `${yyyy}-${mm}-${dd}`;
  }

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

      const patientName  = document.getElementById('bookName').value.trim();
      const phoneNum     = document.getElementById('bookPhone').value.trim();
      const dob          = document.getElementById('bookDob').value || null;
      const service      = document.getElementById('bookService').value;
      const appointmentDate = document.getElementById('bookDate').value;
      const timeSlot     = document.getElementById('bookTime').value;

      // Disable submit while saving
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';

      // Save to Supabase
      if (_supabase) {
        await _supabase.from('appointments').insert({
          patient_name:     patientName,
          phone:            phoneNum,
          dob:              dob,
          service:          service,
          appointment_date: appointmentDate,
          time_slot:        timeSlot,
          status:           'pending'
        });
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Appointment Request';

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
  
  // Data for service details
  const serviceDetails = {
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
  const childDobInput = document.getElementById('childDob');
  const calcScheduleBtn = document.getElementById('calcScheduleBtn');
  const calcResults = document.getElementById('calcResults');
  const timelineTableBody = document.getElementById('timelineTableBody');

  // Set maximum date for DOB input to today
  if (childDobInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    childDobInput.max = `${yyyy}-${mm}-${dd}`;
  }

  // Hero button redirect
  if (openScheduleBtn) {
    openScheduleBtn.addEventListener('click', () => {
      const scheduleSec = document.getElementById('schedules');
      if (scheduleSec) {
        scheduleSec.scrollIntoView({ behavior: 'smooth' });
        // Pulse input to draw attention
        childDobInput.focus();
      }
    });
  }

  // EPI Schedule Definition (offsets in days from DOB)
  const epiSchedule = [
    { name: 'BCG (Tuberculosis)', ageText: 'At Birth', offsetDays: 0, diseases: 'Tuberculosis (TB)' },
    { name: 'OPV 0 (Oral Polio Vaccine)', ageText: 'At Birth', offsetDays: 0, diseases: 'Poliomyelitis' },
    { name: 'Pentavalent 1 (DPT-HepB-Hib)', ageText: '6 Weeks', offsetDays: 42, diseases: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Haemophilus Influenzae' },
    { name: 'OPV 1', ageText: '6 Weeks', offsetDays: 42, diseases: 'Poliomyelitis' },
    { name: 'PCV 1 (Pneumococcal Vaccine)', ageText: '6 Weeks', offsetDays: 42, diseases: 'Pneumonia, Meningitis' },
    { name: 'Pentavalent 2', ageText: '10 Weeks', offsetDays: 70, diseases: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Haemophilus Influenzae' },
    { name: 'OPV 2', ageText: '10 Weeks', offsetDays: 70, diseases: 'Poliomyelitis' },
    { name: 'PCV 2', ageText: '10 Weeks', offsetDays: 70, diseases: 'Pneumonia, Meningitis' },
    { name: 'Pentavalent 3', ageText: '14 Weeks', offsetDays: 98, diseases: 'Diphtheria, Pertussis, Tetanus, Hepatitis B, Haemophilus Influenzae' },
    { name: 'OPV 3', ageText: '14 Weeks', offsetDays: 98, diseases: 'Poliomyelitis' },
    { name: 'PCV 3', ageText: '14 Weeks', offsetDays: 98, diseases: 'Pneumonia, Meningitis' },
    { name: 'fIPV 1 (Fractional Inactivated Polio)', ageText: '14 Weeks', offsetDays: 98, diseases: 'Poliomyelitis' },
    { name: 'MR 1 (Measles & Rubella)', ageText: '9 Months', offsetDays: 270, diseases: 'Measles, Rubella' },
    { name: 'fIPV 2', ageText: '9 Months', offsetDays: 270, diseases: 'Poliomyelitis' },
    { name: 'MR 2', ageText: '15 Months', offsetDays: 450, diseases: 'Measles, Rubella' }
  ];

  if (calcScheduleBtn) {
    calcScheduleBtn.addEventListener('click', () => {
      const dobValue = childDobInput.value;
      if (!dobValue) {
        alert('Please enter a valid Date of Birth first.');
        return;
      }

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

      const name    = document.getElementById('contactName').value.trim();
      const email   = document.getElementById('contactEmail').value.trim() || null;
      const phone   = document.getElementById('contactPhone').value.trim();
      const message = document.getElementById('contactMessage').value.trim();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      // Save to Supabase
      if (_supabase) {
        await _supabase.from('contact_submissions').insert({
          name, email, phone, message
        });
      }

      submitBtn.disabled = false;
      submitBtn.textContent = originalText;

      contactFeedback.textContent = `Thank you, ${name}! Your message has been received. We will call you at ${phone} shortly.`;
      contactFeedback.className = 'form-feedback feedback-success';
      contactFeedback.classList.remove('hidden');

      contactForm.reset();

      setTimeout(() => contactFeedback.classList.add('hidden'), 8000);
    });
  }
});
