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
        const btn = loginForm.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Signing in...';

        setTimeout(() => {
            loginModal.classList.add('hidden');
            loginBtn.innerHTML = '<span>My Account</span> <i class="fa-solid fa-user"></i>';
            btn.innerHTML = originalText;
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
        agentStatusText.textContent = 'Awaiting Instructions';
        agentContainer.classList.remove('calling');
        callLogContainer.innerHTML = '<div class="log-entry system">Agent ready for next call.</div>';

        // Reset form
        btnText.textContent = 'Initiate AI Call';
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
        agentStatusText.textContent = `Dialing ${phone}...`;

        callLogContainer.innerHTML = '';
        addLog('Initializing MoshiMoshi AI Agent...', 'system');

        // Connect to our real Twilio + Gemini Node.js server!
        fetch('https://moshi-moshi-8dh6.onrender.com/api/real-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, userPhone, date, time, people })
        }).then(res => res.json())
            .then(data => {
                if (data.success) {
                    addLog('Real Phone Call Initiated!', 'system');
                    addLog('Twilio Call SID: ' + data.callSid, 'system');
                    agentStatusText.textContent = 'Call Live on Twilio!';

                    // Keep the UI in a "Calling" state for 25 seconds while you talk to it!
                    addLog('Please pick up the phone and speak Japanese to the Agent!', 'agent');

                    setTimeout(() => {
                        finishCall(true, date, time, people, userPhone);
                    }, 25000); // 25s timeout for demo

                } else {
                    addLog('Error: ' + data.error, 'error');
                    finishCall(false, date, time, people, userPhone);
                }
            }).catch(err => {
                addLog('Failed to connect to backend.', 'error');
                finishCall(false, date, time, people, userPhone);
            });
    }

    function finishCall(success, date, time, people, userPhone) {
        agentContainer.classList.remove('calling');
        agentStatusText.textContent = 'Agent Standby';

        // Simulate success vs failure
        if (success) {
            resultIcon.className = 'result-icon success';
            resultIcon.innerHTML = '<i class="fa-regular fa-circle-check"></i>';
            resultTitle.textContent = 'Reservation Confirmed!';

            // Format nice date output
            const dateObj = new Date(date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            resultDesc.textContent = `Your table for ${people} on ${dateStr} at ${time} is successfully booked! A deposit authorization was securely held.`;
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
            resultTitle.textContent = 'Reservation Failed';
            resultDesc.textContent = `The restaurant is fully booked for ${time}. Try selecting a different time or date.`;
            resultCard.classList.remove('hidden');
        }
    }
});
