// ==========================================
// CARTFOX - CUSTOMER AUTHENTICATION LOGIC
// ==========================================

// Configuration
const BASE_URL = 'https://cartfox-backend.onrender.com';
const API_URL = `${BASE_URL}/api/products`;

// Signup Handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        // Local storage fallback agar backend route na ho
        let users = JSON.parse(localStorage.getItem('cartfox_users')) || [];
        if (users.find(u => u.email === email)) {
            alert('User with this email already exists!');
            return;
        }

        users.push({ name, email, password });
        localStorage.setItem('cartfox_users', JSON.stringify(users));
        
        alert('Account created successfully! Please login.');
        window.location.href = 'login.html';
    });
}

// Login Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        let users = JSON.parse(localStorage.getItem('cartfox_users')) || [];
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            localStorage.setItem('cartfox_logged_in_user', JSON.stringify(user));
            alert(`Welcome back, ${user.name}!`);
            window.location.href = 'index.html';
        } else {
            alert('Invalid email or password!');
        }
    });
}