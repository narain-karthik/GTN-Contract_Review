(function(){
  const dept = localStorage.getItem('userDepartment') || localStorage.getItem('userRole');
  const isAdmin = (localStorage.getItem('userIsAdmin') === 'true');
  if (!dept) { window.location.href = 'login.html'; }
  if (!isAdmin) {
    alert('Access restricted to Admins.');
    window.location.href = 'master.html';
  }

  const form = document.getElementById('userForm');
  const userContainer = document.getElementById('userContainer');
  const noUser = document.getElementById('noUser');
  const backBtn = document.getElementById('backBtn');
  let users = [];

  async function loadUsers() {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        users = await response.json();
        render();
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  function render(){
    userContainer.innerHTML = '';
    if (users.length === 0){
      noUser.style.display = 'block';
      return;
    }
    noUser.style.display = 'none';
    users.forEach((u) => {
      const div = document.createElement('div');
      div.className = 'user-card';
      div.innerHTML = `
        <div class="user-meta">
          <div class="name">${u.name} <span class="muted">(${u.username})</span> ${u.isAdmin ? '<span class="badge">Admin</span>' : ''}</div>
          <div class="dept">Department: ${u.department.toUpperCase()}</div>
        </div>
        <div class="user-actions">
          <button class="btn small danger" data-act="del" data-id="${u.id}">Delete</button>
        </div>
      `;
      userContainer.appendChild(div);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const department = document.getElementById('department').value;
    const name = document.getElementById('name').value.trim();
    const password = document.getElementById('password').value;
    const isAdminNew = document.getElementById('isAdmin').checked;

    if (!username || !department || !name || !password) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, department, name, password, isAdmin: isAdminNew })
      });

      if (response.ok) {
        form.reset();
        await loadUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create user');
    }
  });

  userContainer.addEventListener('click', async (e) => {
    const act = e.target?.dataset?.act;
    const id = parseInt(e.target?.dataset?.id || '-1', 10);
    if (act === 'del' && id > 0) {
      if (confirm('Delete this user?')) {
        try {
          const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
          if (response.ok) {
            await loadUsers();
          } else {
            const data = await response.json();
            alert(data.error || 'Failed to delete user');
          }
        } catch (err) {
          console.error(err);
          alert('Failed to delete user');
        }
      }
    }
  });

  backBtn.addEventListener('click', () => window.location.href = 'master.html');

  loadUsers();
})();