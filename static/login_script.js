(function(){
  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('userDepartment', data.user.department);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('userIsAdmin', data.user.isAdmin ? 'true' : 'false');
        localStorage.setItem('userRole', data.user.department);
        window.location.href = 'master.html';
      } else {
        errorDiv.textContent = data.error || 'Invalid username or password.';
      }
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Connection error. Please try again.';
    }
  });
})();