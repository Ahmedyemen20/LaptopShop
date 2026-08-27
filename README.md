# متجر اللابتوبات — Backend + Frontend

## طريقة التشغيل (لا يحتاج npm install)

1. تأكد إن عندك Node.js مثبت (v16 أو أحدث): https://nodejs.org
2. افتح Terminal داخل مجلد المشروع
3. شغّل الأمر:
   ```
   node server.js
   ```
4. افتح المتصفح على: http://localhost:3000

## كيف يشتغل

- **بدون قاعدة بيانات خارجية**: البيانات تُخزّن في ملفات JSON داخل مجلد `data/` (يُنشأ تلقائيًا أول تشغيل)
- **بدون مكتبات خارجية**: كل الكود مبني على وحدات Node.js المدمجة فقط (http, crypto, fs) — ما يحتاج `npm install`
- **تسجيل الدخول**: كلمات المرور مشفّرة بـ scrypt، والجلسة عبارة عن توكن موقّع (HMAC) محفوظ في كوكي HttpOnly

## الملفات

- `server.js` — السيرفر الرئيسي وكل الـ API
- `auth.js` — تشفير كلمات المرور وتوليد/التحقق من الجلسات
- `db.js` — قراءة/كتابة البيانات من ملفات JSON
- `public/` — واجهة الموقع (index.html, login.html, register.html, style.css, script.js)
- `data/` — يُنشأ تلقائيًا، فيه users.json, products.json, orders.json

## قبل رفع الموقع فعليًا على الإنترنت

1. غيّر `SESSION_SECRET` في `auth.js` أو مرره كمتغير بيئة:
   ```
   SESSION_SECRET=مفتاح-عشوائي-قوي node server.js
   ```
2. لو تبي تستضيفه، أسهل خيارات مجانية: Render.com أو Railway.app — بس ترفع المجلد وتشغّل `node server.js`
3. لعدد مستخدمين كبير، الأفضل الانتقال من ملفات JSON لقاعدة بيانات حقيقية (PostgreSQL/MongoDB) — قولّي إذا تبي أساعدك بهذا لاحقًا

## API المتوفرة

| Method | Endpoint | الوصف |
|---|---|---|
| POST | /api/register | إنشاء حساب |
| POST | /api/login | تسجيل دخول |
| POST | /api/logout | تسجيل خروج |
| GET | /api/me | بيانات المستخدم الحالي |
| GET | /api/products | كل المنتجات |
| POST | /api/products | إضافة منتج (يتطلب تسجيل دخول) |
| GET | /api/cart | سلة المستخدم |
| POST | /api/cart | إضافة منتج للسلة |
| DELETE | /api/cart/:index | حذف منتج من السلة |
| POST | /api/checkout | إتمام الطلب |
| GET | /api/orders | طلبات المستخدم |
