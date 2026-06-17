// ==========================================================================
// ADMIN DASHBOARD CLIENT CONTROLLER
// ==========================================================================

// Current user's role — set server-side on the body element
const USER_ROLE = document.body.dataset.role || 'editor';

// Sections & vaccines data embedded by the server (used by edit modals)
const sectionsDataEl = document.getElementById('sections-data');
const vaccinesDataEl = document.getElementById('vaccines-data');
const sectionsData = sectionsDataEl ? JSON.parse(sectionsDataEl.textContent) : [];
const vaccinesData = vaccinesDataEl ? JSON.parse(vaccinesDataEl.textContent) : [];

document.addEventListener('DOMContentLoaded', () => {
  // 1. Set up sidebar tabs listeners
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPanel = item.getAttribute('data-panel');
      switchTab(targetPanel);
    });
  });

  // 2. Set up website settings form submission
  const settingsForm = document.getElementById('websiteSettingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveSettingsBtn');
      const originalText = saveBtn.textContent;
      
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving Changes...';

      // Gather form inputs into JSON
      const formData = new FormData(settingsForm);
      const settingsObject = {};
      formData.forEach((value, key) => {
        settingsObject[key] = value;
      });

      try {
        const response = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settingsObject)
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Website settings updated successfully!', 'success');
        } else {
          showNotification(data.error || 'Failed to save settings.', 'danger');
        }
      } catch (err) {
        showNotification('Connection error. Failed to save settings.', 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    });
  }

  // 3. User account creation form
  const createUsrForm = document.getElementById('createAdminUserForm');
  const userErrBox = document.getElementById('createUserError');
  if (createUsrForm) {
    createUsrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      userErrBox.classList.add('hidden');
      
      const username = document.getElementById('newUsername').value.trim();
      const password = document.getElementById('newPassword').value;

      try {
        const role = document.getElementById('newUserRole')?.value || 'editor';
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification(`Admin account "${username}" created successfully.`, 'success');
          createUsrForm.reset();
          
          // Append new user card inline
          const container = document.getElementById('usersContainer');
          const newCard = document.createElement('div');
          newCard.className = 'user-card';
          newCard.id = `user-card-${data.userId}`;
          const roleLabel = (data.role || role).charAt(0).toUpperCase() + (data.role || role).slice(1);
          newCard.innerHTML = `
            <div class="user-card-info">
              <h5>${username}</h5>
              <span class="role-badge role-${data.role || role}">${roleLabel}</span>
              <span>Created: Just Now</span>
            </div>
            <div class="actions-cell">
              <button class="action-btn" onclick="openChangePasswordModal(${data.userId}, '${username}')" title="Change Password">🔑</button>
              ${USER_ROLE === 'admin' ? `<button class="action-btn btn-delete" onclick="deleteUser(${data.userId})" title="Delete Account">🗑</button>` : ''}
            </div>
          `;
          container.appendChild(newCard);
          
          // Update admin count stats
          updateStatCount('stat-total-admins', 1);
        } else {
          userErrBox.textContent = data.error || 'Failed to create account.';
          userErrBox.classList.remove('hidden');
        }
      } catch (err) {
        userErrBox.textContent = 'Connection error. Please try again.';
        userErrBox.classList.remove('hidden');
      }
    });
  }

  // 4. Change Password form submission
  const changePwdForm = document.getElementById('changePasswordForm');
  const pwdModalError = document.getElementById('pwdModalError');
  if (changePwdForm) {
    changePwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      pwdModalError.classList.add('hidden');
      
      const userId = document.getElementById('pwdModalUserId').value;
      const newPassword = document.getElementById('newPasswordVal').value;

      try {
        const response = await fetch('/api/admin/users/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId, newPassword })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Password updated successfully.', 'success');
          closeChangePasswordModal();
        } else {
          pwdModalError.textContent = data.error || 'Failed to update password.';
          pwdModalError.classList.remove('hidden');
        }
      } catch (err) {
        pwdModalError.textContent = 'Connection error. Please try again.';
        pwdModalError.classList.remove('hidden');
      }
    });
  }

  // 5. Site image upload forms (hero banner & service card images)
  document.querySelectorAll('.image-upload-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const field = form.getAttribute('data-field');
      const fileInput = form.querySelector('input[type="file"]');
      if (!fileInput.files.length) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';

      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      formData.append('field', field);

      try {
        const response = await fetch('/api/admin/upload-setting-image', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Image updated successfully.', 'success');
          const previewBox = document.getElementById(`preview-box-${field}`);
          if (previewBox) {
            previewBox.innerHTML = `<img src="${data.path}" alt="">`;
          }
          form.reset();
        } else {
          showNotification(data.error || 'Failed to upload image.', 'danger');
        }
      } catch (err) {
        showNotification('Connection error. Failed to upload image.', 'danger');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  });

  // 6. Create new homepage section
  const createSectionForm = document.getElementById('createSectionForm');
  const createSectionError = document.getElementById('createSectionError');
  if (createSectionForm) {
    createSectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      createSectionError.classList.add('hidden');

      const submitBtn = createSectionForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding Section...';

      const formData = new FormData(createSectionForm);
      formData.set('is_visible', document.getElementById('newSectionVisible').checked ? '1' : '0');

      try {
        const response = await fetch('/api/admin/sections', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Section added successfully. Reloading page...', 'success');
          setTimeout(() => window.location.reload(), 700);
        } else {
          createSectionError.textContent = data.error || 'Failed to add section.';
          createSectionError.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (err) {
        createSectionError.textContent = 'Connection error. Please try again.';
        createSectionError.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 7. Edit homepage section
  const editSectionForm = document.getElementById('editSectionForm');
  const editSectionError = document.getElementById('editSectionError');
  if (editSectionForm) {
    editSectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      editSectionError.classList.add('hidden');

      const id = document.getElementById('editSectionId').value;
      const submitBtn = editSectionForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const formData = new FormData();
      formData.append('title', document.getElementById('editSectionTitle').value);
      formData.append('content', document.getElementById('editSectionContent').value);
      formData.append('is_visible', document.getElementById('editSectionVisible').checked ? '1' : '0');
      const imageFile = document.getElementById('editSectionImage').files[0];
      if (imageFile) formData.append('image', imageFile);

      try {
        const response = await fetch(`/api/admin/sections/${id}`, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Section updated successfully. Reloading page...', 'success');
          setTimeout(() => window.location.reload(), 700);
        } else {
          editSectionError.textContent = data.error || 'Failed to update section.';
          editSectionError.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (err) {
        editSectionError.textContent = 'Connection error. Please try again.';
        editSectionError.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 8. Create new vaccine schedule entry
  const createVaccineForm = document.getElementById('createVaccineForm');
  const createVaccineError = document.getElementById('createVaccineError');
  if (createVaccineForm) {
    createVaccineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      createVaccineError.classList.add('hidden');

      const submitBtn = createVaccineForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding Entry...';

      const payload = {
        name: document.getElementById('newVaccineName').value,
        age_text: document.getElementById('newVaccineAgeText').value,
        offset_days: document.getElementById('newVaccineOffsetDays').value,
        diseases: document.getElementById('newVaccineDiseases').value
      };

      try {
        const response = await fetch('/api/admin/vaccines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Vaccine entry added successfully. Reloading page...', 'success');
          setTimeout(() => window.location.reload(), 700);
        } else {
          createVaccineError.textContent = data.error || 'Failed to add vaccine entry.';
          createVaccineError.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (err) {
        createVaccineError.textContent = 'Connection error. Please try again.';
        createVaccineError.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 9. Edit vaccine schedule entry
  const editVaccineForm = document.getElementById('editVaccineForm');
  const editVaccineError = document.getElementById('editVaccineError');
  if (editVaccineForm) {
    editVaccineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      editVaccineError.classList.add('hidden');

      const id = document.getElementById('editVaccineId').value;
      const submitBtn = editVaccineForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      const payload = {
        name: document.getElementById('editVaccineName').value,
        age_text: document.getElementById('editVaccineAgeText').value,
        offset_days: document.getElementById('editVaccineOffsetDays').value,
        diseases: document.getElementById('editVaccineDiseases').value
      };

      try {
        const response = await fetch(`/api/admin/vaccines/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok && data.success) {
          showNotification('Vaccine entry updated successfully. Reloading page...', 'success');
          setTimeout(() => window.location.reload(), 700);
        } else {
          editVaccineError.textContent = data.error || 'Failed to update vaccine entry.';
          editVaccineError.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (err) {
        editVaccineError.textContent = 'Connection error. Please try again.';
        editVaccineError.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Switch visible panel/tab in dashboard
function switchTab(panelId) {
  // Highlight sidebar link
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(item => {
    if (item.getAttribute('data-panel') === panelId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active dashboard panel
  const panels = document.querySelectorAll('.dashboard-panel');
  panels.forEach(p => {
    if (p.id === `panel-${panelId}`) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Update header title
  const titles = {
    overview: 'Overview Panel',
    bookings: 'Appointment Bookings',
    inquiries: 'Contact Inquiries',
    settings: 'Manage Website Content',
    sections: 'Homepage Sections',
    vaccines: 'EPI Vaccine Schedule',
    users: 'Administrator Accounts'
  };
  document.getElementById('pageTitle').textContent = titles[panelId] || 'Admin Dashboard';
}

// Show alert banner notification
function showNotification(message, type = 'success') {
  const alertBox = document.getElementById('dashboardAlert');
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('hidden');
  
  // Smooth scroll alert into view if scrolled down
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Hide after 6 seconds
  setTimeout(() => {
    alertBox.classList.add('hidden');
  }, 6000);
}

// Helper: update counters
function updateStatCount(elementId, changeValue) {
  const elem = document.getElementById(elementId);
  if (elem) {
    let currentVal = parseInt(elem.textContent) || 0;
    elem.textContent = currentVal + changeValue;
  }
}

// Disable right-click and keys (F12, etc.) for basic inspect prevention
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
// APPOINTMENTS (BOOKINGS) API CALLS
// ==========================================

// Filter bookings table by status badge
function filterBookings(status) {
  // Update active button state
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    if (btn.textContent.trim() === status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Filter rows
  const rows = document.querySelectorAll('.booking-data-row');
  let visibleCount = 0;
  
  rows.forEach(row => {
    const rowStatus = row.getAttribute('data-status');
    if (status === 'All' || rowStatus === status) {
      row.classList.remove('hidden');
      visibleCount++;
    } else {
      row.classList.add('hidden');
    }
  });

  // Show/Hide no records row if no items match
  const noRecordsRow = document.querySelector('.no-records-row');
  if (noRecordsRow) {
    if (visibleCount === 0) {
      noRecordsRow.classList.remove('hidden');
    } else {
      noRecordsRow.classList.add('hidden');
    }
  }
}

// Update appointment status (Pending -> Confirmed -> Completed/Cancelled)
async function updateBookingStatus(id, newStatus) {
  try {
    const response = await fetch('/api/admin/bookings/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, status: newStatus })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification(`Appointment #${id} updated to "${newStatus}"`, 'success');
      
      // Update Table row if exists in Bookings view
      const bookingRow = document.getElementById(`booking-row-${id}`);
      if (bookingRow) {
        bookingRow.setAttribute('data-status', newStatus);
        const statusBadge = document.getElementById(`status-tag-${id}`);
        if (statusBadge) {
          statusBadge.className = `status-badge ${newStatus.toLowerCase()}`;
          statusBadge.textContent = newStatus;
        }
      }

      // Update overview row if exists
      const overviewRow = document.getElementById(`booking-row-ov-${id}`);
      if (overviewRow) {
        const badge = overviewRow.querySelector('.status-badge');
        if (badge) {
          badge.className = `status-badge ${newStatus.toLowerCase()}`;
          badge.textContent = newStatus;
        }
      }

      // Refresh Stats counters dynamically
      // Since we don't reload, let's recalculate count of Pending
      // Find all booking-data-rows and see how many have status 'Pending'
      let pendingCount = 0;
      document.querySelectorAll('.booking-data-row').forEach(row => {
        const stat = row.getAttribute('data-status');
        if (stat === 'Pending') pendingCount++;
      });
      const pendingStatBox = document.getElementById('stat-pending-bookings');
      if (pendingStatBox) pendingStatBox.textContent = pendingCount;

    } else {
      showNotification(data.error || 'Failed to update booking status.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Could not update booking status.', 'danger');
  }
}

// Delete Booking completely from SQLite
async function deleteBooking(id) {
  if (!confirm(`Are you sure you want to permanently delete appointment booking #${id}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification(`Appointment booking #${id} deleted.`, 'success');
      
      // Remove elements from DOM
      document.getElementById(`booking-row-${id}`)?.remove();
      document.getElementById(`booking-row-ov-${id}`)?.remove();
      
      // Update counters
      updateStatCount('stat-total-bookings', -1);
      
      // Re-trigger pending count re-calculation
      let pendingCount = 0;
      document.querySelectorAll('.booking-data-row').forEach(row => {
        const stat = row.getAttribute('data-status');
        if (stat === 'Pending') pendingCount++;
      });
      const pendingStatBox = document.getElementById('stat-pending-bookings');
      if (pendingStatBox) pendingStatBox.textContent = pendingCount;
    } else {
      showNotification(data.error || 'Failed to delete record.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to delete booking.', 'danger');
  }
}

// ==========================================
// CONTACT MESSAGES (INQUIRIES) API CALLS
// ==========================================

// Mark inquiry as Read/Replied
async function updateInquiryStatus(id, newStatus) {
  try {
    const response = await fetch('/api/admin/contacts/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, status: newStatus })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification('Inquiry status updated.', 'success');
      
      // Update badge in inquiries view
      const badge = document.getElementById(`inquiry-status-${id}`);
      if (badge) {
        badge.className = `status-badge ${newStatus.toLowerCase()}`;
        badge.textContent = newStatus;
      }
      
      // Update overview inquiry badge if it exists
      const ovCard = document.getElementById(`inquiry-card-ov-${id}`);
      if (ovCard) {
        const ovBadge = ovCard.querySelector('.status-badge');
        if (ovBadge) {
          ovBadge.className = `status-badge ${newStatus.toLowerCase()}`;
          ovBadge.textContent = newStatus;
        }
      }

      // Hide "Mark Replied" button
      document.getElementById(`btn-read-${id}`)?.classList.add('hidden');
    } else {
      showNotification(data.error || 'Failed to update status.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to update status.', 'danger');
  }
}

// Delete contact inquiry completely
async function deleteInquiry(id) {
  if (!confirm('Are you sure you want to permanently delete this customer message?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/contacts/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification('Inquiry message deleted.', 'success');
      
      // Remove elements
      document.getElementById(`inquiry-card-${id}`)?.remove();
      document.getElementById(`inquiry-card-ov-${id}`)?.remove();
      
      // Update counters
      updateStatCount('stat-total-messages', -1);
      
      // If list is empty now, show warning placeholder
      const listContainer = document.getElementById('inquiriesContainer');
      if (listContainer && listContainer.children.length === 0) {
        listContainer.innerHTML = `<p id="noInquiriesText" style="text-align: center; color: var(--color-text-muted); padding: 40px;">No messages received through contact forms yet.</p>`;
      }
    } else {
      showNotification(data.error || 'Failed to delete message.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to delete message.', 'danger');
  }
}

// ==========================================
// USER ACCOUNTS API CALLS
// ==========================================

// Delete administrator user
async function deleteUser(id) {
  if (!confirm('Are you sure you want to permanently delete this administrator account?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification('Administrator account deleted.', 'success');
      document.getElementById(`user-card-${id}`)?.remove();
      updateStatCount('stat-total-admins', -1);
    } else {
      showNotification(data.error || 'Failed to delete account.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to delete account.', 'danger');
  }
}

// Modal controls for change password
function openChangePasswordModal(userId, username) {
  document.getElementById('pwdModalUserId').value = userId;
  document.getElementById('pwdModalUser').textContent = username;
  document.getElementById('newPasswordVal').value = '';
  document.getElementById('pwdModalError').classList.add('hidden');
  document.getElementById('pwdModal').classList.remove('hidden');
}

function closeChangePasswordModal() {
  document.getElementById('pwdModal').classList.add('hidden');
}

// ==========================================
// HOMEPAGE SECTIONS API CALLS
// ==========================================

// Open the edit modal for a homepage section
function openEditSectionModal(id) {
  const section = sectionsData.find(s => s.id === id);
  if (!section) return;

  document.getElementById('editSectionId').value = section.id;
  document.getElementById('editSectionTitle').value = section.title;
  document.getElementById('editSectionContent').value = section.content;
  document.getElementById('editSectionImage').value = '';
  document.getElementById('editSectionVisible').checked = section.is_visible === 1 || section.is_visible === true;
  document.getElementById('editSectionError').classList.add('hidden');
  document.getElementById('sectionModal').classList.remove('hidden');
}

function closeEditSectionModal() {
  document.getElementById('sectionModal').classList.add('hidden');
}

// Move a section up or down in display order
async function moveSection(id, direction) {
  try {
    const response = await fetch(`/api/admin/sections/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      window.location.reload();
    } else {
      showNotification(data.error || 'Failed to reorder section.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to reorder section.', 'danger');
  }
}

// Delete a homepage section
async function deleteSection(id) {
  if (!confirm('Are you sure you want to permanently delete this section?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/sections/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification('Section deleted. Reloading page...', 'success');
      setTimeout(() => window.location.reload(), 700);
    } else {
      showNotification(data.error || 'Failed to delete section.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to delete section.', 'danger');
  }
}

// ==========================================
// VACCINE SCHEDULE API CALLS
// ==========================================

// Open the edit modal for a vaccine schedule entry
function openEditVaccineModal(id) {
  const vaccine = vaccinesData.find(v => v.id === id);
  if (!vaccine) return;

  document.getElementById('editVaccineId').value = vaccine.id;
  document.getElementById('editVaccineName').value = vaccine.name;
  document.getElementById('editVaccineAgeText').value = vaccine.age_text;
  document.getElementById('editVaccineOffsetDays').value = vaccine.offset_days;
  document.getElementById('editVaccineDiseases').value = vaccine.diseases || '';
  document.getElementById('editVaccineError').classList.add('hidden');
  document.getElementById('vaccineModal').classList.remove('hidden');
}

function closeEditVaccineModal() {
  document.getElementById('vaccineModal').classList.add('hidden');
}

// Delete a vaccine schedule entry
async function deleteVaccine(id) {
  if (!confirm('Are you sure you want to permanently delete this vaccine schedule entry?')) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/vaccines/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (response.ok && data.success) {
      showNotification('Vaccine entry deleted. Reloading page...', 'success');
      setTimeout(() => window.location.reload(), 700);
    } else {
      showNotification(data.error || 'Failed to delete vaccine entry.', 'danger');
    }
  } catch (err) {
    showNotification('Connection error. Failed to delete vaccine entry.', 'danger');
  }
}
