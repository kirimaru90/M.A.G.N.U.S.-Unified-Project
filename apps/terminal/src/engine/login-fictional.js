import { apiPost } from '../api/client.js';

const loggedInUsers = new Map();

// Thrown by submitFictionalLogin() on a credential-rejection status (401) so the
// caller can distinguish a wrong password from a network/HTTP-5xx/parse failure.
// Mirrors src/api/session.js#InvalidCredentialsError (the real-user auth path).
export class InvalidCredentialsError extends Error {
    constructor() {
        super('invalid fictional credentials');
        this.name = 'InvalidCredentialsError';
    }
}

function getLoggedInUser(loginBlock) {
    for (const u of loginBlock.users) {
        const name = typeof u === 'string' ? u : u.username;
        if (loggedInUsers.has(name)) return name;
    }
    return null;
}

// Validate a fictional-login attempt against the server. The password never
// stays on the client: it is POSTed and the server decides. Resolves to the
// validated username on success; throws InvalidCredentialsError on a 401 and
// lets every other ApiError (network/HTTP-5xx/parse) propagate unchanged.
async function submitFictionalLogin(terminalId, username, password) {
    try {
        await apiPost('/terminals/' + encodeURIComponent(terminalId) + '/fictional-login', { username, password });
    } catch (err) {
        if (err && err.status === 401) throw new InvalidCredentialsError();
        throw err;
    }
    return username;
}

function recordLogin(username) {
    loggedInUsers.set(username, true);
}

function clearLogins() {
    loggedInUsers.clear();
}

export { getLoggedInUser, submitFictionalLogin, recordLogin, clearLogins };
