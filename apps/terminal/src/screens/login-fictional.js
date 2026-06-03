import { clickSound } from '../engine/sounds.js';
import { makeNavHandler } from '../engine/keynav.js';
import { submitFictionalLogin, recordLogin, InvalidCredentialsError } from '../engine/login-fictional.js';

const CREDENTIAL_ERROR = 'CREDENZIALI NON VALIDE';
const TRANSPORT_ERROR  = 'ERRORE DI CONNESSIONE. RIPROVA.';

export function mountLoginFictional(loginEl, { setKeyHandler }) {
    const loginUsernameEl = loginEl.querySelector('#login-username');
    const loginPasswordEl = loginEl.querySelector('#login-password');
    const loginErrorEl    = loginEl.querySelector('#login-error');

    loginPasswordEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') loginEl.querySelector('#login-submit').click();
    });

    function showLogin(loginBlock, terminalId, onSuccess, onBack) {
        loginUsernameEl.innerHTML = '';
        loginBlock.users.forEach(u => {
            const name = typeof u === 'string' ? u : u.username;
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            loginUsernameEl.appendChild(opt);
        });
        loginPasswordEl.value = '';
        loginErrorEl.style.display = 'none';
        loginEl.style.display = 'flex';

        const submitBtn = loginEl.querySelector('#login-submit');
        const backBtn   = loginEl.querySelector('#login-back');
        const newSubmit = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
        const newBack = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBack, backBtn);
        newSubmit.disabled = false;

        function showError(message) {
            loginErrorEl.textContent = message;
            loginErrorEl.style.display = 'block';
        }

        newSubmit.onclick = async () => {
            if (newSubmit.disabled) return;
            clickSound();
            loginErrorEl.style.display = 'none';
            // Disable while the request is in flight so a duplicate POST cannot be
            // issued for the same attempt (Enter clicks this same button, so it is
            // inert too while disabled).
            newSubmit.disabled = true;
            try {
                const username = await submitFictionalLogin(terminalId, loginUsernameEl.value, loginPasswordEl.value);
                recordLogin(username);
                loginEl.style.display = 'none';
                onSuccess(username);
            } catch (err) {
                // Wrong password: the canonical credential error. Any other failure
                // (network/HTTP-5xx/parse) is a transport fault, not the player's
                // mistake, so it gets a distinct message.
                showError(err instanceof InvalidCredentialsError ? CREDENTIAL_ERROR : TRANSPORT_ERROR);
                newSubmit.disabled = false;
            }
        };

        newBack.onclick = () => {
            loginEl.style.display = 'none';
            onBack();
        };

        const loginFocusables = [
            loginUsernameEl,
            loginPasswordEl,
            newSubmit,
            newBack,
        ];
        setKeyHandler(makeNavHandler(loginFocusables));
        loginUsernameEl.focus();
    }

    return { showLogin };
}
