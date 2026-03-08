const translations = {
    "en": {
        "nav-how": "How it Works",
        "nav-reserve": "Make Reservation",
        "nav-login": "Login / Sign Up",
        "hero-title": "Your Personal Bilingual Concierge",
        "hero-sub": "Our AI calls Japanese restaurants, speaks fluent Japanese, and secures your table. Never worry about language barriers again.",
        "hero-btn": "Start Calling Now",
        "form-title": "Reservation Details",
        "form-desc": "Provide the restaurant's details and we'll handle the call.",
        "label-userName": "Your Name",
        "label-userPhone": "Your Phone Number (For SMS Confirmation)",
        "label-phone": "Restaurant Phone Number",
        "label-date": "Date",
        "label-time": "Time",
        "label-people": "Number of People",
        "deposit-title": "Deposit Method",
        "deposit-desc": "A credit card is required. Some premium Japanese restaurants mandate a deposit. You will only be charged if the restaurant requests it.",
        "label-cc-name": "Cardholder Name",
        "label-cc-number": "Card Number",
        "label-cc-exp": "Expiry (MM/YY)",
        "label-cc-cvc": "CVC",
        "btn-call": "Initiate AI Call",
        "agent-status-title": "Agent Status",
        "agent-status-default": "Awaiting Instructions",
        "call-log-default": "Agent initialized. Ready to call.",
        "result-title-success": "Reservation Confirmed!",
        "result-desc-success": "Your table is booked.",
        "btn-reset": "Make Another Booking",
        "footer-desc": "Bridging the language gap for authentic dining experiences.",
        "footer-privacy": "Privacy Policy",
        "footer-terms": "Terms of Service",
        "footer-contact": "Contact Support",
        "modal-title": "User Login",
        "modal-desc": "Sign in to access your reservation history and saved payment methods.",
        "label-email": "Email",
        "label-password": "Password",
        "btn-signin": "Sign In",
        "modal-no-account": "Don't have an account?",
        "modal-signup": "Sign up",
        "modal-title-signup": "Create Account",
        "modal-desc-signup": "Sign up to track your reservations and save time.",
        "modal-has-account": "Already have an account?",
        "signing-up": "Creating account...",

        "dialing": "Dialing",
        "real-call-initiated": "Real Phone Call Initiated!",
        "twilio-call-sid": "Twilio Call SID:",
        "call-live": "Call Live on Twilio!",
        "pick-up": "Please pick up the phone and speak Japanese to the Agent!",
        "error-prefix": "Error:",
        "failed-backend": "Failed to connect to backend.",
        "agent-standby": "Agent Standby",
        "success-msg": "Your table for {people} on {dateStr} at {time} is successfully booked! A deposit authorization was securely held.",
        "reservation-failed": "Reservation Failed",
        "failed-msg": "The restaurant is fully booked for {time}. Try selecting a different time or date.",
        "init-agent": "Initializing MoshiMoshi AI Agent...",
        "my-account": "My Account",
        "signing-in": "Signing in..."
    },
    "zh-TW": {
        "nav-how": "如何運作",
        "nav-reserve": "預約訂位",
        "nav-login": "登入 / 註冊",
        "hero-title": "您的專屬雙語管家",
        "hero-sub": "我們的 AI 會親自打給日本餐廳，用流利的日語為您保留座位。再也不必擔心語言障礙。",
        "hero-btn": "立即開始通話",
        "form-title": "預約詳情",
        "form-desc": "提供餐廳詳細資訊，剩下的交給我們。",
        "label-userName": "您的姓名",
        "label-userPhone": "您的手機號碼 (用於簡訊確認)",
        "label-phone": "餐廳電話號碼",
        "label-date": "日期",
        "label-time": "時間",
        "label-people": "人數",
        "deposit-title": "訂金付款方式",
        "deposit-desc": "需要信用卡資訊。部分高級日本餐廳規定收取訂金。只有當餐廳要求時我們才會扣款。",
        "label-cc-name": "持卡人姓名",
        "label-cc-number": "信用卡號碼",
        "label-cc-exp": "到期日 (MM/YY)",
        "label-cc-cvc": "安全碼 (CVC)",
        "btn-call": "啟動 AI 呼叫",
        "agent-status-title": "智能助理狀態",
        "agent-status-default": "等待指令...",
        "call-log-default": "助理已就緒。準備撥號。",
        "result-title-success": "預約成功！",
        "result-desc-success": "您的座位已預訂。",
        "btn-reset": "進行另一筆測試預約",
        "footer-desc": "弭平語言隔閡，為您帶來最道地的用餐體驗。",
        "footer-privacy": "隱私權政策",
        "footer-terms": "服務條款",
        "footer-contact": "聯絡客服",
        "modal-title": "使用者登入",
        "modal-desc": "登入以查看預約紀錄及儲存的付款方式。",
        "label-email": "電子郵件",
        "label-password": "密碼",
        "btn-signin": "登入",
        "modal-no-account": "還沒有帳號？",
        "modal-signup": "註冊",
        "modal-title-signup": "建立新帳戶",
        "modal-desc-signup": "快速註冊以追蹤您的預約紀錄。",
        "modal-has-account": "已經有帳號了嗎？",
        "signing-up": "帳戶建立中...",

        "dialing": "正在撥號",
        "real-call-initiated": "已發起真實電話！",
        "twilio-call-sid": "Twilio 通話 SID:",
        "call-live": "Twilio 通話進行中！",
        "pick-up": "請接起電話，並用日語與智能助理對話！",
        "error-prefix": "錯誤:",
        "failed-backend": "無法連接到後端服務。",
        "agent-standby": "助理待命",
        "success-msg": "您預訂的 {dateStr} {time} {people} 人座位已成功保留！並已授權扣款訂金。",
        "reservation-failed": "預約失敗",
        "failed-msg": "餐廳在 {time} 已客滿，請嘗試選擇其他日期或時間。",
        "init-agent": "正在初始化 MoshiMoshi AI 助理...",
        "my-account": "我的帳戶",
        "signing-in": "登入中..."
    }
};

let currentLang = "en";
if (typeof navigator !== "undefined" && navigator.language) {
    if (navigator.language.toLowerCase().startsWith("zh")) {
        currentLang = "zh-TW";
    }
}

function updateUI() {
    // Basic text content elements
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[currentLang][key]) {
            el.innerHTML = translations[currentLang][key];
        }
    });

    // Toggle button text
    const toggleBtn = document.getElementById("langToggleBtn");
    if (toggleBtn) {
        toggleBtn.textContent = currentLang === 'en' ? '中(繁)' : 'EN';
    }
}

function translateStr(key) {
    return translations[currentLang][key] || key;
}

document.addEventListener("DOMContentLoaded", () => {
    const langToggleBtn = document.getElementById("langToggleBtn");
    if (langToggleBtn) {
        langToggleBtn.addEventListener("click", () => {
            currentLang = currentLang === "en" ? "zh-TW" : "en";
            updateUI();
        });
    }
    updateUI();
});

window.translateStr = translateStr;
window.currentLang = currentLang;
