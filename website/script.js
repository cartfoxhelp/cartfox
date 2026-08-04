// ==========================================
// CARTFOX - GLOBAL WEBSITE SCRIPT (script.js)
// PART 1
// ==========================================

const BASE_URL = 'https://cartfox-backend.onrender.com';

const API_URL = `${BASE_URL}/api/products`;

function resolveImageUrl(imageValue) {

    if (!imageValue) {
        return 'https://via.placeholder.com/250x250?text=CartFox';
    }

    const value = String(imageValue).trim();

    if (!value) {
        return 'https://via.placeholder.com/250x250?text=CartFox';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${BASE_URL}${value}`;
    }

    return `${BASE_URL}/${value}`;
}


const CART_STORAGE_KEY = 'cartfox_cart';

let allProducts = [];

const searchBox = document.getElementById('searchBox');

const cartCountElement = document.getElementById('cartCount');


let currentSort = 'best';

let currentFilter = 'All';

let currentSearch = '';

// ===============================
// PAGE LOAD
// ===============================


document.addEventListener(
    'DOMContentLoaded',
    () => {

        loadProducts();
        updateCartCount(); // Use unified function

    }
);



// ===============================
// LOAD PRODUCTS
// ===============================


async function loadProducts() {

    const productGrid =
        document.getElementById('productGrid');


    try {


        const response =
            await fetch(API_URL);


        if (!response.ok) {

            throw new Error(
                'Failed to fetch products'
            );

        }


        allProducts =
            await response.json();

        renderHomepageProducts(allProducts);

        renderCategoryCards();

        initSearch();

        initNewsletter();

        applySearchFromUrl();

        sortAndRender();

        updateCartCount();



    }

    catch(error) {


        console.error(
            'Error loading products:',
            error
        );


        if(productGrid) {

            productGrid.innerHTML =
            `
            <p style="color:red;text-align:center;">
            ⚠️ Cannot connect to CartFox server
            </p>
            `;

        }

    }

}


// ===============================
// ADD TO CART
// ===============================


function addToCart(productId) {

    let cart = getCart(); // Use unified function
    const item =
        allProducts.find(
            p =>
            String(p._id || p.id)
            ===
            String(productId)
        );


    if(!item) return;



    const imageList =
        Array.isArray(item.images)
        &&
        item.images.length > 0

        ?
        item.images

        :

        (
            item.imageUrl
            ?
            [item.imageUrl]
            :
            []
        );



    const safeImgUrl =
        imageList.length > 0
        ?
        resolveImageUrl(imageList[0])
        :
        '';




    let existing = 
        cart.find(
            cartItem =>
            String(cartItem.id)
            ===
            String(productId)
        );



    if(existing) {

        existing.quantity = 
        (existing.quantity || 1) + 1;


    }


    else {


        cart.push({

            id:
            item._id || item.id,

            name:
            item.name,

            price:
            Number(item.price),

            image:
            safeImgUrl,
            
            quantity:1

        });


    }

    saveCart(cart);
    showNotification(`✅ ${item.name} added to cart!`);
}


// ===============================
// DISPLAY PRODUCTS
// AMAZON / OWN PRODUCT FIX
// ===============================


function displayProducts(items) {


    const productGrid =
        document.getElementById('productGrid');


    if(!productGrid) return;



    productGrid.innerHTML = '';

    updateResultCount(items.length);



    if(!items || items.length === 0) {


        productGrid.innerHTML =
        `
        <p style="text-align:center;padding:30px;">
        No products found.
        </p>
        `;


        return;

    }




    items.forEach(p => {



        const imageList =
        (
            p.images
            &&
            p.images.length > 0
        )

        ?

        p.images

        :

        (
            p.imageUrl
            ?
            [p.imageUrl]
            :
            []
        );



        const imageUrl =
        imageList.length > 0

        ?

        resolveImageUrl(imageList[0])

        :

        'https://via.placeholder.com/250';



        const prodId =
        p._id || p.id;



        const productType =
        p.producttype || p.productType;



        const affiliateLink =
        p.affiliatelink || p.affiliateLink;




        const desc =
        p.description
        ?
        String(p.description)
        :
        '';



        const shortDesc =
        desc.length > 0
        ?
        desc.substring(0,70) + '...'
        :
        'Trusted product from CartFox';



        const rating =
        p.rating
        ?
        `<div class="rating">⭐ ${parseFloat(p.rating).toFixed(1)}</div>`
        :
        '';





        let actionButton;



        // AMAZON PRODUCT

        if(productType === 'amazon' && affiliateLink) {


            actionButton =
            `
            <a 
            href="${affiliateLink}"
            target="_blank"
            class="buy-btn"
            style="
            background:#FF9900;
            color:white;
            display:block;
            text-align:center;
            padding:8px;
            border-radius:4px;
            text-decoration:none;
            font-weight:bold;
            margin-top:10px;
            "
            >
            Buy on Amazon
            </a>
            `;


        }



        // OWN PRODUCT

        else {


            actionButton =
            `
            <button
            class="buy-btn"
            onclick="addToCart('${prodId}')"
            style="
            background:#3498DB;
            color:white;
            width:100%;
            padding:8px;
            border:none;
            border-radius:4px;
            cursor:pointer;
            font-weight:bold;
            margin-top:10px;
            "
            >
            Add to Cart
            </button>
            `;


        }




        const card =
        document.createElement('div');

        card.className =
        'product-card';



        card.innerHTML =
        `

        <img 
        src="${imageUrl}"
        alt="${p.name}"
        style="
        width:100%;
        height:160px;
        object-fit:contain;
        background:#fff;
        ">


        <div class="product-card-body"
        style="padding:15px;">


        <h3 style="font-size:16px;">
        ${p.name}
        </h3>


        <p style="color:#666;font-size:13px;">
        ${shortDesc}
        </p>



        <div style="
        display:flex;
        justify-content:space-between;
        ">


        <div class="price"
        style="
        font-weight:bold;
        color:#3498DB;
        ">
        ₹${Number(p.price).toLocaleString('en-IN')}
        </div>


        ${rating}


        </div>



        ${actionButton}


        </div>

        `;



        productGrid.appendChild(card);



    });


}

// ===============================
// HOMEPAGE FEATURED PRODUCTS
// ===============================
function renderHomepageProducts(products) {
    const grid = document.getElementById('featuredProducts');
    if (!grid) return; // Only run on homepage

    // Get latest 6 products
    const productsToDisplay = [...products].reverse().slice(0, 6);
    
    grid.innerHTML = '';

    if(productsToDisplay.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px;"><h3>No products available yet.</h3></div>';
        return;
    }

    productsToDisplay.forEach(product => {
        const imageList = (product.images && product.images.length > 0) ? product.images : (product.imageUrl ? [product.imageUrl] : []);
        // Use the canonical resolveImageUrl function
        const safeImgUrl = imageList.length > 0 ? resolveImageUrl(imageList[0]) : 'https://via.placeholder.com/250';

        const imageHtml = `<img src="${safeImgUrl}" alt="${product.name}" style="width:100%; height:180px; object-fit:contain;" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=CartFox';">`;

        let actionButtonHtml = '';
        const prodId = product.id || product._id;
        const productType = String(product.productType || product.producttype || '').trim().toLowerCase();
        const affiliateLink = product.affiliateLink || product.affiliatelink;

        if (productType === 'amazon' && affiliateLink) {
            actionButtonHtml = `<a href="${affiliateLink}" target="_blank" class="btn-buy-amazon">🛒 Buy on Amazon</a>`;
        } else {
            // Use the canonical addToCart(productId) from script.js
            actionButtonHtml = `<button class="btn-add-cart" onclick="addToCart('${prodId}'); event.preventDefault();">Add to Cart</button>`;
        }

        const detailUrl = `product.html?id=${prodId}`;
        const randomReviews = product.reviews || Math.floor(Math.random() * 200 + 50);
        const rating = product.rating || 4.5;

        const card = document.createElement('div');
        card.className = 'product-card slide-up'; // Using a class for potential animation
        card.innerHTML = `
            <a href="${detailUrl}" style="text-decoration: none; color: inherit; display: block;">
              <div class="product-image" style="background: white; padding: 10px; border-bottom:1px solid #eee;">${imageHtml}</div>
            </a>
            <div class="product-info" style="padding: 15px;">
              <a href="${detailUrl}" style="text-decoration: none; color: inherit;">
                <div class="product-name" style="font-weight:bold; font-size:16px; margin-bottom:5px;">${product.name}</div>
              </a>
              <div class="product-price" style="color: var(--primary-color, #3498DB); font-size:18px; font-weight:bold; margin-bottom:5px;">₹${Number(product.price).toLocaleString('en-IN')}</div>
              <div class="product-rating" style="font-size:12px; color:#777;">⭐ ${rating} (${randomReviews} reviews)</div>
              ${actionButtonHtml}
            </div>
          `;
        grid.appendChild(card);
    });
}



// ===============================
// RESULT COUNT
// ===============================


function updateResultCount(count) {

    const resultCount =
    document.getElementById('resultCount');


    if(!resultCount) return;


    resultCount.textContent =
    `${count} product${count === 1 ? '' : 's'} available`;

}



// ===============================
// CATEGORY
// ===============================


function renderCategoryCards() {


    const categoryList =
    document.getElementById('categoryList');


    if(!categoryList || !allProducts) return;



    const categories =
    [
        ...new Set(
            allProducts.map(
                p=>p.category || 'Other'
            )
        )
    ];



    categoryList.innerHTML =
    categories.map(category=>{


        const count =
        allProducts.filter(
            p=>
            String(p.category || '')
            .toLowerCase()
            ===
            String(category)
            .toLowerCase()
        ).length;



        return `

        <div
        class="category-card"
        onclick="filterCategory('${category}')">

        <h4>${category}</h4>

        <p>
        ${count} products
        </p>

        </div>

        `;


    }).join('');

}



// ===============================
// SEARCH + FILTER
// ===============================


function getFilteredItems(){

    let items =
    [...allProducts];



    if(currentFilter !== 'All'){

        items =
        items.filter(
            p=>
            String(p.category || '')
            .toLowerCase()
            ===
            String(currentFilter)
            .toLowerCase()
        );

    }



    if(currentSearch){


        const query =
        currentSearch.toLowerCase();



        items =
        items.filter(p=>{


            return [

                p.name,
                p.category,
                p.description

            ]

            .map(v=>String(v || '').toLowerCase())

            .some(
                value=>value.includes(query)
            );


        });


    }



    return items;

}



function sortAndRender(){


    let items =
    getFilteredItems();



    displayProducts(items);


}



function filterCategory(categoryName){

    currentFilter =
    categoryName;


    sortAndRender();

}



function performSearch(query){

    currentSearch =
    query;


    if(searchBox){

        searchBox.value =
        query;

    }


    sortAndRender();

}




function applySearchFromUrl(){


    const params =
    new URLSearchParams(
        window.location.search
    );


    const query =
    params.get('search');



    if(query){

        performSearch(query);

    }


}




function initSearch(){


    if(!searchBox) return;



    searchBox.addEventListener(
        'input',
        function(){

            performSearch(
                this.value.trim()
            );

        }
    );


}



// ===============================
// NEWSLETTER
// ===============================


function initNewsletter(){

    const newsletterForm =
    document.getElementById('newsletterForm');


    if(!newsletterForm) return;



    newsletterForm.addEventListener(
        'submit',
        function(e){


            e.preventDefault();


            showToast(
                'Subscribed Successfully!'
            );


        }
    );

}


// ==========================================
// UNIFIED CART & NOTIFICATION FUNCTIONS
// (Moved here to be canonical and used across all frontend JS files)
// ==========================================

function getCart() {
    try {
        // Support both old 'cart' and new 'cartfox_cart' keys for compatibility
        return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || JSON.parse(localStorage.getItem('cart')) || [];
    } catch (error) {
        console.warn('Cart storage unavailable, resetting cart.', error);
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function updateCartCount() {
    const countEl = document.getElementById('cartCount');
    if (!countEl) return;
    let cart = getCart();
    let totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    countEl.textContent = totalItems;
}

function showNotification(message, type = 'success') {
    const alert = document.createElement('div');
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '70px'; // Adjusted for better visibility
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.style.padding = '12px 20px';
    alert.style.borderRadius = '5px';
    alert.style.color = 'white';
    alert.style.fontWeight = 'bold';
    alert.style.backgroundColor = type === 'error' ? '#E74C3C' : '#28A745';
    alert.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    alert.style.transition = 'opacity 0.3s ease'; // Added transition

    document.body.appendChild(alert);

    setTimeout(() => {
        alert.style.opacity = '0'; // Fade out
        setTimeout(() => alert.remove(), 300); // Remove after fade
    }, 3000);
}

function goToCart() {
    window.location.href = 'cart.html';
}

// Ensure cartItems is initialized using the unified getCart function
let cartItems = getCart();

// Initial cart display update on script load
updateCartCount();