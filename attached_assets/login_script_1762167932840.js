(function(){
  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('error');

  // Ensure there is at least one admin (default IT admin)
  function seedDefaultAdmin(){
    const key = 'contractReviewUsers';
    const users = JSON.parse(localStorage.getItem(key) || '[]');
    const hasAdmin = users.some(u => u.isAdmin === true);
    if (!users.find(u => u.username === 'admin')) {
      users.push({
        username: 'admin',
        name: 'IT Administrator',
        department: 'it',
        password: 'admin',
        isAdmin: true
      });
      localStorage.setItem(key, JSON.stringify(users));
    } else if (!hasAdmin) {
      const idx = users.findIndex(u => u.username === 'admin');
      if (idx >= 0) users[idx].isAdmin = true;
      localStorage.setItem(key, JSON.stringify(users));
    }
  }
  seedDefaultAdmin();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const users = JSON.parse(localStorage.getItem('contractReviewUsers') || '[]');
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      localStorage.setItem('userDepartment', user.department);
      localStorage.setItem('userName', user.name || user.username);
      localStorage.setItem('username', user.username);
      localStorage.setItem('userIsAdmin', user.isAdmin ? 'true' : 'false');
      // Back-compat
      localStorage.setItem('userRole', user.department);
      window.location.href = 'master.html';
    } else {
      errorDiv.textContent = 'Invalid username or password.';
    }
  });
})();