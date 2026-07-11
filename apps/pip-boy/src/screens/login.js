import { mount } from '../engine/render.js';
import { login, InvalidCredentialsError } from '../api/session.js';

// Login is real-user JWT (pipboy-app-shell). The reference's footnote about a
// first login registering an id locally is deliberately not reproduced.
export function renderLogin(root, { onSuccess }) {
    mount(root, `
        <div class="pb-center-screen">
            <h1 class="pb-login-wordmark">M.A.G.N.U.S.</h1>
            <div class="pb-login-subtitle">ROBCO · TERMINALE DI CAMPO · OS v2.3</div>
            <hr class="pb-hairline" style="width:100%; max-width:280px;">
            <form class="pb-login-form" id="pb-login-form">
                <div class="pb-login-flavor">&gt; AUTENTICAZIONE RICHIESTA</div>
                <div class="pb-login-flavor">&gt; INSERIRE CREDENZIALI RANGER</div>

                <label class="pb-field">
                    <span class="pb-label">ID UTENTE</span>
                    <input class="pb-input" id="pb-login-username" type="text" autocomplete="username" required>
                </label>
                <label class="pb-field">
                    <span class="pb-label">CODICE DI ACCESSO</span>
                    <input class="pb-input" id="pb-login-password" type="password" autocomplete="current-password" required>
                </label>

                <div class="pb-error" id="pb-login-error" style="display:none;"></div>
                <button class="pb-btn pb-btn--primary pb-btn--block" type="submit" id="pb-login-submit">▸ ACCEDI</button>
            </form>
        </div>
    `);

    const form = root.querySelector('#pb-login-form');
    const usernameEl = root.querySelector('#pb-login-username');
    const passwordEl = root.querySelector('#pb-login-password');
    const errorEl = root.querySelector('#pb-login-error');
    const submitBtn = root.querySelector('#pb-login-submit');

    // A native form submit already fires on Enter in either field.
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        try {
            const user = await login(usernameEl.value, passwordEl.value);
            onSuccess(user);
        } catch (err) {
            errorEl.textContent = (err instanceof InvalidCredentialsError)
                ? '⚠ CREDENZIALI NON VALIDE'
                : '⚠ ERRORE DI CONNESSIONE';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
        }
    });

    usernameEl.focus();
}
