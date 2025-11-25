// ========== URL 变化检测（用于检测切换会话） ==========
let lastUrl = location.href;

setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        onConversationChanged();
    }
}, 800);

// ========== 平台识别 ==========
function detectPlatform() {
    const url = location.href;

    if (url.includes("chat.openai.com") || url.includes("chatgpt.com"))
        return "chatgpt";

    if (url.includes("gemini.google.com"))
        return "gemini";

    if (url.includes("claude.ai"))
        return "claude";

    if (url.includes("deepseek.com"))
        return "deepseek";

    return "unknown";
}

// ========== 各平台用户消息选择器 ==========
const USER_SELECTORS = {
    "chatgpt": "[data-message-author-role='user']",
    "gemini": "div[role='listitem'] .user-content, .hYh2cc",
    "claude": ".message.user, [data-author='user']",
    "deepseek": ".chat-message.user"
};

let platform = detectPlatform();
let userSelector = USER_SELECTORS[platform];
let questionList = [];

function onConversationChanged() {
    console.log("[LLM-Jump] Conversation changed → Reset");

    questionList = [];

    const list = document.getElementById("qjump-list");
    if (list) list.innerHTML = "";
}

// ========== 初始化 ==========
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function init(){
    await sleep(1000);  // 等待页面渲染
    addSidebarUI();
    monitorQuestions();
}

init();

// ========== 监听用户提问 ==========
function monitorQuestions() {
    if (!userSelector) {
        console.warn("[LLM-Jump] Unknown platform, no selector");
        return;
    }

    const observer = new MutationObserver(() => {
        const msgs = document.querySelectorAll(userSelector);

        msgs.forEach((msg) => {
            if (!msg.dataset.qid) {
                msg.dataset.qid = "question_" + questionList.length;
                const txt = msg.innerText.trim().slice(0, 50);
                questionList.push({ id: msg.dataset.qid, text: txt || "(空消息)" });
                updateSidebar();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// ========== UI ==========
function addSidebarUI(){
    const btn = document.createElement("div");
    btn.id = "qjump-btn";
    btn.innerText = "Q";
    document.body.appendChild(btn);
    btn.onclick = toggleSidebar;

    const panel = document.createElement("div");
    panel.id = "qjump-panel";
    panel.innerHTML = "<div class='title'>历史问题</div><ul id='qjump-list'></ul>";
    document.body.appendChild(panel);
}

function toggleSidebar(){
    const panel = document.getElementById("qjump-panel");
    panel.classList.toggle("open");
}

function updateSidebar(){
    const list = document.getElementById("qjump-list");
    if (!list) return;

    list.innerHTML = "";
    questionList.forEach(q => {
        const li = document.createElement("li");
        li.innerText = q.text;
        li.onclick = () => {
            const target = document.querySelector(`[data-qid='${q.id}']`);
            if (target)
                target.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        list.appendChild(li);
    });
}
