document.addEventListener('DOMContentLoaded', () => {

    // 2FA Form Elements
    const verify2faForm = document.getElementById('verify2faForm');
    const twoFactorCodeInput = document.getElementById('twoFactorCode');
    const verifyBtn = document.getElementById('verifyBtn');
    const verifySpinner = document.getElementById('verifySpinner');
    const errorDisplay = document.getElementById('error');

    // Recovery Form Elements
    const recoveryFormBox = document.getElementById('recoveryFormBox');
    const recoveryForm = document.getElementById('recoveryForm');
    const recoveryCodeInput = document.getElementById('recoveryCode');
    const recoveryBtn = document.getElementById('recoveryBtn');
    const recoverySpinner = document.getElementById('recoverySpinner');
    const recoveryErrorDisplay = document.getElementById('recoveryError');

    // Toggle Links
    const useRecoveryCodeLink = document.getElementById('useRecoveryCodeLink');
    const use2faCodeLink = document.getElementById('use2faCodeLink');

    const tempToken = sessionStorage.getItem('cartfox_temp_token');

    if (!tempToken) {
        alert('Session expired. Please log in again.');
        window.location.href = 'login.html';
        return;
    }

    // Toggle between 2FA and Recovery forms
    useRecoveryCodeLink.addEventListener('click', (e) => {
        e.preventDefault();
        verify2faForm.parentElement.classList.add('hidden');
        recoveryFormBox.classList.remove('hidden');
    });

    use2faCodeLink.addEventListener('click', (e) => {
        e.preventDefault();
        recoveryFormBox.classList.add('hidden');
        verify2faForm.parentElement.classList.remove('hidden');
    });

    // Handle 2FA code submission
    verify2faForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        verifySpinner.classList.remove('hidden');
        verifyBtn.disabled = true;
        errorDisplay.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/2fa/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken, twoFactorCode: twoFactorCodeInput.value }),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                sessionStorage.removeItem('cartfox_temp_token');
                saveToken(data.token, false); // 2FA login is session-based by default
                window.location.href = 'dashboard.html';
            } else {
                errorDisplay.textContent = `❌ ${data.message || 'Verification failed.'}`;
                errorDisplay.classList.remove('hidden');
            }
        } catch (error) {
            errorDisplay.textContent = '❌ Server connection error.';
            errorDisplay.classList.remove('hidden');
        } finally {
            verifySpinner.classList.add('hidden');
            verifyBtn.disabled = false;
        }
    });

    // Handle Recovery code submission
    recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        recoverySpinner.classList.remove('hidden');
        recoveryBtn.disabled = true;
        recoveryErrorDisplay.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/2fa/recover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken, recoveryCode: recoveryCodeInput.value }),
            });
            const data = await response.json();
            if (response.ok && data.success) {
                sessionStorage.removeItem('cartfox_temp_token');
                saveToken(data.token, false);
                window.location.href = 'dashboard.html';
            } else {
                recoveryErrorDisplay.textContent = `❌ ${data.message || 'Recovery failed.'}`;
                recoveryErrorDisplay.classList.remove('hidden');
            }
        } catch (error) {
            recoveryErrorDisplay.textContent = '❌ Server connection error.';
            recoveryErrorDisplay.classList.remove('hidden');
        } finally {
            recoverySpinner.classList.add('hidden');
            recoveryBtn.disabled = false;
        }
    });
});