// This file handles frontend authentication: token storage, redirection, and page protection.

const API_BASE_URL = "https://cartfox.onrender.com";

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
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
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

    window.location.href = '/admin/login';
}

function checkAuth() {

    const token = getToken();
    const path = window.location.pathname;

    // Pages accessible without login
   const publicPaths = [
    '/admin/login',
    '/admin/login.html',
    '/admin/forgot-password',
    '/admin/forgot-password.html'
];

    const isPublicPage = publicPaths.some(publicPath =>
        path.endsWith(publicPath)
    );


    if (token) {

        // Already logged in - don't show login page
        if (
            path.endsWith('/admin/login') ||
            path.endsWith('/admin/login.html')
        ) {
            window.location.href = '/admin/dashboard';
            return;
        }


        // Dashboard initialization
        if (
            (
                path.endsWith('/admin/dashboard') ||
                path.endsWith('/admin/dashboard.html')
            )
            &&
            typeof initDashboardPage === 'function'
        ) {

            console.log("Authentication successful. Loading dashboard data...");

            initDashboardPage();

        }


    } else {

        // No token and trying protected page
        if (!isPublicPage) {
            window.location.href = '/admin/login';
        }

    }
}


// Logout buttons
document.addEventListener('DOMContentLoaded', () => {

    const logoutBtns = document.querySelectorAll('.logout-btn');

    logoutBtns.forEach(btn => {

        btn.addEventListener('click', (e) => {

            e.preventDefault();

            if (confirm('क्या आप वाकई लॉगआउट करना चाहते हैं?')) {
                logout();
            }

        });

    });


    // Run authentication check
    checkAuth();

});