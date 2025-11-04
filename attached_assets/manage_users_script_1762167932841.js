(function(){
  // Only Admins can manage users
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
  let users = JSON.parse(localStorage.getItem('contractReviewUsers') || '[]');

  function save(){ localStorage.setItem('contractReviewUsers', JSON.stringify(users)); }
  function adminCount(){ return users.filter(u => u.isAdmin === true).length; }

  function render(){
    userContainer.innerHTML = '';
    if (users.length === 0){
      noUser.style.display = 'block';
      return;
    }
    noUser.style.display = 'none';
    users.forEach((u, i) => {
      const div = document.createElement('div');
      div.className = 'user-card';
      div.innerHTML = `
        <div class="user-meta">
          <div class="name">${u.name} <span class="muted">(${u.username})</span> ${u.isAdmin ? '<span class="badge">Admin</span>' : ''}</div>
          <div class="dept">Department: ${u.department.toUpperCase()}</div>
        </div>
        <div class="user-actions">
          <button class="btn small danger" data-act="del" data-i="${i}">Delete</button>
        </div>
      `;
      userContainer.appendChild(div);
    });
  }

  form.addEventListener('submit', (e) => {
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
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      alert('Username already exists.');
      return;
    }
    users.push({username, department, name, password, isAdmin: !!isAdminNew});
    save();
    form.reset();
    render();
  });

  userContainer.addEventListener('click', (e) => {
    const act = e.target?.dataset?.act;
    const i = parseInt(e.target?.dataset?.i || '-1', 10);
    if (act === 'del' && i >= 0) {
      const u = users[i];
      if (u.username === 'admin' && u.isAdmin === true) {
        alert('Cannot delete the default Admin user.');
        return;
      }
      if (u.isAdmin === true && adminCount() <= 1) {
        alert('Cannot delete the last remaining Admin.');
        return;
      }
      if (confirm('Delete this user?')) {
        users.splice(i,1);
        save();
        render();
      }
    }
  });

  backBtn.addEventListener('click', () => window.location.href = 'master.html');

  render();
})();