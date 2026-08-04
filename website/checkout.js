// ==========================================
// CARTFOX - PROFESSIONAL CHECKOUT
// ==========================================

const BASE_URL = "https://cartfox-backend.onrender.com";
const API_PAYMENT_URL = `${BASE_URL}/api/payments/order`;
const API_ORDERS_URL = `${BASE_URL}/api/orders`;
// CART_STORAGE_KEY and cart functions are now defined in script.js and used globally

// ==========================================
// INITIAL LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadCheckoutSummary();
});

// ==========================================
// CHECKOUT SUMMARY
// ==========================================

function loadCheckoutSummary() {

    const cart = getCart();

    const list = document.getElementById("checkoutItemsList");

    if (!cart.length) {

        alert("Your cart is empty.");

        window.location.href = "cart.html";

        return;

    }

    list.innerHTML = "";

    let subtotal = 0;

    cart.forEach(item => {

        const qty = item.quantity || 1;

        const total = qty * Number(item.price);

        subtotal += total;

        list.innerHTML += `

        <div style="display:flex;justify-content:space-between;margin-bottom:10px">

            <span>${item.name} × ${qty}</span>

            <strong>₹${total.toLocaleString("en-IN")}</strong>

        </div>

        `;

    });

    document.getElementById("summarySubtotal").textContent =
        subtotal.toLocaleString("en-IN");

    document.getElementById("summaryTotal").textContent =
        subtotal.toLocaleString("en-IN");

}

// ==========================================
// HANDLE CHECKOUT
// ==========================================

async function handleCheckout(event) {

    event.preventDefault();

    const cart = getCart();

    if (!cart.length) {

        alert("Cart is empty.");

        return;

    }

    const totalAmount = cart.reduce((sum, item) => {

        return sum + Number(item.price) * (item.quantity || 1);

    }, 0);

    const amountInPaise = totalAmount * 100;

    try {

        const response = await fetch(API_PAYMENT_URL, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                amount: amountInPaise

            })

        });

        const data = await response.json();

        if (!response.ok || !data.order) {

            throw new Error("Unable to create payment order");

        }

        const options = {

            key: data.key_id,

            amount: data.order.amount,

            currency: data.order.currency,

            name: "CartFox",

            description: "Purchase Order",

            image: "",

            order_id: data.order.id,

            prefill: {

                name: document.getElementById("fullName").value.trim(),

                email: document.getElementById("email").value.trim(),

                contact: document.getElementById("phone").value.trim()

            },

            theme: {

                color: "#2563eb"

            },

            handler: function(response){

                saveOrderToDatabase(

                    cart,

                    totalAmount,

                    response.razorpay_payment_id

                );

            }

        };

        const rzp = new Razorpay(options);

                // Payment Failed Event
        rzp.on("payment.failed", function (response) {

            console.error("Payment Failed:", response.error);

            alert(
                "Payment Failed!\n\n" +
                response.error.description
            );

        });

        // Open Razorpay
        rzp.open();

    } catch (error) {

        console.error("Checkout Error:", error);

        alert("Unable to start payment. Please try again.");

    }

}

// ==========================================
// SAVE ORDER TO DATABASE
// ==========================================

async function saveOrderToDatabase(cart, totalAmount, paymentId) {

    const customerData = {

        customerName: document.getElementById("fullName").value.trim(),

        customerEmail: document.getElementById("email").value.trim(),

        customerPhone: document.getElementById("phone").value.trim(),

        shippingAddress:
            `${document.getElementById("address").value.trim()},
             ${document.getElementById("city").value.trim()} -
             ${document.getElementById("pincode").value.trim()}`,

        items: cart,

        totalAmount,

        paymentId,

        status: "Processing",

        date: new Date().toISOString()

    };

    try {

        const response = await fetch(API_ORDERS_URL, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(customerData)

        });

        if (response.ok || response.status === 201) {

            localStorage.removeItem(CART_STORAGE_KEY);

            localStorage.removeItem("cart");

            alert(
                "🎉 Payment Successful!\n\nPayment ID: " +
                paymentId
            );

            window.location.href = "index.html";

        } else {

            saveOrderLocally(customerData);

        }

    } catch (error) {

        console.warn(error);

        saveOrderLocally(customerData);

    }

}

// ==========================================
// LOCAL BACKUP
// ==========================================

function saveOrderLocally(orderData) {

    orderData.id =
        "ORD-" +
        Math.floor(100000 + Math.random() * 900000);

    let orders =
        JSON.parse(localStorage.getItem("cartfox_orders")) || [];

    orders.unshift(orderData);

    localStorage.setItem(
        "cartfox_orders",
        JSON.stringify(orders)
    );

    localStorage.removeItem(CART_STORAGE_KEY);

    localStorage.removeItem("cart");

    alert(
        "Payment Successful!\n\nOrder ID: " +
        orderData.id
    );

    window.location.href = "index.html";

}

// Initial cart count update on script load
document.addEventListener("DOMContentLoaded", () => {
    updateCartCount(); // Use unified function
});