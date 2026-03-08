document.addEventListener('DOMContentLoaded', () => {
    // ---- Navbar scroll effect ----
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
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

    // ---- Login Modal Logic ----
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const closeModal = document.getElementById('closeModal');
    const loginForm = document.getElementById('loginForm');

    // Elements for toggling between Sign In and Sign Up
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const modalSubmitBtn = document.getElementById('modalSubmitBtn');
    const modalToggleText = document.getElementById('modalToggleText');
    const modalToggleBtn = document.getElementById('modalToggleBtn');

    let isSignUpMode = false;

    // Toggle Mode
    modalToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;

        if (isSignUpMode) {
            modalTitle.setAttribute('data-i18n', 'modal-title-signup');
            modalTitle.textContent = translateStr('modal-title-signup');

            modalDesc.setAttribute('data-i18n', 'modal-desc-signup');
            modalDesc.textContent = translateStr('modal-desc-signup');

            modalSubmitBtn.setAttribute('data-i18n', 'modal-signup');
            modalSubmitBtn.textContent = translateStr('modal-signup');

            modalToggleText.setAttribute('data-i18n', 'modal-has-account');
            modalToggleText.textContent = translateStr('modal-has-account');

            modalToggleBtn.setAttribute('data-i18n', 'btn-signin');
            modalToggleBtn.textContent = translateStr('btn-signin');
        } else {
            modalTitle.setAttribute('data-i18n', 'modal-title');
            modalTitle.textContent = translateStr('modal-title');

            modalDesc.setAttribute('data-i18n', 'modal-desc');
            modalDesc.textContent = translateStr('modal-desc');

            modalSubmitBtn.setAttribute('data-i18n', 'btn-signin');
            modalSubmitBtn.textContent = translateStr('btn-signin');

            modalToggleText.setAttribute('data-i18n', 'modal-no-account');
            modalToggleText.textContent = translateStr('modal-no-account');

            modalToggleBtn.setAttribute('data-i18n', 'modal-signup');
            modalToggleBtn.textContent = translateStr('modal-signup');
        }
    });

    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        loginModal.classList.add('hidden');
    });

    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.add('hidden');
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const originalText = modalSubmitBtn.innerHTML;
        modalSubmitBtn.innerHTML = isSignUpMode ? translateStr("signing-up") : translateStr("signing-in");

        setTimeout(() => {
            loginModal.classList.add('hidden');
            loginBtn.innerHTML = `<span>${translateStr("my-account")}</span> <i class="fa-solid fa-user"></i>`;
            modalSubmitBtn.innerHTML = originalText;
            loginForm.reset();
        }, 1500);
    });

    // ---- Fill today's date ----
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

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

    function startCallSimulation() {
        // UI Changes Let's go!
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        callBtn.disabled = true;
        callBtn.style.opacity = '0.7';

        const phone = document.getElementById('phone').value;
        const userPhone = document.getElementById('userPhone').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const people = document.getElementById('people').value;

        agentContainer.classList.add('calling');
        agentStatusText.textContent = `${translateStr('dialing')} ${phone}...`;

        callLogContainer.innerHTML = '';
        addLog(translateStr('init-agent'), 'system');

        // Connect to our real Twilio + Gemini Node.js server!
        fetch('https://moshi-moshi-8dh6.onrender.com/api/real-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, userPhone, date, time, people, language: navigator.language || 'en-US' })
        }).then(res => res.json())
            .then(data => {
                if (data.success) {
                    addLog(translateStr('real-call-initiated'), 'system');
                    addLog(translateStr('twilio-call-sid') + ' ' + data.callSid, 'system');
                    agentStatusText.textContent = translateStr('call-live');

                    // Keep the UI in a "Calling" state for 25 seconds while you talk to it!
                    addLog(translateStr('pick-up'), 'agent');

                    setTimeout(() => {
                        finishCall(true, date, time, people, userPhone);
                    }, 25000); // 25s timeout for demo

                } else {
                    addLog(`${translateStr('error-prefix')} ${data.error}`, 'error');
                    finishCall(false, date, time, people, userPhone);
                }
            }).catch(err => {
                addLog(translateStr('failed-backend'), 'error');
                finishCall(false, date, time, people, userPhone);
            });
    }

    function finishCall(success, date, time, people, userPhone) {
        agentContainer.classList.remove('calling');
        agentStatusText.textContent = translateStr('agent-standby');

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
                    body: JSON.stringify({ userPhone, date: dateStr, time, people })
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
