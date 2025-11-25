/******************************************************
 *  LLM 多平台提问导航插件 - content.js (2025 修复版)
 *  支持：ChatGPT / Gemini / Claude / DeepSeek
 ******************************************************/

///////////////////////////////////////////////////////
// URL 变化检测（切换会话时清空历史记录）
///////////////////////////////////////////////////////
let lastUrl = location.href;

setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        onConversationChanged();
    }
}, 800);

function onConversationChanged() {
    console.log("[LLM-Jump] Conversation changed → Reset");
    questionList = [];
    const list = document.getElementById("qjump-list");
    if (list) list.innerHTML = "";
}

///////////////////////////////////////////////////////
// 平台识别
///////////////////////////////////////////////////////
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

///////////////////////////////////////////////////////
// 用户消息选择器（2025 多层级兼容版）
///////////////////////////////////////////////////////
const USER_SELECTORS = {
    "chatgpt": [
        "[data-message-author-role='user']",
        "div[data-testid*='user']",
        ".group.w-full"
    ],
    "gemini": [
        "message-content[query-text]",
        "div.query-text",
        "[data-test-id='user-message']",
        ".user-message"
    ],
    "claude": [
        "div[data-is-user-message='true']",
        "div.font-user-message",
        "[data-test-render-count]"
    ],
    "deepseek": [
        ".ds-message--user",
        "div[data-role='user']",
        ".message-user"
    ]
};

let platform = detectPlatform();
let selectorList = USER_SELECTORS[platform] || [];
let questionList = [];

console.log("[LLM-Jump] Platform:", platform);
console.log("[LLM-Jump] Selectors:", selectorList);

///////////////////////////////////////////////////////
// 初始化
///////////////////////////////////////////////////////
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function init(){
    await sleep(1500);  // 增加等待时间
    addSidebarUI();
    monitorQuestions();
    
    // 调试：输出页面结构样本
    setTimeout(debugPageStructure, 3000);
}

init();

///////////////////////////////////////////////////////
// 调试函数：输出页面结构
///////////////////////////////////////////////////////
function debugPageStructure() {
    console.log("[LLM-Jump] === 页面结构调试 ===");
    console.log("当前平台:", platform);
    
    // 尝试找出所有可能的消息容器
    const possibleContainers = [
        ...document.querySelectorAll('[class*="message"]'),
        ...document.querySelectorAll('[data-message]'),
        ...document.querySelectorAll('[data-testid]'),
        ...document.querySelectorAll('[role="article"]')
    ].slice(0, 5); // 只看前5个
    
    console.log("找到的可能消息容器:", possibleContainers.length);
    
    possibleContainers.forEach((el, i) => {
        console.log(`[${i}]`, {
            tag: el.tagName,
            classes: el.className,
            dataAttrs: Array.from(el.attributes)
                .filter(a => a.name.startsWith('data-'))
                .map(a => `${a.name}=${a.value}`),
            text: el.innerText.slice(0, 50)
        });
    });
}

///////////////////////////////////////////////////////
// 监控用户问题（多选择器尝试版）
///////////////////////////////////////////////////////
function monitorQuestions() {
    if (selectorList.length === 0) {
        console.warn("[LLM-Jump] 未知平台，无选择器");
        return;
    }

    console.log("[LLM-Jump] 开始监控，尝试选择器:", selectorList);

    function scan() {
        let found = false;
        
        // 依次尝试每个选择器
        for (const selector of selectorList) {
            try {
                const msgs = document.querySelectorAll(selector);
                
                if (msgs.length > 0) {
                    if (!found) {
                        console.log(`[LLM-Jump] ✓ 有效选择器: ${selector} (找到 ${msgs.length} 条)`);
                        found = true;
                    }
                    
                    msgs.forEach((msg) => {
                        if (!msg.dataset.qid) {
                            msg.dataset.qid = "question_" + questionList.length;
                            
                            // 提取文本（尝试多种方式）
                            let txt = msg.innerText || msg.textContent || "";
                            txt = txt.trim().slice(0, 80);
                            
                            if (txt.length > 0) {
                                questionList.push({ 
                                    id: msg.dataset.qid, 
                                    text: txt,
                                    element: msg
                                });
                                console.log(`[LLM-Jump] 新问题: ${txt.slice(0, 30)}...`);
                                updateSidebar();
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn(`[LLM-Jump] 选择器失败: ${selector}`, e);
            }
        }
        
        if (!found && questionList.length === 0) {
            console.warn("[LLM-Jump] 所有选择器都未找到消息");
        }
    }

    // 定时扫描
    setInterval(scan, 1500);

    // MutationObserver
    const observer = new MutationObserver(() => {
        setTimeout(scan, 200); // 延迟一点确保DOM更新完成
    });
    
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        characterData: true  // 监听文本变化
    });

    // 立即扫描一次
    scan();
}

///////////////////////////////////////////////////////
// UI：侧栏 + 气泡按钮
///////////////////////////////////////////////////////
function addSidebarUI(){
    if (document.getElementById("qjump-btn")) return;

    const btn = document.createElement("div");
    btn.id = "qjump-btn";
    btn.innerText = "Q";
    btn.title = "问题导航";
    document.body.appendChild(btn);
    btn.onclick = toggleSidebar;

    const panel = document.createElement("div");
    panel.id = "qjump-panel";
    panel.innerHTML = `
        <div class='title'>历史问题 (${platform})</div>
        <div class='debug-info' style='font-size:11px; color:#999; margin:5px 0;'>
            等待检测消息...
        </div>
        <ul id='qjump-list'></ul>
    `;
    document.body.appendChild(panel);
}

function toggleSidebar(){
    const panel = document.getElementById("qjump-panel");
    panel.classList.toggle("open");
}

///////////////////////////////////////////////////////
// UI 更新：刷新历史问题列表
///////////////////////////////////////////////////////
function updateSidebar(){
    const list = document.getElementById("qjump-list");
    const debugInfo = document.querySelector(".debug-info");
    
    if (!list) return;

    if (questionList.length === 0) {
        list.innerHTML = "<li style='color:#999; font-size:12px;'>暂无问题记录</li>";
        if (debugInfo) {
            debugInfo.innerText = `已扫描，但未找到消息 (${selectorList.join(', ')})`;
        }
        return;
    }
    
    if (debugInfo) {
        debugInfo.innerText = `已找到 ${questionList.length} 条问题`;
    }

    list.innerHTML = "";
    questionList.forEach((q, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `<span style='color:#999; font-size:11px;'>${idx + 1}.</span> ${q.text}`;
        li.onclick = () => {
            const target = q.element || document.querySelector(`[data-qid='${q.id}']`);
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.style.backgroundColor = "#fffacd"; // 高亮
                setTimeout(() => { target.style.backgroundColor = ""; }, 1500);
            }
        };
        list.appendChild(li);
    });
}