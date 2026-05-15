const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

class LocalStorageMock {
    constructor() {
        this.store = new Map();
    }

    getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
    }

    setItem(key, value) {
        this.store.set(String(key), String(value));
    }

    removeItem(key) {
        this.store.delete(String(key));
    }

    clear() {
        this.store.clear();
    }
}

function loadScript(context, relativePath) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const code = fs.readFileSync(absolutePath, 'utf8');
    vm.runInContext(code, context, { filename: relativePath });
}

async function run() {
    const sandbox = {
        console,
        localStorage: new LocalStorageMock(),
        crypto: webcrypto,
        TextEncoder,
        Buffer,
        btoa: (value) => Buffer.from(value, 'binary').toString('base64')
    };
    sandbox.window = sandbox;

    const context = vm.createContext(sandbox);
    loadScript(context, 'js/data-store.js');
    loadScript(context, 'js/auth.js');

    const auth = context.window.auth;
    assert.ok(auth, 'auth must be exposed on window');

    const firstSignup = await auth.signup({
        name: 'Admin Owner',
        email: 'admin@example.com',
        password: 'Password123',
        role: 'parent'
    });
    assert.equal(firstSignup.ok, true, 'first signup should succeed');
    assert.equal(firstSignup.firstAdminBootstrap, true, 'first signup should bootstrap admin');
    assert.equal(firstSignup.user.role, 'admin', 'first user should be admin');
    assert.equal(firstSignup.user.isValidated, true, 'first admin should be validated');

    const usersAfterFirstSignup = auth.readUsers();
    assert.equal(usersAfterFirstSignup.length, 1, 'one user should exist');
    assert.ok(usersAfterFirstSignup[0].passwordHash, 'password hash must exist');
    assert.equal(
        Object.prototype.hasOwnProperty.call(usersAfterFirstSignup[0], 'password'),
        false,
        'plaintext password must not be stored'
    );

    const duplicateSignup = await auth.signup({
        name: 'Duplicate',
        email: 'ADMIN@example.com',
        password: 'Password123',
        role: 'parent'
    });
    assert.equal(duplicateSignup.ok, false, 'duplicate email must be rejected');
    assert.equal(duplicateSignup.reason, 'email_taken', 'duplicate reason must be email_taken');

    const weakPasswordSignup = await auth.signup({
        name: 'Weak User',
        email: 'weak@example.com',
        password: '123',
        role: 'parent'
    });
    assert.equal(weakPasswordSignup.ok, false, 'weak password must be rejected');
    assert.equal(weakPasswordSignup.reason, 'weak_password', 'weak reason must be weak_password');

    const secondSignup = await auth.signup({
        name: 'Second User',
        email: 'second@example.com',
        password: 'StrongPass123',
        role: 'parent'
    });
    assert.equal(secondSignup.ok, true, 'second signup should succeed');
    assert.equal(secondSignup.firstAdminBootstrap, false, 'second signup should not bootstrap');
    assert.equal(secondSignup.user.isValidated, false, 'second user must await validation');

    const invalidLogin = await auth.login('admin@example.com', 'wrong-pass');
    assert.equal(invalidLogin.ok, false, 'wrong password must fail');
    assert.equal(invalidLogin.reason, 'invalid_credentials');

    const blockedSecondLogin = await auth.login('second@example.com', 'StrongPass123');
    assert.equal(blockedSecondLogin.ok, false, 'non-validated user login must fail');
    assert.equal(blockedSecondLogin.reason, 'not_validated');

    const adminLogin = await auth.login('admin@example.com', 'Password123');
    assert.equal(adminLogin.ok, true, 'admin login should pass');
    assert.equal(adminLogin.user.role, 'admin');

    const validationResult = auth.validateUser('second@example.com');
    assert.equal(validationResult.ok, true, 'admin should validate second user');

    auth.logout();
    const secondLogin = await auth.login('second@example.com', 'StrongPass123');
    assert.equal(secondLogin.ok, true, 'validated second user should login');
    assert.equal(secondLogin.user.role, 'parent');

    const forbiddenPromote = auth.promoteToAdmin('second@example.com');
    assert.equal(forbiddenPromote.ok, false, 'non-admin should not promote');
    assert.equal(forbiddenPromote.reason, 'forbidden');

    auth.logout();
    await auth.login('admin@example.com', 'Password123');
    const promoteResult = auth.promoteToAdmin('second@example.com');
    assert.equal(promoteResult.ok, true, 'admin should promote');

    console.log('SMOKE AUTH: OK');
}

run().catch((error) => {
    console.error('SMOKE AUTH: FAILED');
    console.error(error);
    process.exitCode = 1;
});
