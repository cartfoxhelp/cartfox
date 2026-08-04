// ==========================================
// CARTFOX - PRODUCT & CATALOG LOGIC (HYBRID)
// ==========================================

// Configuration
const BASE_URL = 'https://cartfox-backend.onrender.com';
const API_URL = `${BASE_URL}/api/products`;
// CART_STORAGE_KEY is now defined in script.js and used globally

function resolveImageUrl(imageValue) {
    if (!imageValue) return 'https://via.placeholder.com/500x500?text=CartFox';
    const value = String(imageValue).trim();
    if (!value) return 'https://via.placeholder.com/500x500?text=CartFox';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return `${BASE_URL}${value}`;
    return `${BASE_URL}/${value}`;
}

function normalizeProductImages(product) {
    const rawImages = product.images || [];
    const imageList = Array.isArray(rawImages) && rawImages.length > 0
        ? rawImages
        : (product.imageUrl ? [product.imageUrl] : []);

    const resolvedImages = imageList
        .filter(Boolean)
        .map(item => resolveImageUrl(item));

    return resolvedImages;
}

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');

let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 6;

// Utility Helpers
function parsePrice(raw) {
    if (raw == null) return 0;
    if (typeof raw === 'number') return raw;
    const cleaned = String(raw).replace(/[₹,\s]+/g, '').replace(/[^-0-9.]/g, '');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
}

function formatPrice(num) {
    return '₹' + Number(num).toLocaleString('en-IN');
}

// Initialize Page based on URL (Listing vs Single Detail View)
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount(); // Use unified function
    
    if (productId) {
        // Single Product View Mode
        const listingView = document.getElementById('productsListingView');
        const detailView = document.getElementById('singleProductView');
        if (listingView) listingView.style.display = 'none';
        if (detailView) detailView.style.display = 'block';
        
        fetchProductDetails(productId);
    } else {
        // Products Listing Mode
        const listingView = document.getElementById('productsListingView');
        const detailView = document.getElementById('singleProductView');
        if (listingView) listingView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';
        
        const searchBox = document.getElementById('navSearchBox');
        if (searchBox) searchBox.style.display = 'block';

        fetchAllProducts();
    }
});

// ==========================================
// 1. FETCH SINGLE PRODUCT DETAILS & GALLERY
// ==========================================
async function fetchProductDetails(id) {
    const detailContainer = document.getElementById('singleProductView');
    try {
        const res = await fetch(`${API_URL}/${id}`);
        if (!res.ok) throw new Error('Product not found');
        const product = await res.json();

        const priceNum = parsePrice(product.price);
        
        const imageList = normalizeProductImages(product);
        const safeMainImg = imageList.length > 0 ? imageList[0] : 'https://via.placeholder.com/500';

        let thumbnailsHtml = '';
        if (imageList.length > 1) {
            thumbnailsHtml = '<div style="display: flex; gap: 10px; margin-top: 15px; justify-content: center; flex-wrap: wrap;">';
            imageList.forEach(img => {
                thumbnailsHtml += `
                    <img src="${img}" 
                         onclick="document.getElementById('mainProductImage').src=this.src" 
                         style="width: 60px; height: 60px; object-fit: cover; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: 0.3s;"
                         onmouseover="this.style.borderColor='var(--primary-color)'" 
                         onmouseout="this.style.borderColor='#ddd'">
                `;
            });
            thumbnailsHtml += '</div>';
        }

        // Dual Button Logic (Amazon vs Cart)
        let actionButtonHtml = '';
        if (product.productType === 'amazon' && (product.affiliateLink || product.affiliate)) {
            const link = product.affiliateLink || product.affiliate;
            actionButtonHtml = `<a href="${link}" target="_blank" class="btn-buy-amazon" style="display:block; text-align:center; padding:15px; background:#FF9900; color:white; font-weight:bold; border-radius:5px; text-decoration:none;">🛒 Buy on Amazon</a>`;
        } else {
            const escapedName = (product.name || '').replace(/'/g, "\\'");
            actionButtonHtml = `<button class="btn" style="width:100%; padding:15px; font-size:16px; font-weight:bold;" onclick="addToCart('${product._id || product.id}', '${escapedName}', ${priceNum}, '${safeMainImg}')">Add to Cart 🛒</button>`;
        }

        let stockStatusHtml = '';
        if (product.productType !== 'amazon') { // Only show stock for non-Amazon products
            stockStatusHtml = (product.stock > 0 || product.stock == null) 
                ? `<span style="color:green; font-weight:bold;">✓ In Stock</span>` 
                : `<span style="color:red; font-weight:bold;">✗ Out of Stock</span>`;
        }
        

        detailContainer.innerHTML = `
            <a href="product.html" class="btn btn-secondary" style="margin-bottom: 20px; display: inline-block; text-decoration: none;">← Back to All Products</a>
            <div style="display: flex; flex-wrap: wrap; gap: 40px; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                
                <div style="flex: 1; min-width: 300px; text-align: center; background: #f9f9f9; padding: 20px; border-radius: 8px;">
                    <img id="mainProductImage" src="${safeMainImg}" alt="${product.name}" style="max-width: 100%; height: 350px; object-fit: contain;" onerror="this.onerror=null;this.src='https://via.placeholder.com/500x500?text=CartFox';">
                    ${thumbnailsHtml}
                </div>

                <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; justify-content: center;">
                    <h1 style="margin-bottom: 15px; color: var(--dark-color); font-size: 28px;">${product.name || ''}</h1>
                    <div style="margin-bottom: 15px; font-size: 15px; display: flex; gap: 15px; align-items: center;">
                        <span style="background: #f1f2f6; padding: 4px 10px; border-radius: 15px;">⭐ ${product.rating || 4.5} / 5</span>
                        <span>${stockStatusHtml}</span>
                    </div>
                    <h2 style="color: var(--primary-color); font-size: 26px; margin-bottom: 20px;">${formatPrice(priceNum)}</h2>
                    <p style="margin-bottom: 25px; line-height: 1.6; color: #666; font-size: 15px;">${product.description || 'Premium quality product curated specially for CartFox customers.'}</p>
                    
                    ${actionButtonHtml}
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        detailContainer.innerHTML = '<div style="text-align:center; padding:40px;"><h3>Product not found</h3><a href="product.html" class="btn" style="margin-top:15px; display:inline-block;">Back to Products</a></div>';
    }
}

// ==========================================
// 2. FETCH ALL PRODUCTS FOR CATALOG & GRID
// ==========================================
async function fetchAllProducts() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('API fetch failed');
        allProducts = await res.json();
    } catch (error) {
        console.warn("Backend offline, loading fallback products.");
        allProducts = [
            { _id: 1, name: 'Premium Smartphone', price: 24999, category: 'Electronics', rating: 5, images: [] },
            { _id: 2, name: 'Smart Watch', price: 8999, category: 'Electronics', rating: 4, images: [] }
        ];
    }
    filteredProducts = [...allProducts];
    displayProducts();
}

function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><h3>No products found!</h3></div>';
        const pagination = document.getElementById('paginationControls');
        if (pagination) pagination.style.display = 'none';
        return;
    }

    const pagination = document.getElementById('paginationControls');
    if (pagination) pagination.style.display = 'flex';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageProducts = filteredProducts.slice(start, end);

    pageProducts.forEach(product => {
        const priceNum = parsePrice(product.price);
        
        const imageList = normalizeProductImages(product);
        const safeImgUrl = imageList.length > 0 ? imageList[0] : '';

        const imageHtml = safeImgUrl 
            ? `<img src="${safeImgUrl}" alt="${product.name}" style="width:100%; height:160px; object-fit:contain;">`
            : `<div style="font-size: 40px; display:flex; justify-content:center; align-items:center; height:160px; background:#f5f5f5;">📦</div>`;

        let actionButtonHtml = '';
        if (product.productType === 'amazon' && (product.affiliateLink || product.affiliate)) {
            const link = product.affiliateLink || product.affiliate;
            actionButtonHtml = `<a href="${link}" target="_blank" class="btn-buy-amazon" style="display:block; text-align:center; padding:8px; background:#FF9900; color:white; font-weight:bold; border-radius:4px; margin-top:10px; text-decoration:none; font-size:14px;">🛒 Buy on Amazon</a>`;
        } else {
            const escapedName = (product.name || '').replace(/'/g, "\\'");
            actionButtonHtml = `<button class="btn-add-cart" onclick="addToCart('${product._id || product.id}', '${escapedName}', ${priceNum}, '${safeImgUrl}'); event.preventDefault();" style="width:150px; padding:8px; margin-top:10px; background:var(--primary-color); color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Add to Cart</button>`;
        }

        const detailUrl = `product.html?id=${product._id || product.id}`;

        const card = document.createElement('div');
        card.className = 'product-card slide-up';
        card.innerHTML = `
            <a href="${detailUrl}" style="text-decoration: none; color: inherit; display: block;">
                <div class="product-image" style="background: white; padding: 10px; border-bottom:1px solid #eee;">${imageHtml}</div>
            </a>
            <div class="product-info" style="padding: 15px;">
                <a href="${detailUrl}" style="text-decoration: none; color: inherit;">
                    <div class="product-name" style="font-weight:bold; font-size:15px; margin-bottom:5px;">${product.name || ''}</div>
                </a>
                <div class="product-price" style="color: var(--primary-color); font-size:17px; font-weight:bold; margin-bottom:5px;">${formatPrice(priceNum)}</div>
                <div class="product-rating" style="font-size:12px; color:#777; margin-bottom:10px;">⭐ ${product.rating || 4.5}</div>
                ${actionButtonHtml}
            </div>
        `;
        grid.appendChild(card);
    });

    updatePagination();
}

// ==========================================
// 3. FILTERS, SEARCH, PAGINATION & RESET
// ==========================================
function filterProducts() {
    const category = document.getElementById('categoryFilter').value.toLowerCase();
    const priceRange = document.getElementById('priceFilter').value;
    const sort = document.getElementById('sortFilter').value;

    filteredProducts = allProducts.filter(product => {
        if (category && (product.category || '').toLowerCase() !== category) return false;
        
        const p = parsePrice(product.price);
        if (priceRange) {
            if (priceRange === '0-1000' && p > 1000) return false;
            if (priceRange === '1000-5000' && (p < 1000 || p > 5000)) return false;
            if (priceRange === '5000-20000' && (p < 5000 || p > 20000)) return false;
            if (priceRange === '20000+' && p < 20000) return false;
        }
        return true;
    });

    if (sort === 'price-low') filteredProducts.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    if (sort === 'price-high') filteredProducts.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    
    currentPage = 1;
    displayProducts();
}

function searchProducts(event) {
    if (event.key === 'Enter') {
        const query = document.getElementById('searchInput').value.trim().toLowerCase();
        if (query) {
            filteredProducts = allProducts.filter(p => (p.name || '').toLowerCase().includes(query));
            currentPage = 1;
            displayProducts();
        } else {
            resetFilters();
        }
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

function nextPage() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetFilters() {
    document.getElementById('categoryFilter').value = '';
    document.getElementById('priceFilter').value = '';
    document.getElementById('sortFilter').value = 'newest';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    filteredProducts = [...allProducts];
    currentPage = 1;
    displayProducts();
}

// ==========================================
// 4. CART FUNCTIONS (Using unified functions from script.js)
// ==========================================

// addToCart function for product.js (adapted to use unified cart functions)
function addToCart(id, name, price, image) { // Keep signature as it's called with these args
    let cart = getCart(); // Use unified function
    let existingItem = cart.find(item => String(item.id) === String(id));
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({ id: id, name: name, price: price, image: image, quantity: 1 });
    }
    saveCart(cart); // Use unified function
    updateCartCount(); // Use unified function
    showNotification(`✅ ${name} added to cart!`); // Use unified function
}