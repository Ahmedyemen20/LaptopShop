// server.js — سيرفر متجر لابتوبات كامل (تسجيل دخول + منتجات + سلة + طلبات)
// يعمل بأوامر Node.js المدمجة فقط، بدون أي تثبيت خارجي (لا npm install مطلوب)

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { readJSON, writeJSON, ensureSeedData } = require('./db');
const { hashPassword, verifyPassword, createSessionToken, verifySessionToken } = require('./auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

ensureSeedData();

// ---------- أدوات مساعدة ----------

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function parseCookies(req) {
    const header = req.headers.cookie;
    const cookies = {};
    if (!header) return cookies;
    header.split(';').forEach((pair) => {
        const [key, ...rest] = pair.trim().split('=');
        cookies[key] = decodeURIComponent(rest.join('='));
    });
    return cookies;
}

function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1e6) req.destroy(); // حماية بسيطة من طلبات ضخمة
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function getCurrentUser(req) {
    const cookies = parseCookies(req);
    const payload = verifySessionToken(cookies.sid);
    if (!payload) return null;
    const users = readJSON('users', []);
    return users.find((u) => u.id === payload.userId) || null;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

function serveStatic(req, res, pathname) {
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    // منع الخروج من مجلد public
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404 - Page not found');
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

// ---------- السيرفر ----------

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    try {
        // ---------- تسجيل حساب جديد ----------
        if (pathname === '/api/register' && req.method === 'POST') {
            const { name, email, password } = await getBody(req);
            if (!name || !email || !password || password.length < 4) {
                return sendJSON(res, 400, { error: 'الرجاء تعبئة كل الحقول (كلمة المرور 4 أحرف فأكثر)' });
            }
            const users = readJSON('users', []);
            if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
                return sendJSON(res, 409, { error: 'هذا البريد مسجّل مسبقًا' });
            }
            const newUser = {
                id: Date.now(),
                name,
                email: email.toLowerCase(),
                passwordHash: hashPassword(password),
                cart: [],
            };
            users.push(newUser);
            writeJSON('users', users);

            const token = createSessionToken(newUser.id);
            res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`);
            return sendJSON(res, 201, { id: newUser.id, name: newUser.name, email: newUser.email });
        }

        // ---------- تسجيل الدخول ----------
        if (pathname === '/api/login' && req.method === 'POST') {
            const { email, password } = await getBody(req);
            const users = readJSON('users', []);
            const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
            if (!user || !verifyPassword(password || '', user.passwordHash)) {
                return sendJSON(res, 401, { error: 'البريد أو كلمة المرور غير صحيحة' });
            }
            const token = createSessionToken(user.id);
            res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`);
            return sendJSON(res, 200, { id: user.id, name: user.name, email: user.email });
        }

        // ---------- تسجيل الخروج ----------
        if (pathname === '/api/logout' && req.method === 'POST') {
            res.setHeader('Set-Cookie', `sid=; HttpOnly; Path=/; Max-Age=0`);
            return sendJSON(res, 200, { ok: true });
        }

        // ---------- بيانات المستخدم الحالي ----------
        if (pathname === '/api/me' && req.method === 'GET') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 200, { user: null });
            return sendJSON(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
        }

        // ---------- المنتجات: عرض الكل ----------
        if (pathname === '/api/products' && req.method === 'GET') {
            return sendJSON(res, 200, readJSON('products', []));
        }

        // ---------- المنتجات: إضافة (تتطلب تسجيل دخول) ----------
        if (pathname === '/api/products' && req.method === 'POST') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول لإضافة منتج' });
            const { name, price, img, category } = await getBody(req);
            if (!name || !price || !img || !category) {
                return sendJSON(res, 400, { error: 'كل الحقول مطلوبة' });
            }
            const products = readJSON('products', []);
            const newProduct = { id: Date.now(), name, price: Number(price), img, category };
            products.push(newProduct);
            writeJSON('products', products);
            return sendJSON(res, 201, newProduct);
        }

        // ---------- السلة: عرض ----------
        if (pathname === '/api/cart' && req.method === 'GET') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول' });
            const products = readJSON('products', []);
            const items = user.cart.map((productId) => products.find((p) => p.id === productId)).filter(Boolean);
            return sendJSON(res, 200, items);
        }

        // ---------- السلة: إضافة منتج ----------
        if (pathname === '/api/cart' && req.method === 'POST') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول لإضافة منتجات للسلة' });
            const { productId } = await getBody(req);
            const users = readJSON('users', []);
            const target = users.find((u) => u.id === user.id);
            target.cart.push(Number(productId));
            writeJSON('users', users);
            return sendJSON(res, 200, { ok: true });
        }

        // ---------- السلة: حذف عنصر عند فهرس معيّن ----------
        const cartItemMatch = pathname.match(/^\/api\/cart\/(\d+)$/);
        if (cartItemMatch && req.method === 'DELETE') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول' });
            const index = Number(cartItemMatch[1]);
            const users = readJSON('users', []);
            const target = users.find((u) => u.id === user.id);
            target.cart.splice(index, 1);
            writeJSON('users', users);
            return sendJSON(res, 200, { ok: true });
        }

        // ---------- إتمام الطلب (checkout) ----------
        if (pathname === '/api/checkout' && req.method === 'POST') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول لإتمام الطلب' });
            if (user.cart.length === 0) return sendJSON(res, 400, { error: 'السلة فارغة' });

            const products = readJSON('products', []);
            const items = user.cart.map((productId) => products.find((p) => p.id === productId)).filter(Boolean);
            const total = items.reduce((sum, p) => sum + p.price, 0);

            const orders = readJSON('orders', []);
            const order = { id: Date.now(), userId: user.id, items, total, date: new Date().toISOString() };
            orders.push(order);
            writeJSON('orders', orders);

            const users = readJSON('users', []);
            const target = users.find((u) => u.id === user.id);
            target.cart = [];
            writeJSON('users', users);

            return sendJSON(res, 201, order);
        }

        // ---------- طلبات المستخدم ----------
        if (pathname === '/api/orders' && req.method === 'GET') {
            const user = getCurrentUser(req);
            if (!user) return sendJSON(res, 401, { error: 'يجب تسجيل الدخول' });
            const orders = readJSON('orders', []).filter((o) => o.userId === user.id);
            return sendJSON(res, 200, orders);
        }

        // ---------- غير ذلك: ملفات ثابتة (الواجهة) ----------
        if (req.method === 'GET') {
            return serveStatic(req, res, pathname);
        }

        sendJSON(res, 404, { error: 'Not found' });
    } catch (err) {
        console.error(err);
        sendJSON(res, 500, { error: 'خطأ في السيرفر' });
    }
});

server.listen(PORT, () => {
    console.log(`✅ المتجر شغّال على: http://localhost:${PORT}`);
});
