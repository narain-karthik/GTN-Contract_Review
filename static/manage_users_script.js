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
  const formTitle = document.getElementById('formTitle');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const editUserId = document.getElementById('editUserId');
  const passwordLabel = document.getElementById('passwordLabel');
  const passwordInput = document.getElementById('password');
  const usernameInput = document.getElementById('username');
  let users = [];
  let editingUser = null;

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
          <div class="name">${u.name} <span class="muted">(${u.username})</span> ${u.isAdmin ? '<span class="badge">Admin</span>' : ''} ${u.leadFormAccess ? '<span class="badge lead">LEAD</span>' : ''}</div>
          <div class="dept">Department: ${u.department.toUpperCase()}</div>
        </div>
        <div class="user-actions">
          <button class="btn small" data-act="edit" data-id="${u.id}">Edit</button>
          <button class="btn small danger" data-act="del" data-id="${u.id}">Delete</button>
        </div>
      `;
      userContainer.appendChild(div);
    });
  }

  function resetForm() {
    editingUser = null;
    editUserId.value = '';
    formTitle.textContent = 'Create User';
    submitBtn.textContent = 'Add User';
    cancelBtn.style.display = 'none';
    passwordLabel.textContent = 'Password';
    passwordInput.required = true;
    usernameInput.disabled = false;
    form.reset();
  }

  function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    editingUser = user;
    editUserId.value = user.id;
    formTitle.textContent = 'Edit User';
    submitBtn.textContent = 'Update User';
    cancelBtn.style.display = 'inline-block';
    passwordLabel.textContent = 'Password (leave blank to keep current)';
    passwordInput.required = false;
    usernameInput.disabled = true;

    document.getElementById('username').value = user.username;
    document.getElementById('name').value = user.name;
    document.getElementById('department').value = user.department;
    document.getElementById('password').value = '';
    document.getElementById('isAdmin').checked = user.isAdmin;
    document.getElementById('leadFormAccess').checked = user.leadFormAccess || false;

    form.scrollIntoView({ behavior: 'smooth' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const department = document.getElementById('department').value;
    const name = document.getElementById('name').value.trim();
    const password = document.getElementById('password').value;
    const isAdminNew = document.getElementById('isAdmin').checked;
    const leadFormAccessNew = document.getElementById('leadFormAccess').checked;

    if (!department || !name) {
      alert('Please fill in all required fields.');
      return;
    }

    if (!editingUser && !password) {
      alert('Password is required for new users.');
      return;
    }

    try {
      let response;
      if (editingUser) {
        const payload = { name, department, isAdmin: isAdminNew, leadFormAccess: leadFormAccessNew };
        if (password) {
          payload.password = password;
        }
        response = await fetch(`/api/users/${editUserId.value}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, department, name, password, isAdmin: isAdminNew, leadFormAccess: leadFormAccessNew })
        });
      }

      if (response.ok) {
        resetForm();
        await loadUsers();
      } else {
        const data = await response.json();
        alert(data.error || (editingUser ? 'Failed to update user' : 'Failed to create user'));
      }
    } catch (err) {
      console.error(err);
      alert(editingUser ? 'Failed to update user' : 'Failed to create user');
    }
  });

  userContainer.addEventListener('click', async (e) => {
    const act = e.target?.dataset?.act;
    const id = parseInt(e.target?.dataset?.id || '-1', 10);
    
    if (act === 'edit' && id > 0) {
      editUser(id);
    } else if (act === 'del' && id > 0) {
      if (confirm('Delete this user?')) {
        try {
          const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
          if (response.ok) {
            resetForm();
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

  cancelBtn.addEventListener('click', () => {
    resetForm();
  });

  backBtn.addEventListener('click', () => window.location.href = 'master.html');

  loadUsers();
})();