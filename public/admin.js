// ==========================================================================
// ADMIN DASHBOARD CLIENT CONTROLLER
// ==========================================================================

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
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
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
          newCard.innerHTML = `
            <div class="user-card-info">
              <h5>${username}</h5>
              <span>Created: Just Now</span>
            </div>
            <div class="actions-cell">
              <button class="action-btn" onclick="openChangePasswordModal(${data.userId}, '${username}')" title="Change Password">🔑</button>
              <button class="action-btn btn-delete" onclick="deleteUser(${data.userId})" title="Delete Account">🗑</button>
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
