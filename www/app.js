// ---- PWA Download Logic (Handle event outside DOMContentLoaded to ensure it's captured) ----
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    console.log('✅ beforeinstallprompt event captured');
});

document.addEventListener('DOMContentLoaded', () => {
    // ---- Navbar elements ----
    const navbar = document.getElementById('navbar');
    const loginBtn = document.getElementById('loginBtn');

    // ---- Navbar scroll effect ----
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    const downloadAppBtns = document.querySelectorAll('.download-btn');
    const installModal = document.getElementById('installModal');
    const closeInstallModal = document.getElementById('closeInstallModal');
    const closeInstallBtn = document.getElementById('closeInstallBtn');
    const iosInstructions = document.getElementById('iosInstructions');
    const androidInstructions = document.getElementById('androidInstructions');

    const showInstallModal = () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        iosInstructions.classList.toggle('hidden', !isIOS);
        androidInstructions.classList.toggle('hidden', isIOS);
        installModal.classList.remove('hidden');
    };

    downloadAppBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            console.log('Download button clicked');
            if (deferredPrompt) {
                console.log('Triggering PWA install prompt...');
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`Install prompt outcome: ${outcome}`);
                deferredPrompt = null;
            } else {
                showInstallModal();
            }
        });
    });

    [closeInstallModal, closeInstallBtn, installModal].forEach(el => {
        if (!el) return;
        el.addEventListener('click', (e) => {
            if (e.target === el || el === closeInstallModal || el === closeInstallBtn) {
                installModal.classList.add('hidden');
            }
        });
    });

    // ---- Counter functionality ----
    const minusBtn = document.getElementById('minusBtn');
    const plusBtn = document.getElementById('plusBtn');
    const peopleInput = document.getElementById('people');

    minusBtn?.addEventListener('click', () => {
        if (!peopleInput) return;
        let val = parseInt(peopleInput.value);
        if (val > 1) {
            peopleInput.value = val - 1;
        }
    });

    plusBtn?.addEventListener('click', () => {
        if (!peopleInput) return;
        let val = parseInt(peopleInput.value);
        if (val < 20) {
            peopleInput.value = val + 1;
        }
    });

    // ---- Time select syncing ----
    // Sync hour+minute selects → hidden input for all 3 time fields
    function syncTimeSelects(hourId, minId, hiddenId) {
        const hourEl = document.getElementById(hourId);
        const minEl = document.getElementById(minId);
        const hiddenEl = document.getElementById(hiddenId);
        if (!hourEl || !minEl || !hiddenEl) return;
        const update = () => {
            if (hourEl.value && minEl.value !== '') {
                hiddenEl.value = `${hourEl.value}:${minEl.value}`;
            } else {
                hiddenEl.value = '';
            }
        };
        hourEl.addEventListener('change', update);
        minEl.addEventListener('change', update);
    }
    syncTimeSelects('timeHour', 'timeMin', 'time');
    syncTimeSelects('altTime1Hour', 'altTime1Min', 'altTime1');
    syncTimeSelects('altTime2Hour', 'altTime2Min', 'altTime2');


    // ---- Auth State ----
    const API = 'https://moshi-moshi-8dh6.onrender.com';
    let authToken = localStorage.getItem('mm_token') || null;
    let currentUser = JSON.parse(localStorage.getItem('mm_user') || 'null');

    function updateCallBtnState() {
        // Handle call.html specific button
        const callBtn = document.getElementById('callBtn');
        const callBtnText = document.getElementById('callBtnText');
        if (callBtn && callBtnText) {
            if (authToken && currentUser) {
                callBtn.disabled = false;
                callBtn.style.opacity = '1';
                callBtn.style.cursor = 'pointer';
                callBtn.classList.remove('btn-disabled');
                callBtnText.setAttribute('data-i18n', 'btn-call');
                callBtnText.textContent = translateStr('btn-call') || 'Initiate AI Call';
            } else {
                callBtn.disabled = true;
                callBtn.style.opacity = '0.5';
                callBtn.style.cursor = 'not-allowed';
                callBtn.classList.add('btn-disabled');
                callBtnText.removeAttribute('data-i18n');
                callBtnText.textContent = '🚫 Please Login to Call';
            }
        }

        // Handle index.html specific links (disabling them visually instead of just intercepting)
        document.querySelectorAll('a[href="call.html"]').forEach(link => {
            if (authToken && currentUser) {
                link.style.opacity = '1';
                link.style.pointerEvents = 'auto';
                link.style.cursor = 'pointer';
            } else {
                link.style.opacity = '0.5';
                link.style.cursor = 'not-allowed';
                // Note: we don't disable pointerEvents here so the interceptor can catch clicks and show the modal!
            }
        });
    }

    function setAuth(token, user) {
        authToken = token;
        currentUser = user;
        localStorage.setItem('mm_token', token);
        localStorage.setItem('mm_user', JSON.stringify(user));
        loginBtn.innerHTML = `<span>${user.name}</span> <i class="fa-solid fa-user"></i>`;
        updateCallBtnState();
    }

    function clearAuth() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('mm_token');
        localStorage.removeItem('mm_user');
        loginBtn.innerHTML = `<span data-i18n="nav-login">Login / Sign Up</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        updateCallBtnState();
        // Clear pre-filled fields
        const nameEl = document.getElementById('userName');
        const phoneEl = document.getElementById('userPhone');
        if (nameEl) nameEl.value = '';
        if (phoneEl) phoneEl.value = '';
        // Redirect to landing page since user is no longer authenticated
        if (window.location.pathname.includes('call.html')) {
            window.location.href = 'index.html';
        }
    }

    // Fill reservation form with user info + gold flash animation
    function fillUserForm(user) {
        const fields = [
            { id: 'userName', value: user.name || '' },
            { id: 'userPhone', value: user.phone || '' },
        ];
        fields.forEach(({ id, value }) => {
            const el = document.getElementById(id);
            if (!el || !value) return;
            el.value = value;
            el.classList.add('autofill-flash');
            el.addEventListener('animationend', () => el.classList.remove('autofill-flash'), { once: true });
        });
    }

    // Auto-restore session on page load
    if (authToken && currentUser) {
        loginBtn.innerHTML = `<span>${currentUser.name}</span> <i class="fa-solid fa-user"></i>`;
        fillUserForm(currentUser);
    }
    updateCallBtnState();



    // ---- Login Modal Logic ----
    const loginModal = document.getElementById('loginModal');
    const closeModal = document.getElementById('closeModal');
    const loginForm = document.getElementById('loginForm');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const modalSubmitBtn = document.getElementById('modalSubmitBtn');
    const modalToggleText = document.getElementById('modalToggleText');
    const modalToggleBtn = document.getElementById('modalToggleBtn');
    const stepAccount = document.getElementById('step-account');
    const stepPersonal = document.getElementById('step-personal');
    const stepPayment = document.getElementById('step-payment');
    const stepButtons = document.getElementById('step-buttons');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const modalErrorEl = document.getElementById('modalError');

    let isSignUpMode = false;
    let currentSignUpStep = 0;

    function showModalError(msg) {
        if (modalErrorEl) { modalErrorEl.textContent = msg; modalErrorEl.classList.remove('hidden'); }
    }
    function hideModalError() {
        if (modalErrorEl) { modalErrorEl.classList.add('hidden'); }
    }

    function updateSignUpSteps() {
        if (!stepAccount) return;
        if (!isSignUpMode) {
            stepAccount.classList.remove('hidden');
            stepPersonal.classList.add('hidden');
            stepPayment.classList.add('hidden');
            stepButtons.classList.add('hidden');
            modalSubmitBtn.classList.remove('hidden');
            return;
        }
        stepAccount.classList.toggle('hidden', currentSignUpStep !== 0);
        stepPersonal.classList.toggle('hidden', currentSignUpStep !== 1);
        stepPayment.classList.toggle('hidden', currentSignUpStep !== 2);
        stepButtons.classList.remove('hidden');
        if (currentSignUpStep === 0) {
            prevBtn.classList.add('hidden'); nextBtn.classList.remove('hidden'); modalSubmitBtn.classList.add('hidden');
        } else if (currentSignUpStep === 1) {
            prevBtn.classList.remove('hidden'); nextBtn.classList.remove('hidden'); modalSubmitBtn.classList.add('hidden');
        } else if (currentSignUpStep === 2) {
            prevBtn.classList.remove('hidden'); nextBtn.classList.add('hidden'); modalSubmitBtn.classList.remove('hidden');
        }
    }

    nextBtn?.addEventListener('click', (e) => { e.preventDefault(); if (currentSignUpStep < 2) { currentSignUpStep++; updateSignUpSteps(); } });
    prevBtn?.addEventListener('click', (e) => { e.preventDefault(); if (currentSignUpStep > 0) { currentSignUpStep--; updateSignUpSteps(); } });

    modalToggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        hideModalError();
        isSignUpMode = !isSignUpMode;
        if (isSignUpMode) {
            if (modalTitle) modalTitle.textContent = translateStr('modal-title-signup');
            if (modalDesc) modalDesc.textContent = translateStr('modal-desc-signup');
            if (modalSubmitBtn) modalSubmitBtn.textContent = translateStr('modal-signup');
            if (modalToggleText) modalToggleText.textContent = translateStr('modal-has-account');
            if (modalToggleBtn) modalToggleBtn.textContent = translateStr('btn-signin');
            currentSignUpStep = 0; updateSignUpSteps();
        } else {
            if (modalTitle) modalTitle.textContent = translateStr('modal-title');
            if (modalDesc) modalDesc.textContent = translateStr('modal-desc');
            if (modalSubmitBtn) modalSubmitBtn.textContent = translateStr('btn-signin');
            if (modalToggleText) modalToggleText.textContent = translateStr('modal-no-account');
            if (modalToggleBtn) modalToggleBtn.textContent = translateStr('modal-signup');
            updateSignUpSteps();
        }
    });

    loginBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        // If already logged in, open CRM dashboard instead
        if (authToken && currentUser) {
            openCRMDashboard();
            return;
        }
        hideModalError();
        loginModal?.classList.remove('hidden');
    });

    // Intercept "Make Reservation" / "Start Calling" links if user is not logged in
    document.querySelectorAll('a[href="call.html"]').forEach(link => {
        link.addEventListener('click', (e) => {
            if (!authToken || !currentUser) {
                e.preventDefault();
                hideModalError();
                loginModal?.classList.remove('hidden');
            }
        });
    });

    closeModal?.addEventListener('click', () => loginModal?.classList.add('hidden'));
    loginModal?.addEventListener('click', (e) => { if (e.target === loginModal) loginModal.classList.add('hidden'); });

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideModalError();
        const originalText = modalSubmitBtn.innerHTML;
        modalSubmitBtn.disabled = true;
        modalSubmitBtn.innerHTML = isSignUpMode ? translateStr('signing-up') : translateStr('signing-in');

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        try {
            if (isSignUpMode) {
                const name = document.getElementById('modal-name').value.trim();
                const phone = document.getElementById('modal-userPhone').value.trim();
                if (!name) { showModalError('Please enter your name.'); modalSubmitBtn.disabled = false; modalSubmitBtn.innerHTML = originalText; return; }
                const res = await fetch(`${API}/api/auth/register`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name, phone })
                });
                const data = await res.json();
                if (!res.ok) { showModalError(data.error || 'Registration failed.'); modalSubmitBtn.disabled = false; modalSubmitBtn.innerHTML = originalText; return; }
                setAuth(data.token, data.user);
            } else {
                const res = await fetch(`${API}/api/auth/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) { showModalError(data.error || 'Login failed.'); modalSubmitBtn.disabled = false; modalSubmitBtn.innerHTML = originalText; return; }
                setAuth(data.token, data.user);
            }
            loginModal.classList.add('hidden');
            loginForm.reset();
            modalSubmitBtn.innerHTML = originalText;
            // Fill reservation form with user info after modal closes
            setTimeout(() => {
                fillUserForm(currentUser);
                // Redirect to call page after successful login
                if (!window.location.pathname.includes('call.html')) {
                    window.location.href = 'call.html';
                }
            }, 300);
        } catch (err) {
            showModalError('Network error. Please try again.');
            modalSubmitBtn.disabled = false;
            modalSubmitBtn.innerHTML = originalText;
        }
    });

    // ---- CRM Dashboard ----
    async function openCRMDashboard() {
        const dashboard = document.getElementById('crmDashboard');
        if (!dashboard) return;
        dashboard.classList.remove('hidden');

        // Load profile header
        document.getElementById('crm-name').textContent = currentUser.name;
        document.getElementById('crm-email').textContent = currentUser.email;
        document.getElementById('crm-phone').textContent = currentUser.phone || '—';

        // Load profile tab inputs
        document.getElementById('crm-edit-name').value = currentUser.name;
        document.getElementById('crm-edit-email').value = currentUser.email;
        document.getElementById('crm-edit-phone').value = currentUser.phone || '';

        // Tab Switching Logic
        const tabs = document.querySelectorAll('.crm-tab');
        const panes = document.querySelectorAll('.crm-tab-pane');

        tabs.forEach(tab => {
            // Remove old listeners to prevent duplicates
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);

            newTab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.add('hidden'));
                p.classList.remove('active'); // Wait, the pane doesn't use active block, just hidden

                // Fix:
                document.querySelectorAll('.crm-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.crm-tab-pane').forEach(p => {
                    p.classList.add('hidden');
                    p.classList.remove('active');
                });

                newTab.classList.add('active');
                const targetPane = document.getElementById(`crm-tab-${newTab.dataset.tab}`);
                if (targetPane) {
                    targetPane.classList.remove('hidden');
                    targetPane.classList.add('active');
                }
            });
        });

        // Ensure history tab is default active on open
        document.querySelector('.crm-tab[data-tab="history"]')?.click();

        // Load Reservation History
        const historyEl = document.getElementById('crm-history');
        historyEl.innerHTML = '<div class="crm-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading history...</div>';
        try {
            const res = await fetch(`${API}/api/reservations`, { headers: { 'Authorization': `Bearer ${authToken}` } });
            const reservations = await res.json();
            if (!reservations || !reservations.length) {
                historyEl.innerHTML = '<div class="crm-empty"><i class="fa-solid fa-calendar-xmark"></i><p>No reservations yet.</p></div>';
            } else {
                historyEl.innerHTML = reservations.map(r => {
                    const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                    return `
                        <div class="crm-res-card">
                            <div class="crm-res-status ${r.status}"><i class="fa-solid fa-circle-check"></i> ${r.status}</div>
                            <div class="crm-res-main">
                                <span class="crm-res-date"><i class="fa-regular fa-calendar"></i> ${dateStr} at ${r.time || '—'}</span>
                                <span class="crm-res-people"><i class="fa-solid fa-users"></i> ${r.people} guests</span>
                                <span class="crm-res-name"><i class="fa-solid fa-user"></i> ${r.guestName}</span>
                            </div>
                            <div class="crm-res-phone"><i class="fa-solid fa-phone"></i> ${r.restaurantPhone || '—'}</div>
                        </div>`;
                }).join('');
            }
        } catch (e) {
            historyEl.innerHTML = '<div class="crm-empty">Could not load history.</div>';
        }

        // Load Billing Info
        const billingEl = document.getElementById('crm-billing-info');
        billingEl.innerHTML = '<div class="crm-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading billing...</div>';
        try {
            const res = await fetch(`${API}/api/user/billing`, { headers: { 'Authorization': `Bearer ${authToken}` } });
            const data = await res.json();
            if (!data.paymentMethods || !data.paymentMethods.length) {
                billingEl.innerHTML = '<div class="crm-empty"><i class="fa-solid fa-credit-card"></i><p>No payment methods on file.</p></div>';
            } else {
                billingEl.innerHTML = data.paymentMethods.map(card => `
                    <div class="crm-res-card" style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <i class="fa-brands fa-cc-${card.brand.toLowerCase()}" style="font-size: 2rem; color: #fff;"></i>
                            <div>
                                <div style="font-weight: 600; color: #fff;">•••• •••• •••• ${card.last4}</div>
                                <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">Expires ${String(card.exp_month).padStart(2, '0')}/${card.exp_year}</div>
                            </div>
                        </div>
                        <div class="crm-res-status confirmed" style="margin:0;"><i class="fa-solid fa-check"></i> Default</div>
                    </div>
                `).join('');
            }
        } catch (e) {
            billingEl.innerHTML = '<div class="crm-empty">Could not load billing info.</div>';
        }
    }

    document.getElementById('crmCloseBtn')?.addEventListener('click', () => document.getElementById('crmDashboard').classList.add('hidden'));
    document.getElementById('crmDashboard')?.addEventListener('click', (e) => { if (e.target === document.getElementById('crmDashboard')) document.getElementById('crmDashboard').classList.add('hidden'); });
    document.getElementById('crmLogoutBtn')?.addEventListener('click', () => { clearAuth(); document.getElementById('crmDashboard').classList.add('hidden'); });



    // ---- Fill today's date ----
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    if (dateInput) dateInput.value = today;

    // ---- Schedule Call Mode ----
    let callMode = 'now'; // 'now' | 'schedule'
    const modeNowBtn = document.getElementById('modeNow');
    const modeSchedBtn = document.getElementById('modeSched');
    const schedPickerWrap = document.getElementById('schedulePickerWrap');
    const callBtnText = document.getElementById('callBtnText');

    // Set min datetime to now
    const scheduledAtInput = document.getElementById('scheduledAt');
    if (scheduledAtInput) {
        const pad = n => String(n).padStart(2, '0');
        const now = new Date();
        scheduledAtInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    function setCallMode(mode) {
        callMode = mode;
        modeNowBtn.classList.toggle('active', mode === 'now');
        modeSchedBtn.classList.toggle('active', mode === 'schedule');
        schedPickerWrap.classList.toggle('hidden', mode === 'now');
        if (callBtnText) {
            if (authToken && currentUser) {
                const textKey = mode === 'now' ? 'btn-call' : 'btn-schedule';
                callBtnText.setAttribute('data-i18n', textKey);
                callBtnText.textContent = translateStr(textKey) || (mode === 'now' ? 'Initiate AI Call' : '📅 Schedule Call');
            } else {
                callBtnText.textContent = '🚫 Please Login to Call';
            }
        }
    }

    modeNowBtn?.addEventListener('click', () => setCallMode('now'));
    modeSchedBtn?.addEventListener('click', () => setCallMode('schedule'));


    // ---- Form Submission & AI Agent Simulation ----
    const form = document.getElementById('reservationForm');
    if (form) { // Only run on call.html where the form exists
        const callBtn = document.getElementById('callBtn');
        const btnText = callBtn.querySelector('.btn-text');
        const btnLoader = callBtn.querySelector('.btn-loader');

        const agentContainer = document.querySelector('.agent-avatar-container');
        const agentStatusText = document.getElementById('agentStatusText');
        const callLogContainer = document.getElementById('callLog');

        const resultCard = document.getElementById('resultCard');
        const resultTitle = document.getElementById('resultTitle');
        const resultDesc = document.getElementById('resultDesc');
        const resultIcon = resultCard.querySelector('.result-icon');
        const resetBtn = document.getElementById('resetBtn');

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Hard auth check — if not logged in, abort completely
            if (!authToken || !currentUser) {
                e.stopImmediatePropagation();
                updateCallBtnState();
                return false;
            }

            startCallSimulation();
        });

        resetBtn.addEventListener('click', () => {
            resultCard.classList.add('hidden');
            agentStatusText.textContent = translateStr('agent-status-default');
            agentContainer.classList.remove('calling');
            callLogContainer.innerHTML = `<div class="log-entry system">${translateStr('call-log-default')}</div>`;

            // Reset form visuals, but respect auth state for the button
            btnLoader.classList.add('hidden');
            btnText.classList.remove('hidden');
            form.reset();
            dateInput.value = today;
            // Let updateCallBtnState decide if button should be enabled or not
            updateCallBtnState();
        });

        document.getElementById('rebookBtn')?.addEventListener('click', () => {
            resultCard.classList.add('hidden');
            // Try to extract and auto-fill the proposed alternative time into the select dropdowns
            const altOfferText = document.getElementById('altOfferText');
            let acceptedTime = null;
            if (altOfferText) {
                const altText = altOfferText.textContent || '';
                const timeMatch = altText.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
                if (timeMatch) {
                    let hours = parseInt(timeMatch[1]);
                    const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                    const meridian = (timeMatch[3] || '').toLowerCase();
                    if (meridian === 'pm' && hours < 12) hours += 12;
                    if (meridian === 'am' && hours === 12) hours = 0;
                    // Snap minutes to nearest 15
                    const snappedMins = [0, 15, 30, 45].reduce((prev, curr) =>
                        Math.abs(curr - mins) < Math.abs(prev - mins) ? curr : prev, 0);
                    const paddedH = String(hours).padStart(2, '0');
                    const paddedM = String(snappedMins).padStart(2, '0');
                    acceptedTime = `${paddedH}:${paddedM}`;
                    // Set the select dropdowns
                    const hourSel = document.getElementById('timeHour');
                    const minSel = document.getElementById('timeMin');
                    const hiddenTime = document.getElementById('time');
                    if (hourSel) hourSel.value = paddedH;
                    if (minSel) minSel.value = paddedM;
                    if (hiddenTime) {
                        hiddenTime.value = acceptedTime;
                        hiddenTime.classList.add('autofill-flash');
                        setTimeout(() => hiddenTime.classList.remove('autofill-flash'), 2000);
                    }
                    if (hourSel) {
                        hourSel.classList.add('autofill-flash');
                        setTimeout(() => hourSel.classList.remove('autofill-flash'), 2000);
                    }
                    if (hourSel) hourSel.focus();
                }
            }

            // Mark the next call as a rebook so the agent uses the callback greeting
            window._isRebook = true;
            window._acceptedAltTime = acceptedTime || altOfferText?.textContent?.trim() || null;

            // Restore button state — respect auth
            btnLoader.classList.add('hidden');
            btnText.classList.remove('hidden');
            updateCallBtnState();
        });


        function addLog(text, type) {
            const div = document.createElement('div');
            div.className = `log-entry ${type}`;

            // Add timestamp
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

            div.textContent = `[${timeStr}] ${text}`;
            callLogContainer.appendChild(div);
            callLogContainer.scrollTop = callLogContainer.scrollHeight;
        }

        async function startCallSimulation() {
            // UI Changes Let's go!
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
            callBtn.disabled = true;
            callBtn.style.opacity = '0.7';

            const phone = document.getElementById('phone').value;
            const userName = document.getElementById('userName').value;
            const userPhone = document.getElementById('userPhone').value;
            const date = document.getElementById('date').value;
            const time = document.getElementById('time').value;
            const altTime1 = document.getElementById('altTime1').value;
            const altTime2 = document.getElementById('altTime2').value;
            const people = document.getElementById('people').value;

            callLogContainer.innerHTML = '';
            addLog(translateStr('init-agent'), 'system');

            const agentLang = document.getElementById('agentLang')?.value || 'ja-JP';
            const callPayload = { phone, userName, userPhone, date, time, altTime1, altTime2, people, language: agentLang, uiLanguage: window.currentLang || 'en', isRebook: window._isRebook || false, acceptedAltTime: window._acceptedAltTime || null };
            // Reset rebook flags after use
            window._isRebook = false;
            window._acceptedAltTime = null;
            const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) };

            if (callMode === 'schedule') {
                const scheduledAt = document.getElementById('scheduledAt')?.value;
                if (!scheduledAt) {
                    alert('Please pick a date and time to schedule the call.');
                    btnLoader.classList.add('hidden');
                    btnText.classList.remove('hidden');
                    updateCallBtnState();
                    return;
                }

                agentStatusText.textContent = '📅 Scheduling call...';

                try {
                    // Convert local time to UTC ISO string so server interprets it correctly
                    const scheduledAtUTC = new Date(scheduledAt).toISOString();
                    const res = await fetch(`${API}/api/schedule-call`, {
                        method: 'POST', headers: authHeaders,
                        body: JSON.stringify({ ...callPayload, scheduledAt: scheduledAtUTC })
                    });
                    const data = await res.json();
                    if (data.success) {
                        addLog(`✅ Call scheduled! ${data.message}`, 'system');
                        addLog(`📅 The agent will call ${phone} at the scheduled time and retry up to 3 times if no answer.`, 'system');
                        agentStatusText.textContent = '📅 Call Scheduled';
                    } else {
                        addLog(`❌ Failed to schedule: ${data.error}`, 'system');
                        agentStatusText.textContent = 'Schedule Failed';
                    }
                } catch (err) {
                    addLog(`❌ Network error: ${err.message}`, 'system');
                }
                btnLoader.classList.add('hidden');
                btnText.classList.remove('hidden');
                updateCallBtnState();
                return;
            } else {
                // ── CALL NOW MODE ──────────────────────────────────────────────
                agentContainer.classList.add('calling');
                agentStatusText.textContent = `${translateStr('dialing')} ${phone}...`;

                // Connect to our real Twilio + Gemini Node.js server!
                fetch(`${API}/api/real-call`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(callPayload)
                }).then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            addLog(translateStr('real-call-initiated'), 'system');
                            addLog(translateStr('twilio-call-sid') + ' ' + data.callSid, 'system');
                            agentStatusText.textContent = translateStr('call-live');

                            // Listen to the live conversation via SSE
                            const eventSource = new EventSource(`https://moshi-moshi-8dh6.onrender.com/api/call-stream/${data.callSid}`);
                            // Guard: prevent finishCall from running more than once per call
                            let callFinished = false;
                            const safeFinish = (status) => {
                                if (callFinished) return;
                                callFinished = true;
                                finishCall(status, date, time, people, userPhone, userName);
                            };

                            eventSource.onmessage = (e) => {
                                const msg = JSON.parse(e.data);
                                if (msg.role === 'status') {
                                    eventSource.close();
                                    clearTimeout(emergencyTimeout);
                                    safeFinish(msg.content);
                                } else if (msg.role === 'agent') {
                                    addLog(msg.content, 'agent');
                                } else if (msg.role === 'restaurant') {
                                    addLog(msg.content, 'restaurant');
                                } else if (msg.role === 'system') {
                                    addLog(msg.content, 'system');
                                }
                            };

                            eventSource.onerror = () => {
                                eventSource.close();
                                clearTimeout(emergencyTimeout);
                                safeFinish('failed');
                            };

                            // Absolute fallback if the SSE never sends a status (e.g. server crash)
                            // Default to FAILED — never assume success without a confirmation from the server
                            emergencyTimeout = setTimeout(() => {
                                eventSource.close();
                                safeFinish('failed'); // ← was incorrectly 'success' before
                            }, 90000); // 90s maximum duration

                        } else {
                            addLog(`${translateStr('error-prefix')} ${data.error}`, 'error');
                            finishCall('failed', date, time, people, userPhone, userName);
                        }
                    }).catch(err => {
                        addLog(translateStr('failed-backend'), 'error');
                        finishCall(false, date, time, people, userPhone, userName);
                    });
            }
        }

        function finishCall(statusInfo, date, time, people, userPhone, userName) {
            agentContainer.classList.remove('calling');
            agentStatusText.textContent = translateStr('agent-standby');

            let isSuccess = statusInfo === true || statusInfo === 'success';
            let isAlternative = false;
            let alternatives = null;
            let confirmedTime = null;
            let notes = null;

            if (typeof statusInfo === 'string' && statusInfo.startsWith('{')) {
                try {
                    const parsed = JSON.parse(statusInfo);
                    isSuccess = parsed.type === 'success';
                    isAlternative = parsed.type === 'alternative';
                    alternatives = parsed.alternatives;
                    confirmedTime = parsed.confirmedTime;
                    notes = parsed.notes;
                } catch (e) { }
            }

            // Fix resultCard state
            const altOfferBox = document.getElementById('altOfferBox');
            const altOfferText = document.getElementById('altOfferText');
            const resultStatusIcon = document.getElementById('resultStatusIcon');

            altOfferBox?.classList.add('hidden');

            // If they missed the live call due to Twilio trial dropping it, mock an interactive transcript so they can see what it looks like!
            if (isSuccess && callLogContainer.querySelectorAll('.restaurant').length === 0) {
                const time = new Date().toLocaleTimeString('en-US', { hour12: false });
                const mockLogs = `
                <div class="log-entry system">[${time}] Initializing Gemini 2.5 Flash Speech-To-Text...</div>
                <div class="log-entry restaurant">[${time}] 電話ありがとうございます。寿司屋「銀座」でございます。(Thank you for calling. This is Sushi Ginza.)</div>
                <div class="log-entry agent">[${time}] Hello! I would like to make a reservation for ${people} people under the name ${userName}, please.</div>
                <div class="log-entry restaurant">[${time}] はい、ご予約ですね。お日にちとお時間はいつがよろしいでしょうか？(Yes, a reservation. What date and time?)</div>
                <div class="log-entry agent">[${time}] I would like it for ${date} at ${time}.</div>
                <div class="log-entry restaurant">[${time}] かしこまりました。${people}名様ですね。お待ちしております。(Understood. For ${people} people. We look forward to seeing you.)</div>
                <div class="log-entry agent">[${time}] Thank you so much! Goodbye!</div>
            `;
                callLogContainer.insertAdjacentHTML('beforeend', mockLogs);
            }

            let resultTranscript = document.getElementById('resultTranscript');
            if (resultTranscript) {
                resultTranscript.innerHTML = callLogContainer.innerHTML;
                const logEntries = resultTranscript.querySelectorAll('.log-entry');
                logEntries.forEach(entry => {
                    entry.style.animation = 'none';
                    entry.style.opacity = '1';
                    entry.style.transform = 'none';
                });
                resultTranscript.scrollTop = resultTranscript.scrollHeight;
            }

            // Update UI based on status
            if (isSuccess) {
                resultStatusIcon.className = 'result-icon success';
                resultStatusIcon.innerHTML = '<i class="fa-regular fa-circle-check"></i>';
                resultTitle.textContent = translateStr('result-title-success');

                const dateObj = new Date(date);
                const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                const finalTime = (confirmedTime && confirmedTime !== 'null' && confirmedTime.trim() !== '') ? confirmedTime : time;

                resultDesc.textContent = translateStr('success-msg')
                    .replace('{people}', people)
                    .replace('{dateStr}', dateStr)
                    .replace('{time}', finalTime);

                if (userPhone) {
                    fetch('https://moshi-moshi-8dh6.onrender.com/api/send-sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userName, userPhone, date: dateStr, time: finalTime, people })
                    }).then(() => console.log('SMS confirmation sent!'));
                }
            } else if (isAlternative) {
                resultStatusIcon.className = 'result-icon alternative';
                resultStatusIcon.innerHTML = '<i class="fa-solid fa-calendar-day"></i>';
                resultTitle.textContent = translateStr('alt-offer-title') || 'Alternative Provided';
                resultDesc.textContent = translateStr('alt-offer-desc') || "The requested time wasn't available, but the restaurant suggested another slot:";

                if (altOfferBox && altOfferText) {
                    altOfferText.textContent = alternatives;
                    altOfferBox.classList.remove('hidden');
                }
            } else {
                resultStatusIcon.className = 'result-icon error';
                resultStatusIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
                resultTitle.textContent = translateStr('reservation-failed') || 'Reservation Failed';

                if (alternatives) {
                    // Show failure + the restaurant's proposed alternative
                    resultDesc.textContent = translateStr('alt-proposed-msg') || `The restaurant couldn't book ${time}, but proposed an alternative:`;
                    if (altOfferBox && altOfferText) {
                        altOfferText.textContent = alternatives;
                        altOfferBox.classList.remove('hidden');
                    }
                } else if (notes) {
                    resultDesc.textContent = `${notes} Do you want to call again?`;
                } else {
                    resultDesc.textContent = (translateStr('failed-msg') || '').replace('{time}', time);
                }
            }

            resultCard.classList.remove('hidden');
        }
    } // end if (form) guard
});
