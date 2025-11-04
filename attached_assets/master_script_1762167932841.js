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

  let pos = JSON.parse(localStorage.getItem('contractReviewPOs') || '[]');
  let editingId = null;

  const dept = localStorage.getItem('userDepartment') || localStorage.getItem('userRole');
  const name = localStorage.getItem('userName') || localStorage.getItem('username') || '';
  const isAdmin = (localStorage.getItem('userIsAdmin') === 'true');

  if (!dept) { window.location.href = 'login.html'; return; }

  who.textContent = `${name} (${dept.toUpperCase()}${isAdmin ? ', Admin' : ''})`;

  // Role-based UI
  if (!isAdmin) {
    addPoSection.style.display = 'none';
    manageUsersBtn.style.display = 'none';
    backupBtn.style.display = 'none';
    restoreBtn.style.display = 'none';
  }

  function save(){ localStorage.setItem('contractReviewPOs', JSON.stringify(pos)); }
  function encodeParams(data) {
    return Object.keys(data).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`).join('&');
  }

  function renderPOs() {
    poContainer.innerHTML = '';
    if (pos.length === 0) {
      noPO.style.display = 'block';
      return;
    }
    noPO.style.display = 'none';
    pos.forEach((po, index) => {
      const item = document.createElement('div');
      item.className = 'po-item';
      item.innerHTML = `
        <div class="po-details">
          <strong>${po.po}</strong> — Customer: ${po.customer}, BID: ${po.bid}, CR: ${po.cr}
        </div>
        <div class="po-actions">
          <button class="open-form" data-id="${index}" data-form="CR">Contract Review</button>
          <button class="open-form" data-id="${index}" data-form="PED">PED Review</button>
          <button class="open-form" data-id="${index}" data-form="LEAD">Lead Time</button>
          ${isAdmin ? `<button class="edit" data-id="${index}">Edit</button>
          <button class="delete" data-id="${index}">Delete</button>` : ''}
        </div>
      `;
      poContainer.appendChild(item);
    });
  }

  if (isAdmin) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const customer = document.getElementById('customerName').value;
      const bid = document.getElementById('bidDt').value.trim();
      const po = document.getElementById('poRevDt').value.trim();
      const cr = document.getElementById('crRevDt').value.trim();
      if (!customer || !bid || !po || !cr) { alert('Please fill in all fields.'); return; }
      const poData = { customer, bid, po, cr };
      if (editingId !== null) {
        pos[editingId] = poData;
        editingId = null;
      } else {
        pos.push(poData);
      }
      save();
      form.reset();
      renderPOs();
    });
  }

  poContainer.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('open-form')) {
      const po = pos[id];
      const params = encodeParams(po);
      const type = e.target.dataset.form;
      const url = type === 'CR' ? `CR_index_all.html?${params}` :
                  type === 'PED' ? `PED_index.html?${params}` :
                  `LEAD_index.html?${params}`;
      window.open(url, '_blank');
    } else if (isAdmin && e.target.classList.contains('edit')) {
      const po = pos[id];
      document.getElementById('customerName').value = po.customer;
      document.getElementById('bidDt').value = po.bid;
      document.getElementById('poRevDt').value = po.po;
      document.getElementById('crRevDt').value = po.cr;
      editingId = parseInt(id,10);
      window.scrollTo({top:0, behavior:'smooth'});
    } else if (isAdmin && e.target.classList.contains('delete')) {
      if (confirm('Delete this PO?')) {
        pos.splice(id,1);
        save();
        renderPOs();
      }
    }
  });

  // Backup to .txt (JSON)
  function backupData() {
    const users = JSON.parse(localStorage.getItem('contractReviewUsers') || '[]');
    const payload = {
      meta: {
        app: 'GTN-ContractReview',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        by: localStorage.getItem('username') || ''
      },
      users,
      pos
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'text/plain' });
    const dt = new Date();
    const ts = `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}-${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}${String(dt.getSeconds()).padStart(2,'0')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gtn-contract-review-backup-${ts}.txt`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  // Restore from .txt (JSON)
  function restoreData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
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

        localStorage.setItem('contractReviewUsers', JSON.stringify(obj.users));
        localStorage.setItem('contractReviewPOs', JSON.stringify(obj.pos));
        alert('Restore completed. Reloading...');
        window.location.reload();
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
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('userDepartment');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('username');
    localStorage.removeItem('userIsAdmin');
    window.location.href = 'login.html';
  });

  renderPOs();
})();