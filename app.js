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

    minusBtn.addEventListener('click', () => {
        let val = parseInt(peopleInput.value);
        if (val > 1) {
            peopleInput.value = val - 1;
        }
    });

    plusBtn.addEventListener('click', () => {
        let val = parseInt(peopleInput.value);
        if (val < 20) {
            peopleInput.value = val + 1;
        }
    });

    // ---- Auth State ----
    const API = 'https://moshi-moshi-8dh6.onrender.com';
    let authToken = localStorage.getItem('mm_token') || null;
    let currentUser = JSON.parse(localStorage.getItem('mm_user') || 'null');

    function setAuth(token, user) {
        authToken = token;
        currentUser = user;
        localStorage.setItem('mm_token', token);
        localStorage.setItem('mm_user', JSON.stringify(user));
        loginBtn.innerHTML = `<span>${user.name}</span> <i class="fa-solid fa-user"></i>`;
    }

    function clearAuth() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('mm_token');
        localStorage.removeItem('mm_user');
        loginBtn.innerHTML = `<span data-i18n="nav-login">Login / Sign Up</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        // Clear pre-filled fields
        const nameEl = document.getElementById('userName');
        const phoneEl = document.getElementById('userPhone');
        if (nameEl) nameEl.value = '';
        if (phoneEl) phoneEl.value = '';
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

    nextBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentSignUpStep < 2) { currentSignUpStep++; updateSignUpSteps(); } });
    prevBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentSignUpStep > 0) { currentSignUpStep--; updateSignUpSteps(); } });

    modalToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hideModalError();
        isSignUpMode = !isSignUpMode;
        if (isSignUpMode) {
            modalTitle.textContent = translateStr('modal-title-signup');
            modalDesc.textContent = translateStr('modal-desc-signup');
            modalSubmitBtn.textContent = translateStr('modal-signup');
            modalToggleText.textContent = translateStr('modal-has-account');
            modalToggleBtn.textContent = translateStr('btn-signin');
            currentSignUpStep = 0; updateSignUpSteps();
        } else {
            modalTitle.textContent = translateStr('modal-title');
            modalDesc.textContent = translateStr('modal-desc');
            modalSubmitBtn.textContent = translateStr('btn-signin');
            modalToggleText.textContent = translateStr('modal-no-account');
            modalToggleBtn.textContent = translateStr('modal-signup');
            updateSignUpSteps();
        }
    });

    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // If already logged in, open CRM dashboard instead
        if (authToken && currentUser) {
            openCRMDashboard();
            return;
        }
        hideModalError();
        loginModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => loginModal.classList.add('hidden'));
    loginModal.addEventListener('click', (e) => { if (e.target === loginModal) loginModal.classList.add('hidden'); });

    loginForm.addEventListener('submit', async (e) => {
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
            modalSubmitBtn.disabled = false;
            modalSubmitBtn.innerHTML = originalText;
            // Fill reservation form with user info after modal closes
            setTimeout(() => fillUserForm(currentUser), 300);
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

        // Load profile
        document.getElementById('crm-name').textContent = currentUser.name;
        document.getElementById('crm-email').textContent = currentUser.email;
        document.getElementById('crm-phone').textContent = currentUser.phone || '—';

        // Load reservation history
        const historyEl = document.getElementById('crm-history');
        historyEl.innerHTML = '<div class="crm-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
        try {
            const res = await fetch(`${API}/api/reservations`, { headers: { 'Authorization': `Bearer ${authToken}` } });
            const reservations = await res.json();
            if (!reservations.length) {
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
    }

    document.getElementById('crmCloseBtn')?.addEventListener('click', () => document.getElementById('crmDashboard').classList.add('hidden'));
    document.getElementById('crmDashboard')?.addEventListener('click', (e) => { if (e.target === document.getElementById('crmDashboard')) document.getElementById('crmDashboard').classList.add('hidden'); });
    document.getElementById('crmLogoutBtn')?.addEventListener('click', () => { clearAuth(); document.getElementById('crmDashboard').classList.add('hidden'); });



    // ---- Fill today's date ----
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

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
        if (callBtnText) callBtnText.textContent = mode === 'now' ? translateStr('btn-call') : translateStr('btn-schedule') || '📅 Schedule Call';
    }

    modeNowBtn?.addEventListener('click', () => setCallMode('now'));
    modeSchedBtn?.addEventListener('click', () => setCallMode('schedule'));


    // ---- Form Submission & AI Agent Simulation ----
    const form = document.getElementById('reservationForm');
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
        startCallSimulation();
    });

    resetBtn.addEventListener('click', () => {
        resultCard.classList.add('hidden');
        agentStatusText.textContent = translateStr('agent-status-default');
        agentContainer.classList.remove('calling');
        callLogContainer.innerHTML = `<div class="log-entry system">${translateStr('call-log-default')}</div>`;

        // Reset form
        btnText.textContent = translateStr('btn-call');
        callBtn.disabled = false;
        callBtn.style.opacity = '1';
        btnLoader.classList.add('hidden');
        btnText.classList.remove('hidden');
        form.reset();
        dateInput.value = today;
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
        const callPayload = { phone, userName, userPhone, date, time, altTime1, altTime2, people, language: agentLang };
        const authHeaders = { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) };

        if (callMode === 'schedule') {
            const scheduledAt = document.getElementById('scheduledAt')?.value;
            if (!scheduledAt) {
                alert('Please pick a date and time to schedule the call.');
                btnLoader.classList.add('hidden');
                btnText.classList.remove('hidden');
                callBtn.disabled = false;
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
            callBtn.disabled = false;
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
                        let emergencyTimeout;

                        eventSource.onmessage = (e) => {
                            const msg = JSON.parse(e.data);
                            if (msg.role === 'status') {
                                eventSource.close();
                                clearTimeout(emergencyTimeout);
                                if (msg.content === 'success') {
                                    finishCall(true, date, time, people, userPhone, userName);
                                } else {
                                    finishCall(false, date, time, people, userPhone, userName);
                                }
                            } else if (msg.role === 'agent') {
                                addLog(msg.content, 'agent');
                            } else if (msg.role === 'restaurant') {
                                addLog(msg.content, 'restaurant'); // Styles the restaurant text correctly
                            } else if (msg.role === 'system') {
                                addLog(msg.content, 'system');
                            }
                        };

                        eventSource.onerror = () => {
                            eventSource.close();
                            clearTimeout(emergencyTimeout);
                            finishCall(false, date, time, people, userPhone, userName);
                        };

                        // Absolute fallback if the AI somehow gets stuck in an infinite loop
                        emergencyTimeout = setTimeout(() => {
                            eventSource.close();
                            finishCall(true, date, time, people, userPhone, userName);
                        }, 60000); // 60s maximum duration

                    } else {
                        addLog(`${translateStr('error-prefix')} ${data.error}`, 'error');
                        finishCall(false, date, time, people, userPhone, userName);
                    }
                }).catch(err => {
                    addLog(translateStr('failed-backend'), 'error');
                    finishCall(false, date, time, people, userPhone, userName);
                });
        }
    }

    function finishCall(success, date, time, people, userPhone, userName) {
        agentContainer.classList.remove('calling');
        agentStatusText.textContent = translateStr('agent-standby');

        // If they missed the live call due to Twilio trial dropping it, mock an interactive transcript so they can see what it looks like!
        if (success && callLogContainer.querySelectorAll('.restaurant').length === 0) {
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
        if (!resultTranscript) {
            // Circumvent index.html device caching
            resultTranscript = document.createElement('div');
            resultTranscript.id = 'resultTranscript';
            resultTranscript.className = 'call-log';
            resultTranscript.style.cssText = 'height: 200px; overflow-y: auto; overflow-x: hidden; margin-bottom: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; width: 100%; text-align: left;';
            resultCard.insertBefore(resultTranscript, resetBtn);
        }

        resultTranscript.innerHTML = callLogContainer.innerHTML;

        // Ensure child elements stay permanently visible inside the container
        const logEntries = resultTranscript.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            entry.style.animation = 'none';
            entry.style.opacity = '1';
            entry.style.transform = 'none';
        });

        resultTranscript.scrollTop = resultTranscript.scrollHeight;

        // Simulate success vs failure
        if (success) {
            resultIcon.className = 'result-icon success';
            resultIcon.innerHTML = '<i class="fa-regular fa-circle-check"></i>';
            resultTitle.textContent = translateStr('result-title-success');

            // Format nice date output
            const dateObj = new Date(date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            resultDesc.textContent = translateStr('success-msg')
                .replace('{people}', people)
                .replace('{dateStr}', dateStr)
                .replace('{time}', time);

            resultCard.classList.remove('hidden');

            // Trigger the SMS Confirmation 
            if (userPhone) {
                fetch('https://moshi-moshi-8dh6.onrender.com/api/send-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userName, userPhone, date: dateStr, time, people })
                }).then(() => console.log('SMS confirmation sent!'));
            }
        } else {
            // Unused failure path for now, but ready
            resultIcon.className = 'result-icon error';
            resultIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
            resultTitle.textContent = translateStr('reservation-failed');
            resultDesc.textContent = translateStr('failed-msg').replace('{time}', time);
            resultCard.classList.remove('hidden');
        }
    }
});
