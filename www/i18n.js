const translations = {
    "en": {
        "nav-how": "How it Works",
        "nav-reserve": "Make Reservation",
        "nav-login": "Login / Sign Up",
        "nav-download": "Download App",
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
        "label-altTime1": "Alt. Time 1 (Optional)",
        "label-altTime2": "Alt. Time 2 (Optional)",
        "label-people": "Number of People",
        "label-agentLang": "Agent Call Language",
        "lang-ja": "Japanese",
        "lang-en": "English",
        "lang-zh-TW": "Mandarin (TW)",
        "lang-zh-CN": "Mandarin (CN)",
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
        "personal-title": "Personal Information",
        "personal-desc": "Basic contact details to personalize your reservations.",
        "label-address": "Billing Address",
        "btn-next": "Next",
        "btn-prev": "Back",
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
        "signing-in": "Signing in...",
        "how-title": "How it Works",
        "step-1-title": "1. Enter Details",
        "step-1-desc": "Provide the restaurant's phone number, date, time, and number of guests.",
        "step-2-title": "2. AI Calls Instantly",
        "step-2-desc": "Our bilingual AI agent dials the restaurant in Japan immediately or at your scheduled time.",
        "step-3-title": "3. Human-like Negotiation",
        "step-3-desc": "The agent speaks fluent Japanese, handles alternative times, and secures your table.",
        "step-4-title": "4. Get SMS Confirmation",
        "step-4-desc": "Receive a text message with your booking details once the reservation is confirmed."
    },
    "ja": {
        "nav-how": "使い方",
        "nav-reserve": "予約する",
        "nav-login": "ログイン / 登録",
        "nav-download": "アプリをDL",
        "hero-title": "あなた専属のバイリンガル・コンシェルジュ",
        "hero-sub": "AIが日本語でレストランに電話し、お席を確保します。言語の壁を心配する必要はもうありません。",
        "hero-btn": "今すぐ電話する",
        "form-title": "予約の詳細",
        "form-desc": "レストランの情報を入力してください。電話はAIがお任せします。",
        "label-userName": "お名前",
        "label-userPhone": "電話番号（SMS確認用）",
        "label-phone": "レストランの電話番号",
        "label-date": "日付",
        "label-time": "時間",
        "label-altTime1": "代替時間 1（任意）",
        "label-altTime2": "代替時間 2（任意）",
        "label-people": "人数",
        "label-agentLang": "エージェントの通話言語",
        "lang-ja": "日本語",
        "lang-en": "英語",
        "lang-zh-TW": "中国語（繁体）",
        "lang-zh-CN": "中国語（簡体）",
        "deposit-title": "デポジット方法",
        "deposit-desc": "クレジットカードが必要です。一部の高級レストランでは保証金が必要です。レストランが要求した場合のみ請求されます。",
        "label-cc-name": "カード名義人",
        "label-cc-number": "カード番号",
        "label-cc-exp": "有効期限（MM/YY）",
        "label-cc-cvc": "セキュリティコード",
        "btn-call": "AI通話を開始",
        "agent-status-title": "エージェント状態",
        "agent-status-default": "指示を待っています",
        "call-log-default": "エージェント起動完了。通話の準備ができました。",
        "result-title-success": "予約確定！",
        "result-desc-success": "お席が予約されました。",
        "btn-reset": "別の予約をする",
        "footer-desc": "言語の壁を越えて、本格的な食体験を。",
        "footer-privacy": "プライバシーポリシー",
        "footer-terms": "利用規約",
        "footer-contact": "サポートに連絡",
        "modal-title": "ログイン",
        "modal-desc": "予約履歴と保存済み支払い方法にアクセスするにはサインインしてください。",
        "label-email": "メールアドレス",
        "label-password": "パスワード",
        "btn-signin": "サインイン",
        "modal-no-account": "アカウントをお持ちでないですか？",
        "modal-signup": "登録する",
        "modal-title-signup": "アカウント作成",
        "modal-desc-signup": "登録して予約を管理しましょう。",
        "modal-has-account": "すでにアカウントをお持ちですか？",
        "signing-up": "アカウントを作成中...",
        "personal-title": "個人情報",
        "personal-desc": "予約を個別対応するための基本的な連絡先情報。",
        "label-address": "請求先住所",
        "btn-next": "次へ",
        "btn-prev": "戻る",
        "dialing": "発信中",
        "real-call-initiated": "実際の電話を発信しました！",
        "twilio-call-sid": "Twilio 通話SID:",
        "call-live": "Twilio通話進行中！",
        "pick-up": "電話を取って、AIエージェントに日本語で話しかけてください！",
        "error-prefix": "エラー:",
        "failed-backend": "バックエンドへの接続に失敗しました。",
        "agent-standby": "スタンバイ中",
        "success-msg": "{dateStr} {time} {people}名様のご予約が完了しました！",
        "reservation-failed": "予約失敗",
        "failed-msg": "{time} のご予約は満席です。別の時間や日程をお試しください。",
        "init-agent": "MoshiMoshi AIエージェントを起動中...",
        "my-account": "マイアカウント",
        "signing-in": "サインイン中...",
        "how-title": "使い方",
        "step-1-title": "1. 情報を入力",
        "step-1-desc": "レストランの電話番号、日時、人数を入力します。",
        "step-2-title": "2. AIが即座に電話",
        "step-2-desc": "バイリンガルAIエージェントが、即座に、または予約した時間に日本のレストランへ電話します。",
        "step-3-title": "3. 自然な交渉",
        "step-3-desc": "エージェントが流暢な日本語で話し、空席情報の確認や予約の確保を行います。",
        "step-4-title": "4. SMSで確認",
        "step-4-desc": "予約が確定すると、詳細が記載された確認メッセージが届きます。"
    },
    "zh-TW": {
        "nav-how": "如何運作",
        "nav-reserve": "預約訂位",
        "nav-login": "登入 / 註冊",
        "nav-download": "下載 App",
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
        "label-altTime1": "備選時間 1 (選填)",
        "label-altTime2": "備選時間 2 (選填)",
        "label-people": "人數",
        "label-agentLang": "AI 撥話語言",
        "lang-ja": "日語",
        "lang-en": "英語",
        "lang-zh-TW": "中文（繁體）",
        "lang-zh-CN": "中文（簡體）",
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
        "personal-title": "個人資訊",
        "personal-desc": "基本聯絡資料，提供專屬的預約體驗。",
        "label-address": "帳單地址",
        "btn-next": "下一頁",
        "btn-prev": "上一頁",
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
        "signing-in": "登入中...",
        "how-title": "運作原理",
        "step-1-title": "1. 輸入預約詳情",
        "step-1-desc": "提供餐廳電話、日期、時間及用餐人數。",
        "step-2-title": "2. AI 立即撥號",
        "step-2-desc": "我們的雙語 AI 助理會立即或在您預約的時間撥打電話至日本餐廳。",
        "step-3-title": "3. 流利日語對話",
        "step-3-desc": "助理會以流利的日語與餐廳溝通、協調時間並確保訂位成功。",
        "step-4-title": "4. 收到簡訊確認",
        "step-4-desc": "一旦訂位完成，您將會收到包含預約資訊的手機簡訊。"
    }
};

// --- Language Config ---
const langConfig = {
    "en": { flag: "🇺🇸", label: "EN" },
    "ja": { flag: "🇯🇵", label: "JP" },
    "zh-TW": { flag: "🇹🇼", label: "中(繁)" }
};

let currentLang = "en";
// Auto-detect UI language from browser
if (typeof navigator !== "undefined" && navigator.language) {
    const bl = navigator.language.toLowerCase();
    if (bl.startsWith("ja")) currentLang = "ja";
    else if (bl.startsWith("zh")) currentLang = "zh-TW";
}

function updateUI() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[currentLang] && translations[currentLang][key]) {
            el.innerHTML = translations[currentLang][key];
        }
    });

    // Update the nav dropdown button display
    const flagEl = document.getElementById("langSelectFlag");
    const labelEl = document.getElementById("langSelectLabel");
    if (flagEl && langConfig[currentLang]) flagEl.textContent = langConfig[currentLang].flag;
    if (labelEl && langConfig[currentLang]) labelEl.textContent = langConfig[currentLang].label;

    // Update active state on dropdown items
    document.querySelectorAll("#langDropdown li").forEach(li => {
        li.classList.toggle("active", li.dataset.lang === currentLang);
    });
}

function translateStr(key) {
    return (translations[currentLang] && translations[currentLang][key]) ? translations[currentLang][key] : key;
}

document.addEventListener("DOMContentLoaded", () => {
    // ---- Navbar language dropdown ----
    const langSelectBtn = document.getElementById("langSelectBtn");
    const langDropdown = document.getElementById("langDropdown");
    const langSelectWrapper = document.getElementById("langSelectWrapper");

    if (langSelectBtn && langDropdown) {
        langSelectBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle("open");
        });

        langDropdown.querySelectorAll("li").forEach(li => {
            li.addEventListener("click", () => {
                currentLang = li.dataset.lang;
                window.currentLang = currentLang;
                langDropdown.classList.remove("open");
                updateUI();
            });
        });

        // Close dropdown on outside click
        document.addEventListener("click", () => langDropdown.classList.remove("open"));
    }

    // ---- Agent Language Pill Selector ----
    const agentLangBtns = document.querySelectorAll(".agent-lang-option");
    const agentLangInput = document.getElementById("agentLang");

    agentLangBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            agentLangBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (agentLangInput) agentLangInput.value = btn.dataset.langValue;
        });
    });

    updateUI();
});

window.translateStr = translateStr;
window.currentLang = currentLang;
