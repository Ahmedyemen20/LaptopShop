// db.js — تخزين بسيط على شكل ملفات JSON (بدون قاعدة بيانات خارجية)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function filePath(name) {
    return path.join(DATA_DIR, `${name}.json`);
}

function readJSON(name, fallback) {
    try {
        const raw = fs.readFileSync(filePath(name), 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        return fallback;
    }
}

function writeJSON(name, data) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

// --- بذور بيانات أولية للمنتجات إذا كان الملف غير موجود ---
function ensureSeedData() {
    const products = readJSON('products', null);
    if (!products) {
        writeJSON('products', [
            { id: 1, name: 'laptop gaming 5070rtx', price: 1400, img: 'https://i.postimg.cc/3r1qWgJY/tnzyl-(1).avif', category: 'gaming' },
            { id: 2, name: 'laptop lenovo', price: 400, img: 'https://i.postimg.cc/s2CmTXgV/tnzyl.avif', category: 'normal' },
            { id: 3, name: 'laptop air', price: 1000, img: 'https://i.postimg.cc/Kj1tGS8q/tnzyl-(2).avif', category: 'strong' },
            { id: 4, name: 'laptop Aser', price: 1200, img: 'https://i.postimg.cc/Dz5G1yWG/shopping.avif', category: 'gaming' },
        ]);
    }
    if (!fs.existsSync(filePath('users'))) writeJSON('users', []);
    if (!fs.existsSync(filePath('orders'))) writeJSON('orders', []);
}

module.exports = { readJSON, writeJSON, ensureSeedData };
