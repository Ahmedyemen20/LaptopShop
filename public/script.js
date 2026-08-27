// script.js — الواجهة الآن تتحدث مع سيرفر حقيقي عبر fetch() بدل بيانات وهمية بالمتصفح

let allProducts = [];
let currentUser = null;

const filters = { search: '', category: 'all', price: 'all' };

const contentProducts = document.getElementById('content-products');

/* ================= تحميل المستخدم الحالي ================= */

async function loadCurrentUser() {
    const res = await fetch('/api/me');
    const data = await res.json();
    currentUser = data.user;
    renderUserMenu();
}

function renderUserMenu() {
    const el = document.getElementById('userMenu');
    if (currentUser) {
        el.innerHTML = `
            <span>Hi, ${currentUser.name}</span>
            <button type="button" id="logoutBtn">Logout</button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            currentUser = null;
            renderUserMenu();
            updateCartUI();
        });
    } else {
        el.innerHTML = `<a href="login.html">Login</a>`;
    }
}

/* ================= عرض المنتجات ================= */

function renderProducts() {
    let items = allProducts.filter((p) => p.name.toLowerCase().includes(filters.search));

    if (filters.category !== 'all') {
        items = items.filter((p) => p.category === filters.category);
    }
    if (filters.price === '500-1000') {
        items = items.filter((p) => p.price >= 500 && p.price <= 1000);
    } else if (filters.price === '1000-1500') {
        items = items.filter((p) => p.price >= 1000 && p.price <= 1500);
    }

    contentProducts.innerHTML = '';
    if (items.length === 0) {
        contentProducts.innerHTML = `<p class="no-results">No products found</p>`;
        return;
    }

    items.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${p.img}" alt="${p.name}">
            <h3>${p.name}</h3>
            <div class="card-meta">
                <span class="spec-chip">${p.category}</span>
                <span class="spec-chip price">$${p.price}</span>
            </div>
            <button type="button" class="btnadd-item" id="btnadd" data-id="${p.id}">add to cart</button>
        `;
        contentProducts.appendChild(card);
    });

    contentProducts.querySelectorAll('.btnadd-item').forEach((btn) => {
        btn.addEventListener('click', () => addToCart(Number(btn.dataset.id)));
    });
}

async function loadProducts() {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProducts();
}

document.getElementById('search-input').addEventListener('input', (e) => {
    filters.search = e.target.value.toLowerCase();
    renderProducts();
});
document.getElementById('select').addEventListener('change', (e) => {
    filters.category = e.target.value;
    renderProducts();
});
document.getElementById('selectPrice').addEventListener('change', (e) => {
    filters.price = e.target.value;
    renderProducts();
});

/* ================= إضافة منتج (تتطلب تسجيل دخول) ================= */

const btnAdd = document.getElementById('Add');
let pageAdd = false;

btnAdd.addEventListener('click', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    if (!pageAdd) {
        pageAdd = document.createElement('div');
        pageAdd.id = 'pageAdd';
        pageAdd.innerHTML = `
        <button type="button" id="close">Close</button>
        <h1 style="text-align: center; color: white;">Add product</h1>
        <label for="input-Name">Name of the product</label>
        <input type="text" id="input-Name">
        <label for="input-price">price of product</label>
        <input type="number" id="input-price">
        <label for="input-img">img src</label>
        <input type="text" id="input-img">
        <label for="Category-input">Category</label>
        <select id="Category-input">
            <option value="gaming">gaming</option>
            <option value="normal">normal</option>
            <option value="strong">strong</option>
        </select>
        <p class="field-error" id="addError"></p>
        <button type="button" id="send">Add</button>
        `;
        document.body.appendChild(pageAdd);
        document.getElementById('close').addEventListener('click', closediv);

        document.getElementById('send').addEventListener('click', async () => {
            const inputN = document.getElementById('input-Name');
            const inputP = document.getElementById('input-price');
            const inputImg = document.getElementById('input-img');
            const inputC = document.getElementById('Category-input');
            const errorEl = document.getElementById('addError');

            const name = inputN.value.trim();
            const price = Number(inputP.value);
            const img = inputImg.value.trim();
            const category = inputC.value;

            if (!name || !img || !price || price <= 0) {
                errorEl.textContent = 'Please fill in a valid name, price, and image URL.';
                return;
            }

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, price, img, category }),
            });
            if (!res.ok) {
                const data = await res.json();
                errorEl.textContent = data.error || 'Something went wrong';
                return;
            }

            inputN.value = '';
            inputP.value = '';
            inputImg.value = '';
            errorEl.textContent = '';
            closediv();
            await loadProducts();
        });
    }
});

function closediv() {
    if (pageAdd) {
        pageAdd.remove();
        pageAdd = null;
    }
}

/* ================= السلة (متصلة بالسيرفر) ================= */

async function addToCart(productId) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
    });
    updateCartUI();
}

async function removeFromCart(index) {
    await fetch(`/api/cart/${index}`, { method: 'DELETE' });
    updateCartUI();
}

async function updateCartUI() {
    const count = document.getElementById('Count');
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');

    if (!currentUser) {
        count.innerText = '0';
        cartItemsEl.innerHTML = `<p id="cartEmptyMsg">Log in to see your cart</p>`;
        cartTotalEl.textContent = '';
        return;
    }

    const res = await fetch('/api/cart');
    const items = await res.json();
    count.innerText = items.length;

    if (items.length === 0) {
        cartItemsEl.innerHTML = `<p id="cartEmptyMsg">Your cart is empty</p>`;
        cartTotalEl.textContent = '';
        return;
    }

    cartItemsEl.innerHTML = '';
    let total = 0;
    items.forEach((p, index) => {
        total += p.price;
        const item = document.createElement('div');
        item.className = 'cart-item';
        item.innerHTML = `
            <img src="${p.img}" alt="${p.name}">
            <div class="cart-item-info">
                <p>${p.name}</p>
                <p>$${p.price}</p>
            </div>
            <button type="button" class="cart-remove-btn" data-index="${index}">Remove</button>
        `;
        cartItemsEl.appendChild(item);
    });
    cartTotalEl.textContent = `Total: $${total}`;

    cartItemsEl.querySelectorAll('.cart-remove-btn').forEach((btn) => {
        btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.index)));
    });
}

const cartPanel = document.getElementById('cartPanel');
document.getElementById('btncart').addEventListener('click', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    cartPanel.classList.add('open');
});
document.getElementById('closeCart').addEventListener('click', () => {
    cartPanel.classList.remove('open');
});

document.getElementById('checkoutBtn').addEventListener('click', async () => {
    const res = await fetch('/api/checkout', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
        alert(data.error || 'Could not complete checkout');
        return;
    }
    alert(`Order placed! Total: $${data.total}`);
    updateCartUI();
});

/* ================= نموذج التواصل ================= */

const contactForm = document.getElementById('Contact-form');
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formMsg = document.getElementById('formMsg');
    const name = document.getElementById('input-name').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('massage').value.trim();

    if (!name || !email || !subject || !message) {
        formMsg.style.color = 'red';
        formMsg.textContent = 'Please fill in all fields.';
        return;
    }
    formMsg.style.color = 'green';
    formMsg.textContent = `Thanks ${name}, your message has been received!`;
    contactForm.reset();
});

/* ================= التشغيل ================= */

(async function init() {
    await loadCurrentUser();
    await loadProducts();
    await updateCartUI();
})();
