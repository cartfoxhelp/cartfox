const API_URL = `${API_BASE_URL}/api`; // API_BASE_URL is defined in auth.js, loaded before this script.
const productForm = document.getElementById('productForm');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const productTypeEl = document.getElementById('productType');
const affiliateLinkGroup = document.getElementById('affiliateLinkGroup');
const imageInput = document.getElementById('images');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const productFormSpinner = document.getElementById('productFormSpinner');

// 2FA UI Elements
const twoFaStatusText = document.getElementById('2fa-status-text');
const toggle2faBtn = document.getElementById('toggle-2fa-btn');
const twoFaSetupSection = document.getElementById('2fa-setup-section');
const twoFaDisableSection = document.getElementById('2fa-disable-section');
const twoFaStatusSection = document.getElementById('2fa-status-section');
const qrCodeImg = document.getElementById('2fa-qr-code');
const enable2faVerifyBtn = document.getElementById('enable-2fa-verify-btn');
const cancel2faSetupBtn = document.getElementById('cancel-2fa-setup-btn');
const disable2faConfirmBtn = document.getElementById('disable-2fa-confirm-btn');
const cancel2faDisableBtn = document.getElementById('cancel-2fa-disable-btn');
const verify2faCodeInput = document.getElementById('2fa-verify-code');
const disable2faCodeInput = document.getElementById('2fa-disable-code');
const recoveryCodesModal = document.getElementById('recovery-codes-modal');
const recoveryCodesList = document.getElementById('recovery-codes-list');
const copyRecoveryCodesBtn = document.getElementById('copy-recovery-codes-btn');
const closeRecoveryModalBtn = document.getElementById('close-recovery-modal-btn');

// ==============================
// Event Listeners
// ==============================

function initDashboardPage() {
    // This function is called by auth.js after successful authentication.
    // It fetches all necessary data for the dashboard in one go.
    Promise.all([
        fetchProducts(),
        fetchAdminOrders()
    ]).then(([products, orders]) => {
        // Once all data is fetched, update the UI components that need it.
        updateDashboardStats(products, orders);
        populateOrdersTable(orders);
        populateCustomersTable(orders);
        populateAnalytics(orders);
    }).catch(error => {
        console.error("Dashboard initialization failed:", error);
        // Optionally, show an error message to the user on the dashboard.
    });

    // Also fetch user-specific details
    fetchUserDetails();
}

async function fetchUserDetails() {
    const userEmailEl = document.getElementById('adminUserEmail');
    if (!userEmailEl) return;
    // This function will be defined in auth.js to fetch user details
    const user = await getUserDetails();
    if (user && user.email) userEmailEl.textContent = user.email;
}
// Page Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('pageTitle');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show target section, hide others
            contentSections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.remove('hidden-section');
                } else {
                    section.classList.add('hidden-section');
                }
            });

            // Update page title
            pageTitle.innerHTML = link.innerHTML;

            // Fetch data for the section if it's being shown for the first time or needs refresh
            if (targetId === 'audit-log') {
                fetchAuditLogs(); // This needs its own fetch as it's a separate concern.
            }
            // Other sections are populated by initDashboardPage on load,
            // so no need to re-fetch on every navigation click unless data needs to be live.
            // For this project, a single load on dashboard entry is sufficient.
        });
    });
});

productTypeEl.addEventListener('change', toggleAffiliateLinkGroup);
imageInput.addEventListener('change', handleImagePreview);
cancelEditBtn.addEventListener('click', (event) => {
    event.preventDefault();
    resetForm();
    toggleAffiliateLinkGroup(); // Ensure correct fields are shown after cancel
});

// ==============================
// Product Form Logic
// ==============================
function toggleAffiliateLinkGroup() {
    const stockGroup = document.getElementById('stockGroup');
    const stockInput = document.getElementById('stock');
    const affiliateLinkInput = document.getElementById('affiliateLink');
    
    if (productTypeEl.value === 'amazon') {
        affiliateLinkGroup.hidden = false;
        affiliateLinkGroup.classList.remove('hidden');
        affiliateLinkInput.setAttribute('required', 'true');
        
        stockGroup.hidden = true; // Hide stock for Amazon
        stockInput.removeAttribute('required');
    } else {
        affiliateLinkGroup.hidden = true;
        affiliateLinkGroup.classList.add('hidden');
        affiliateLinkInput.removeAttribute('required');

        stockGroup.hidden = false; // Show stock for Own Product
        stockInput.setAttribute('required', 'true');
    }
}

function handleImagePreview() {
    imagePreviewContainer.innerHTML = ''; // Clear previous
    const files = Array.from(imageInput.files).slice(0, 3);

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '5px';
            img.style.border = '1px solid #ddd';
            imagePreviewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

function resetForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    submitBtn.innerText = 'Save Product';
    cancelEditBtn.style.display = 'none';
    imagePreviewContainer.innerHTML = ''; // Clear image previews
    toggleAffiliateLinkGroup();
}

// ==========================================
// 📊 DYNAMIC STATS LOGIC (Now using real API data)
// ==========================================
function updateDashboardStats(products = [], orders = []) {
    document.getElementById('statTotalProducts').innerText = products.length;
    document.getElementById('statOrdersToday').innerText = orders.length; // Assuming all fetched orders are "today" for this scope
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalamount || 0), 0);
    document.getElementById('statMonthlyRevenue').innerText = '₹' + totalRevenue.toLocaleString('en-IN');
}

// ==========================================
// 📦 LOAD INVENTORY FROM BACKEND API
// ==========================================
async function fetchProducts() {
    const tbody = document.getElementById('productTableBody');
    try {
        const res = await fetch(`${API_URL}/products`);
        const products = await res.json();

        tbody.innerHTML = '';

        if (products.length === 0) {
             tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">No products found in Database. Add a new product!</td></tr>`;
             return [];
        }

        products.forEach(p => {
            const productType = String(p.producttype || '').trim().toLowerCase();
            
            let stockStatus = '';
            if (productType !== 'amazon') {
                stockStatus = (p.stock > 0)
                    ? `<span style="color:#28A745; font-weight:bold;">Stock:<br>${p.stock}</span>`
                    : `<span style="color:red; font-weight:bold;">Out of Stock</span>`;
            }
            
            // Multiple images handling
            const safeImg = (p.images && p.images.length > 0) ? p.images[0] : 'https://via.placeholder.com/80?text=No+Image';

            let linkButton = '';
            if (productType === 'amazon' && p.affiliatelink) {
                linkButton = `<button onclick="window.open('${p.affiliatelink}', '_blank')" style="background: #FF6B6B; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 13px; font-weight: bold; width: 100%;">Link</button>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td><img src="${safeImg}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;"></td>
                    <td>
                        <strong style="color: #333; font-size: 15px;">${p.name}</strong><br>
                        <small style="color: #777;">${p.category}</small>
                    </td>
                    <td>
                        <span style="color: #333; font-size: 14px;">
                            ${
                                productType === 'amazon' ? 'Amazon' : 'Own Brand'
                            }
                        </span>
                    </td>
                    <td>
                        <strong>₹${p.price}</strong><br><small>${stockStatus}</small>
                    </td>
                    <td>
                        <!-- Stacked Buttons matching Screenshot -->
                        <div style="display: flex; flex-direction: column; gap: 3px; width: 70px;">
                            <button onclick="editProduct('${p.id || p._id}')" style="background: #3498DB; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 13px; font-weight: bold;">Edit</button>
                            <button onclick="deleteProduct('${p.id || p._id}')" style="background: #FF6B6B; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 13px; font-weight: bold;">Delete</button>
                            ${linkButton}
                        </div>
                    </td>
                </tr>`;
        });
        return products;
    } catch (error) {
        console.error('Error loading table:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: red;">Could not load products.</td></tr>`;
        return []; // Return empty array on failure
    }
}

// ==========================================
// ✏️ EDIT PRODUCT (FETCH FROM API)
// ==========================================
window.editProduct = async function(id) {
    try {
        const res = await fetch(`${API_URL}/products/${id}`);
        if (!res.ok) throw new Error('Product not found');
        const p = await res.json();

        document.getElementById('productId').value = p.id;
        productTypeEl.value = p.producttype;
        document.getElementById('category').value = p.category;
        document.getElementById('name').value = p.name;
        document.getElementById('price').value = p.price;
        document.getElementById('rating').value = p.rating;
        document.getElementById('stock').value = p.stock;
        document.getElementById('affiliateLink').value = p.affiliatelink;
        document.getElementById('description').value = p.description;

        imagePreviewContainer.innerHTML = '';
        if (p.images && p.images.length > 0) {
            p.images.forEach(imgUrl => {
                const img = document.createElement('img');
                img.src = imgUrl; // URL is already absolute from backend
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '5px';
                img.style.border = '1px solid #ddd';
                imagePreviewContainer.appendChild(img);
            });
        }

        toggleAffiliateLinkGroup();
        submitBtn.innerText = 'Update Product';
        cancelEditBtn.style.display = 'inline-flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        alert('Unable to load product data for edit.');
    }
}

// ==========================================
// 💾 SAVE / UPDATE PRODUCT (SEND TO API)
// ==========================================
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('productId').value;
    const method = productId ? 'PUT' : 'POST';
    const url = productId ? `${API_URL}/products/${productId}` : `${API_URL}/products`;

    submitBtn.disabled = true;
    productFormSpinner.classList.remove('hidden');

    const formData = new FormData();
    
    // Conditionally append fields based on product type
    const currentProductType = productTypeEl.value;
    formData.append('producttype', currentProductType);
    formData.append('category', document.getElementById('category').value || 'General');
    formData.append('name', document.getElementById('name').value || '');
    formData.append('price', document.getElementById('price').value || 0);
    formData.append('rating', document.getElementById('rating').value || 0);
    formData.append('description', document.getElementById('description').value || '');

    if (currentProductType === 'amazon') {
        formData.append('affiliatelink', document.getElementById('affiliateLink').value || '');
    } else { // Own Product
        formData.append('stock', document.getElementById('stock').value || 0);
    }
    
    const files = imageInput.files;
    for (let i = 0; i < Math.min(files.length, 3); i++) {
        formData.append('images', files[i]);
    }

    try {
        const token = getToken();
        if (!token) {
            alert('Authentication error. Please log in again.');
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch(url, {
            method,
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            resetForm();
            initDashboardPage(); // Refresh all dashboard data
        } else {
            const error = await response.json();
            alert(`❌ Save failed: ${error.message || 'Please retry.'}`);
        }
    } catch (error) {
        console.error("Product save error:", error);
        alert('⚠️ Server connection issue.');
    } finally {
        submitBtn.disabled = false;
        productFormSpinner.classList.add('hidden');
        submitBtn.innerText = productId ? 'Update Product' : 'Save Product';
    }
});

// ==========================================
// 🗑️ DELETE PRODUCT (API CALL)
// ==========================================
window.deleteProduct = async function(id) {
    if (confirm('Delete this product?')) {
        const token = getToken();
        if (!token) {
            alert('Authentication error. Please log in again.');
            window.location.href = 'login.html';
            return;
        }
        try {
            await fetch(`${API_URL}/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            initDashboardPage(); // Refresh all dashboard data
        } catch (error) {
            alert('⚠️ Delete failed due to server issue.');
        }
    }
}

// ==========================================
// CARTFOX ADMIN - ORDERS, CUSTOMERS & ANALYTICS SYNC
// ==========================================

// Load Orders in Admin Panel
async function fetchAdminOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Failed to fetch orders from API.');
    } catch (error) {
        console.error(error);
        document.getElementById('ordersTableBody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: red;">Could not load orders.</td></tr>`;
        return []; // Return empty array on failure
    }
}

function populateOrdersTable(ordersList = []) {
    const ordersTableBody = document.getElementById('ordersTableBody');
    ordersTableBody.innerHTML = '';

    if (ordersList.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 25px; color: #777;">
                    No recent orders found.
                </td>
            </tr>
        `;
        return;
    }

    ordersList.forEach(order => {
        const orderId = order.orderid || order.id;
        const customerName = order.customername;
        const amount = '₹' + Number(order.totalamount).toLocaleString('en-IN');
        const dateStr = new Date(order.created_at).toLocaleDateString('en-IN');
        const status = order.orderstatus;

        let badgeBg = '#f39c12'; // Processing - Yellow
        if (status === 'Delivered') badgeBg = '#27ae60'; // Green
        if (status === 'Shipped') badgeBg = '#2980b9'; // Blue

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight:bold;">${orderId}</td>
            <td>${customerName}</td>
            <td style="color:var(--primary-color); font-weight:bold;">${amount}</td>
            <td><span style="background: ${badgeBg}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight:bold;">${status}</span></td>
            <td>${dateStr}</td>
            <td>
                <button class="btn-edit" style="background:#3498DB; color:white; padding:5px 12px; border:none; border-radius:4px; cursor:pointer;" onclick="viewOrderDetails('${orderId}')">View</button>
            </td>
        `;
        ordersTableBody.appendChild(row);
    });
}

// Load Customers in Admin Panel (Extracted from Orders)
function populateCustomersTable(ordersList = []) {
    const customersTableBody = document.getElementById('customersTableBody');
    customersTableBody.innerHTML = '';

    if (ordersList.length === 0) {
        customersTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 25px; color: #777;">No customer data available yet.</td></tr>`;
        return;
    }

    // Group orders by email or customer name to create unique customer profiles
    let customersMap = {};
    ordersList.forEach(order => {
        let email = order.customeremail || 'customer@cartfox.com';
        if (!customersMap[email]) {
            customersMap[email] = {
                name: order.customername || 'Customer',
                email: email,
                totalOrders: 0,
                joinedDate: new Date(order.created_at).toLocaleDateString('en-IN')
            };
        }
        customersMap[email].totalOrders += 1;
    });

    let customersArray = Object.values(customersMap);

    customersArray.forEach(cust => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight:bold;">${cust.name}</td>
            <td style="color:#555;">${cust.email}</td>
            <td><span style="background:#e8f4f8; color:#2980b9; padding:3px 10px; border-radius:12px; font-weight:bold;">${cust.totalOrders} Order(s)</span></td>
            <td>${cust.joinedDate}</td>
        `;
        customersTableBody.appendChild(row);
    });
}

// Populate Analytics section
function populateAnalytics(ordersList = []) {
    const totalRevenueEl = document.getElementById('analyticsTotalRevenue');
    const totalOrdersEl = document.getElementById('analyticsTotalOrders');
    const avgOrderValueEl = document.getElementById('analyticsAvgOrderValue');
    const analyticsTableBody = document.getElementById('analyticsTableBody');

    const totalRevenue = ordersList.reduce((sum, order) => sum + parseFloat(order.totalamount || 0), 0);
    const totalOrders = ordersList.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    totalRevenueEl.innerText = '₹' + totalRevenue.toLocaleString('en-IN');
    totalOrdersEl.innerText = totalOrders;
    avgOrderValueEl.innerText = '₹' + avgOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    analyticsTableBody.innerHTML = '';
    if (totalOrders === 0) {
        analyticsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #777;">No sales data to analyze.</td></tr>`;
        return;
    }
    ordersList.slice(0, 10).forEach(order => { // Show recent 10
        analyticsTableBody.innerHTML += `<tr><td>${order.orderid}</td><td>${order.customername}</td><td>${new Date(order.created_at).toLocaleDateString('en-IN')}</td><td>₹${Number(order.totalamount).toLocaleString('en-IN')}</td></tr>`;
    });
}

// ==========================================
// 🔒 TWO-FACTOR AUTHENTICATION (2FA) LOGIC
// ==========================================

async function check2faStatus() {
    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/auth/2fa/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            update2faUI(data.enabled);
        } else {
            twoFaStatusText.textContent = 'Error loading status';
        }
    } catch (error) {
        console.error('Could not check 2FA status:', error);
        twoFaStatusText.textContent = 'Error';
    }
}

function update2faUI(isEnabled) {
    if (isEnabled) {
        twoFaStatusText.textContent = 'Enabled';
        twoFaStatusText.style.color = '#27ae60'; // Green
        toggle2faBtn.textContent = 'Disable 2FA';
        toggle2faBtn.className = 'btn btn-danger';
    } else {
        twoFaStatusText.textContent = 'Disabled';
        twoFaStatusText.style.color = '#e74c3c'; // Red
        toggle2faBtn.textContent = 'Enable 2FA';
        toggle2faBtn.className = 'btn btn-secondary';
    }
    toggle2faBtn.disabled = false;
    // Ensure other sections are hidden
    twoFaSetupSection.classList.add('hidden');
    twoFaDisableSection.classList.add('hidden');
    twoFaStatusSection.classList.remove('hidden');
}

async function handleToggle2fa() {
    const isEnabled = twoFaStatusText.textContent === 'Enabled';
    if (isEnabled) {
        // Show disable confirmation UI
        twoFaStatusSection.classList.add('hidden');
        twoFaDisableSection.classList.remove('hidden');
    } else {
        // Start the enable process by generating a secret
        try {
            toggle2faBtn.disabled = true;
            const token = getToken();
            const response = await fetch(`${API_URL}/auth/2fa/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                qrCodeImg.src = data.qrCodeUrl;
                twoFaStatusSection.classList.add('hidden');
                twoFaSetupSection.classList.remove('hidden');
            } else {
                alert('Error generating QR code: ' + data.message);
            }
        } catch (error) {
            alert('Server error while setting up 2FA.');
        } finally {
            toggle2faBtn.disabled = false;
        }
    }
}

async function handleEnable2fa() {
    const code = verify2faCodeInput.value;
    if (!code || code.length !== 6) {
        alert('Please enter a valid 6-digit code.');
        return;
    }
    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/auth/2fa/enable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ twoFactorCode: code })
        });
        const data = await response.json();
        if (data.success) {
            // Show recovery codes modal
            showRecoveryCodes(data.recoveryCodes);
            verify2faCodeInput.value = '';
            // UI will be refreshed after user closes the modal
        } else {
            alert('Failed to enable 2FA: ' + data.message);
        }
    } catch (error) {
        alert('Server error while enabling 2FA.');
    }
}

function showRecoveryCodes(codes) {
    recoveryCodesList.innerHTML = ''; // Clear previous
    const codeGrid = document.createElement('div');
    codeGrid.style.display = 'grid';
    codeGrid.style.gridTemplateColumns = '1fr 1fr';
    codeGrid.style.gap = '10px';

    codes.forEach(code => {
        const codeEl = document.createElement('div');
        codeEl.textContent = code;
        codeGrid.appendChild(codeEl);
    });
    recoveryCodesList.appendChild(codeGrid);

    recoveryCodesModal.classList.remove('hidden');

    // Store codes temporarily for the copy button
    copyRecoveryCodesBtn.dataset.codes = codes.join('\n');
}

async function handleDisable2fa() {
    const code = disable2faCodeInput.value;
    if (!code || code.length !== 6) {
        alert('Please enter a valid 6-digit code to disable 2FA.');
        return;
    }
    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/auth/2fa/disable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ twoFactorCode: code })
        });
        const data = await response.json();
        if (data.success) {
            alert('2FA has been disabled.');
            disable2faCodeInput.value = '';
            check2faStatus(); // Refresh UI
        } else {
            alert('Failed to disable 2FA: ' + data.message);
        }
    } catch (error) {
        alert('Server error while disabling 2FA.');
    }
}

// Attach event listeners for 2FA functionality
toggle2faBtn.addEventListener('click', handleToggle2fa);
enable2faVerifyBtn.addEventListener('click', handleEnable2fa);
disable2faConfirmBtn.addEventListener('click', handleDisable2fa);
cancel2faSetupBtn.addEventListener('click', () => check2faStatus());
cancel2faDisableBtn.addEventListener('click', () => check2faStatus());

copyRecoveryCodesBtn.addEventListener('click', () => {
    const codesToCopy = copyRecoveryCodesBtn.dataset.codes;
    navigator.clipboard.writeText(codesToCopy).then(() => {
        alert('Recovery codes copied to clipboard!');
    }).catch(err => {
        alert('Could not copy codes. Please copy them manually.');
    });
});

closeRecoveryModalBtn.addEventListener('click', () => {
    recoveryCodesModal.classList.add('hidden');
    check2faStatus(); // Refresh the main 2FA UI now
});

// ==========================================
// 🛡️ AUDIT LOG
// ==========================================
async function fetchAuditLogs() {
    const auditLogTableBody = document.getElementById('auditLogTableBody');
    if (!auditLogTableBody) return;

    auditLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading logs...</td></tr>`;

    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/auth/audit-logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (!data.success || !data.logs) {
            throw new Error(data.message || 'Failed to load logs.');
        }

        if (data.logs.length === 0) {
            auditLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">No security events found.</td></tr>`;
            return;
        }

        auditLogTableBody.innerHTML = ''; // Clear loading message
        data.logs.forEach(log => {
            const row = document.createElement('tr');
            const formattedDate = new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            
            // Make action more readable
            const friendlyAction = log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${log.user_email || 'N/A'}</td>
                <td><span style="font-weight: 600;">${friendlyAction}</span></td>
                <td>${log.ip_address || 'N/A'}</td>
            `;
            auditLogTableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        auditLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: red;">Could not load audit logs.</td></tr>`;
    }
}

// ORDER DETAILS POPUP FUNCTION
// ==========================================
function viewOrderDetails(orderId) {
    // This function is now simplified as we don't have a full order object on the frontend.
    // A full implementation would fetch specific order details from an endpoint like /api/orders/:id
    // and display them in a modal. For now, an alert serves as a placeholder.
    alert(
        `Viewing details for Order ID: ${orderId}\n\n` +
        `(Note: A full details modal requires a dedicated API endpoint to fetch single order data, which is not yet implemented.)`
    );
}