import { clickSound } from '../engine/sounds.js';
import { makeNavHandler } from '../engine/keynav.js';
import { login as sessionLogin, InvalidCredentialsError } from '../api/session.js';

export function mountLoginReal(loginEl, { setKeyHandler }) {
    const usernameEl = loginEl.querySelector('#login-real-username');
    const passwordEl = loginEl.querySelector('#login-real-password');
    const errorEl    = loginEl.querySelector('#login-real-error');

    passwordEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') loginEl.querySelector('#login-real-submit').click();
    });

    function showLogin(onSuccess, onCancel) {
        usernameEl.value = '';
        passwordEl.value = '';
        errorEl.style.display = 'none';
        loginEl.style.display = 'flex';

        // Clone buttons to wipe previous onclick listeners before re-binding.
        const submitBtn = loginEl.querySelector('#login-real-submit');
        const backBtn   = loginEl.querySelector('#login-real-back');
        const newSubmit = submitBtn.cloneNode(true);
        const newBack   = backBtn.cloneNode(true);
        newSubmit.disabled = false;
        submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
        backBtn.parentNode.replaceChild(newBack, backBtn);

        loginEl.querySelector('#login-real-submit').onclick = async () => {
            clickSound();
            errorEl.style.display = 'none';
            const btn = loginEl.querySelector('#login-real-submit');
            btn.disabled = true;
            try {
                await sessionLogin(usernameEl.value, passwordEl.value);
                loginEl.style.display = 'none';
                onSuccess();
            } catch (err) {
                errorEl.textContent = (err instanceof InvalidCredentialsError)
                    ? 'CREDENZIALI NON VALIDE'
                    : 'ERRORE DI CONNESSIONE';
                errorEl.style.display = 'block';
                btn.disabled = false;
            }
        };

        loginEl.querySelector('#login-real-back').onclick = () => {
            clickSound();
            loginEl.style.display = 'none';
            onCancel();
        };

        const focusables = [
            usernameEl,
            passwordEl,
            loginEl.querySelector('#login-real-submit'),
            loginEl.querySelector('#login-real-back'),
        ];
        setKeyHandler(makeNavHandler(focusables));
        usernameEl.focus();
    }

    return { showLogin };
}
