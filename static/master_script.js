(function(){
  const form = document.getElementById('poForm');
  const poContainer = document.getElementById('poContainer');
  const noPO = document.getElementById('noPO');
  const manageUsersBtn = document.getElementById('manageUsersBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const who = document.getElementById('who');
  const addPoSection = document.getElementById('addPoSection');

  // Backup/Restore controls
  const backupBtn = document.getElementById('backupBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreInput = document.getElementById('restoreInput');

  let pos = [];
  let editingId = null;

  const dept = localStorage.getItem('userDepartment') || localStorage.getItem('userRole');
  const name = localStorage.getItem('userName') || localStorage.getItem('username') || '';
  const isAdmin = (localStorage.getItem('userIsAdmin') === 'true');

  if (!dept) { window.location.href = 'login.html'; return; }

  who.textContent = `${name} (${dept.toUpperCase()}${isAdmin ? ', Admin' : ''})`;

  if (!isAdmin) {
    addPoSection.style.display = 'none';
    manageUsersBtn.style.display = 'none';
    backupBtn.style.display = 'none';
    restoreBtn.style.display = 'none';
  }

  function encodeParams(data) {
    return Object.keys(data).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`).join('&');
  }

  async function loadPOs() {
    try {
      const response = await fetch('/api/pos');
      if (response.ok) {
        pos = await response.json();
        renderPOs();
      }
    } catch (err) {
      console.error('Failed to load POs:', err);
    }
  }

  function renderPOs() {
    poContainer.innerHTML = '';
    if (pos.length === 0) {
      noPO.style.display = 'block';
      return;
    }
    noPO.style.display = 'none';
    pos.forEach((po) => {
      const item = document.createElement('div');
      item.className = 'po-item';
      item.innerHTML = `
        <div class="po-details">
          <strong>${po.po}</strong> — Customer: ${po.customer}, BID: ${po.bid}, CR: ${po.cr}
        </div>
        <div class="po-actions">
          <button class="open-form" data-id="${po.id}" data-form="CR">Contract Review</button>
          <button class="open-form" data-id="${po.id}" data-form="PED">PED Review</button>
          <button class="open-form" data-id="${po.id}" data-form="LEAD">Lead Time</button>
          ${isAdmin ? `<button class="edit" data-id="${po.id}">Edit</button>
          <button class="delete" data-id="${po.id}">Delete</button>` : ''}
        </div>
      `;
      poContainer.appendChild(item);
    });
  }

  if (isAdmin) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const customer = document.getElementById('customerName').value;
      const bid = document.getElementById('bidDt').value.trim();
      const po = document.getElementById('poRevDt').value.trim();
      const cr = document.getElementById('crRevDt').value.trim();
      if (!customer || !bid || !po || !cr) { alert('Please fill in all fields.'); return; }
      
      const poData = { customer, bid, po, cr };
      try {
        const method = editingId !== null ? 'PUT' : 'POST';
        const url = editingId !== null ? `/api/pos/${editingId}` : '/api/pos';
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(poData)
        });
        
        if (response.ok) {
          editingId = null;
          form.reset();
          await loadPOs();
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to save PO');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to save PO');
      }
    });
  }

  poContainer.addEventListener('click', async (e) => {
    const id = parseInt(e.target.dataset.id, 10);
    if (e.target.classList.contains('open-form')) {
      const po = pos.find(p => p.id === id);
      if (!po) return;
      const params = encodeParams(po);
      const type = e.target.dataset.form;
      const url = type === 'CR' ? `CR_index_all.html?${params}` :
                  type === 'PED' ? `PED_index.html?${params}` :
                  `LEAD_index.html?${params}`;
      window.open(url, '_blank');
    } else if (isAdmin && e.target.classList.contains('edit')) {
      const po = pos.find(p => p.id === id);
      if (!po) return;
      document.getElementById('customerName').value = po.customer;
      document.getElementById('bidDt').value = po.bid;
      document.getElementById('poRevDt').value = po.po;
      document.getElementById('crRevDt').value = po.cr;
      editingId = id;
      window.scrollTo({top:0, behavior:'smooth'});
    } else if (isAdmin && e.target.classList.contains('delete')) {
      if (confirm('Delete this PO?')) {
        try {
          const response = await fetch(`/api/pos/${id}`, { method: 'DELETE' });
          if (response.ok) {
            await loadPOs();
          } else {
            alert('Failed to delete PO');
          }
        } catch (err) {
          console.error(err);
          alert('Failed to delete PO');
        }
      }
    }
  });

  async function backupData() {
    try {
      const response = await fetch('/api/backup');
      if (response.ok) {
        const data = await response.json();
        const text = JSON.stringify(data, null, 2);
        const blob = new Blob([text], { type: 'text/plain' });
        const dt = new Date();
        const ts = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}-${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}${String(dt.getSeconds()).padStart(2,'0')}`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gtn-contract-review-backup-${ts}.txt`;
        a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
      } else {
        alert('Failed to create backup');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create backup');
    }
  }

  function restoreData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || typeof obj !== 'object') throw new Error('Invalid file format');
        if (!Array.isArray(obj.users) || !Array.isArray(obj.pos)) {
          throw new Error('Missing users/pos arrays');
        }
        const hasAdmin = obj.users.some(u => u && u.isAdmin === true);
        if (!hasAdmin) {
          alert('Restore aborted: imported data does not contain an Admin user.');
          return;
        }
        if (!confirm('Restore will replace current Users and POs. Proceed?')) return;

        const response = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj)
        });

        if (response.ok) {
          alert('Restore completed. Logging out...');
          await fetch('/api/logout', { method: 'POST' });
          window.location.href = 'login.html';
        } else {
          const data = await response.json();
          alert('Failed to restore: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error(err);
        alert('Failed to restore: ' + (err.message || 'Invalid file'));
      }
    };
    reader.readAsText(file);
  }

  if (isAdmin) {
    backupBtn.addEventListener('click', backupData);
    restoreBtn.addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', (e) => restoreData(e.target.files?.[0]));
  }

  manageUsersBtn.addEventListener('click', () => window.location.href = 'manage_users.html');
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('userDepartment');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('username');
    localStorage.removeItem('userIsAdmin');
    window.location.href = 'login.html';
  });

  loadPOs();
})();