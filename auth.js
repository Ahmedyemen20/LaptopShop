// auth.js — تجزئة كلمات المرور وتوليد جلسات موقّعة، باستخدام وحدة crypto المدمجة في Node فقط
const crypto = require('crypto');

// غيّر هذا المفتاح السري قبل رفع الموقع لأي استضافة حقيقية (خزّنه في متغير بيئة)
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-before-production';

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const check = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// جلسة موقّعة: base64(payload).signature — بدون الحاجة لأي مكتبة JWT خارجية
function createSessionToken(userId) {
    const payload = JSON.stringify({ userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }); // صالحة 7 أيام
    const payloadB64 = Buffer.from(payload).toString('base64');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('hex');
    return `${payloadB64}.${signature}`;
}

function verifySessionToken(token) {
    if (!token || !token.includes('.')) return null;
    const [payloadB64, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('hex');
    if (signature !== expectedSig) return null;
    try {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        if (payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

module.exports = { hashPassword, verifyPassword, createSessionToken, verifySessionToken };
