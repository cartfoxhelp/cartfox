// ==========================================
// CARTFOX - SHOPPING CART LOGIC (NO EXTRA CHARGES)
// ==========================================
// CART_STORAGE_KEY and cart functions are now defined in script.js and used globally

// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

// Load Cart Data
function loadCart() {
  // Support both old 'cart' and new 'cartfox_cart' keys for compatibility
  let cart = getCart();
  const emptyMessage = document.getElementById('emptyCartMessage');
  const cartContent = document.getElementById('cartContent');
  const cartItemsList = document.getElementById('cartItemsList');
  
  updateCartCount(); // Use unified function

  if (cart.length === 0) {
    if(emptyMessage) emptyMessage.style.display = 'block';
    if(cartContent) cartContent.style.display = 'none';
    return;
  }

  if(emptyMessage) emptyMessage.style.display = 'none';
  if(cartContent) cartContent.style.display = 'block';
  if(cartItemsList) cartItemsList.innerHTML = '';

  cart.forEach((item, index) => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    
    // Handle image rendering safely
    let imageDisplay = '📦';
    if(item.image) {
        imageDisplay = `<img src="${item.image}" alt="${item.name}" style="width:50px; height:50px; object-fit:contain;">`;
    }

    cartItem.innerHTML = `
      <div class="cart-item-image" style="display:flex; align-items:center; justify-content:center;">${imageDisplay}</div>
      <div class="cart-item-details">
        <div class="cart-item-name" style="font-weight:bold;">${item.name}</div>
        <div class="cart-item-price" style="color:var(--primary-color);">₹${item.price.toLocaleString('en-IN')}</div>
        <div class="quantity-control" style="margin-top:8px; display:flex; gap:10px; align-items:center;">
          <button class="quantity-btn" onclick="updateQuantity(${index}, -1)" style="padding:2px 8px;">−</button>
          <input type="number" class="quantity-input" value="${item.quantity || 1}" min="1" onchange="updateQuantityDirect(${index}, this.value)" style="width:50px; text-align:center;">
          <button class="quantity-btn" onclick="updateQuantity(${index}, 1)" style="padding:2px 8px;">+</button>
          <a class="remove-btn" onclick="removeFromCart(${index})" style="color:red; cursor:pointer; font-size:13px; margin-left:10px;">Remove</a>
        </div>
      </div>
    `;
    cartItemsList.appendChild(cartItem);
  });

  calculateTotal();
}

function updateQuantity(index, change) {
  let cart = getCart();
  if (cart[index]) {
    cart[index].quantity = Math.max(1, (cart[index].quantity || 1) + change);
    saveCart(cart); // Use unified function
    loadCart();
  }
}

function updateQuantityDirect(index, value) {
  let cart = getCart();
  if (cart[index]) {
    cart[index].quantity = Math.max(1, parseInt(value) || 1);
    saveCart(cart); // Use unified function
    loadCart();
  }
}

function removeFromCart(index) {
  let cart = getCart();
  cart.splice(index, 1); // Remove from local cart variable
  saveCart(cart); // Use unified function
  loadCart();
  showNotification('Item removed from cart'); // Use unified function
}

// EXACT TOTAL CALCULATION (No Extra Shipping or Tax Added)
function calculateTotal() {
  let cart = getCart();
  let subtotal = 0;

  cart.forEach(item => {
    subtotal += item.price * (item.quantity || 1);
  });

  // Grand Total is strictly equal to Subtotal (No hidden fees)
  let total = subtotal;

  const subtotalEl = document.getElementById('subtotal');
  const totalEl = document.getElementById('total');

  if(subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('en-IN');
  if(totalEl) totalEl.textContent = total.toLocaleString('en-IN');
}

function applyPromo() {
  const codeElement = document.getElementById('promoCode');
  if(!codeElement) return;
  const code = codeElement.value.toUpperCase();
  
  const validCodes = {
    'SAVE10': 0.10,
    'SAVE20': 0.20,
    'WELCOME': 0.15
  };

  if (validCodes[code]) {
    showNotification(`Promo code applied! ${validCodes[code] * 100}% discount`); // Use unified function
  } else if (code) {
    showNotification('Invalid promo code', 'error');
  }
}

function proceedToCheckout() {
  let cart = getCart();
  if (cart.length > 0) {
    window.location.href = 'checkout.html'; 
  } else {
    showNotification('Your cart is empty!', 'error'); // Use unified function
  }
}

// Mobile menu toggle (moved here for consistency with other files)
if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
});