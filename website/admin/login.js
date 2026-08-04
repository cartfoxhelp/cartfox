// This file is referenced by login.html and handles the login form submission.

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const errorDisplay = document.getElementById('error');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Show spinner and disable button
            loginSpinner.classList.remove('hidden');
            loginBtn.disabled = true;
            errorDisplay.classList.add('hidden');

            const email = emailInput.value;
            const password = passwordInput.value;

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (data.twoFactorRequired) {
                        // 2FA is needed. Save the temporary token and redirect.
                        sessionStorage.setItem('cartfox_temp_token', data.tempToken);
                        window.location.href = 'verify-2fa.html';
                    } else {
                        // Login successful, no 2FA. Save final token and go to dashboard.
                        saveToken(data.token, false); // saveToken is from auth.js
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    // Display error message
                    errorDisplay.textContent = `❌ ${data.message || 'Login failed. Please check your credentials.'}`;
                    errorDisplay.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Login request failed:', error);
                errorDisplay.textContent = '❌ Could not connect to the server. Please try again later.';
                errorDisplay.classList.remove('hidden');
            } finally {
                // Hide spinner and re-enable button
                loginSpinner.classList.add('hidden');
                loginBtn.disabled = false;
            }
        });
    }
});