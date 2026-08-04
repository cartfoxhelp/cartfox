// This file handles frontend authentication: token storage, redirection, and page protection.

const API_BASE_URL = "https://cartfox-backend.onrender.com";

function saveToken(token, rememberMe) {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('cartfox_admin_token', token);
}

function getToken() {
    return localStorage.getItem('cartfox_admin_token') || sessionStorage.getItem('cartfox_admin_token');
}

async function getUserDetails() {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            return data.user;
        }
    } catch (error) {
        console.error("Failed to fetch user details:", error);
    }
    return null;
}

function logout() {
    localStorage.removeItem('cartfox_admin_token');
    sessionStorage.removeItem('cartfox_admin_token');
    window.location.href = 'login.html';
}

function checkAuth() {
    const token = getToken();
    const path = window.location.pathname;

    // List of pages accessible without a login token
    const publicPaths = ['/login.html', '/forgot-password.html', '/verify-2fa.html'];
    const isPublicPage = publicPaths.some(publicPath => path.endsWith(publicPath));

    if (token) {
        // User is logged in. If they try to access the login page, redirect to the dashboard.
        if (path.endsWith('/login.html')) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // On the dashboard page, initialize its content.
        if (path.endsWith('/dashboard.html') && typeof initDashboardPage === 'function') {
            console.log("Authentication successful. Loading dashboard data...");
            initDashboardPage();
            if (typeof check2faStatus === 'function') check2faStatus();
        }

    } else {
        // User is not logged in. If they are on a protected page, redirect to login.
        if (!isPublicPage) {
            window.location.href = 'login.html';
        }
    }
}

// Attach logout function to the logout button if it exists
document.addEventListener('DOMContentLoaded', () => {
    // Select all logout buttons on the page (header and sidebar)
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Add confirmation dialog before logging out
            if (confirm('क्या आप वाकई लॉगआउट करना चाहते हैं?')) {
                logout();
            }
        });
    });
    
    // Run auth check on every page that includes this script
    checkAuth();
});