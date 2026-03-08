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

    // ---- PWA Download Logic ----
    let deferredPrompt;
    const downloadAppBtns = document.querySelectorAll('.download-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
    });

    downloadAppBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Check if device is iOS to show custom instructions
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            if (isIOS) {
                alert("To install the Moshi Moshi app on iOS:\n1. Tap the 'Share' icon at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.");
            } else if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                }
                deferredPrompt = null;
            } else {
                alert("To install this app, simply use your browser's 'Add to Home Screen' or 'Install App' feature from the menu!");
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

    // Multi-step signup elements
    const stepAccount = document.getElementById('step-account');
    const stepPersonal = document.getElementById('step-personal');
    const stepPayment = document.getElementById('step-payment');
    const stepButtons = document.getElementById('step-buttons');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let isSignUpMode = false;
    let currentSignUpStep = 0;

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
            prevBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
            modalSubmitBtn.classList.add('hidden');
        } else if (currentSignUpStep === 1) {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.remove('hidden');
            modalSubmitBtn.classList.add('hidden');
        } else if (currentSignUpStep === 2) {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden');
            modalSubmitBtn.classList.remove('hidden');
        }
    }

    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentSignUpStep < 2) {
            currentSignUpStep++;
            updateSignUpSteps();
        }
    });

    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentSignUpStep > 0) {
            currentSignUpStep--;
            updateSignUpSteps();
        }
    });

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

            currentSignUpStep = 0;
            updateSignUpSteps();
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

            updateSignUpSteps();
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
            const modalName = document.getElementById('modal-name').value;
            const modalPhone = document.getElementById('modal-userPhone').value;

            if (isSignUpMode && modalName) {
                document.getElementById('userName').value = modalName;
            } else if (!isSignUpMode) {
                document.getElementById('userName').value = "Judy Chen";
            }

            if (isSignUpMode && modalPhone) {
                document.getElementById('userPhone').value = modalPhone;
            } else if (!isSignUpMode) {
                document.getElementById('userPhone').value = "+1 555-0199";
            }

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
        const userName = document.getElementById('userName').value;
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
            body: JSON.stringify({ phone, userName, userPhone, date, time, people, language: navigator.language || 'en-US' })
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
                            addLog(msg.content, 'user'); // Styles the restaurant text cleanly in grey
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

    function finishCall(success, date, time, people, userPhone, userName) {
        agentContainer.classList.remove('calling');
        agentStatusText.textContent = translateStr('agent-standby');

        const resultTranscript = document.getElementById('resultTranscript');
        if (resultTranscript) {
            resultTranscript.innerHTML = callLogContainer.innerHTML;
            resultTranscript.scrollTop = resultTranscript.scrollHeight;
        }

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
