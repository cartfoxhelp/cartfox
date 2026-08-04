// This file is referenced by login.html and handles the login form submission.

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const errorDisplay = document.getElementById('error');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        loginSpinner.classList.remove('hidden');
        loginBtn.disabled = true;
        errorDisplay.classList.add('hidden');

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {

                if (data.twoFactorRequired) {

                    sessionStorage.setItem(
                        'cartfox_temp_token',
                        data.tempToken
                    );

                    window.location.href = '/admin/verify-2fa';

                } else {

                    saveToken(data.token, false);

                    window.location.href = '/admin/dashboard';

                }

            } else {

                errorDisplay.textContent =
                    `❌ ${data.message || 'Login failed.'}`;

                errorDisplay.classList.remove('hidden');
            }

        } catch (err) {

            console.error(err);

            errorDisplay.textContent =
                '❌ Could not connect to the server.';

            errorDisplay.classList.remove('hidden');

        } finally {

            loginSpinner.classList.add('hidden');
            loginBtn.disabled = false;

        }

    });

});