// Conversations Management & Sidebar List Logic

window.activeConversationId = null;

document.addEventListener("DOMContentLoaded", () => {
    const newChatBtn = document.getElementById("new-chat-btn");
    const logoutBtn = document.getElementById("logout-btn");

    // Toggle sidebars (mobile behavior)
    const sidebar = document.getElementById("sidebar");
    const sidebarOpenBtn = document.getElementById("sidebar-open-btn");
    const sidebarCloseBtn = document.getElementById("sidebar-close-btn");

    if (sidebarOpenBtn && sidebar) {
        sidebarOpenBtn.addEventListener("click", () => {
            sidebar.classList.add("active");
        });
    }

    if (sidebarCloseBtn && sidebar) {
        sidebarCloseBtn.addEventListener("click", () => {
            sidebar.classList.remove("active");
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            startNewChatSession();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                const res = await fetch("/api/auth/logout", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    window.location.href = "/";
                }
            } catch (e) {
                console.error("Logout request failed: ", e);
            }
        });
    }

    // Load initial list from Api
    loadConversationsList();
});

async function loadConversationsList() {
    const listContainer = document.getElementById("history-container");
    if (!listContainer) return;

    try {
        const response = await fetch("/api/conversations");
        const res = await response.json();

        if (!res.success) {
            listContainer.innerHTML = `<div class="history-empty">Error: ${res.error}</div>`;
            return;
        }

        const convs = res.conversations;
        if (!convs || convs.length === 0) {
            listContainer.innerHTML = '<div class="history-empty">No conversation history</div>';
            return;
        }

        // Group
        const groups = groupConversations(convs);
        listContainer.innerHTML = "";

        // Today Group
        if (groups.today.length > 0) {
            renderGroup(listContainer, "Today", groups.today);
        }
        // Yesterday Group
        if (groups.yesterday.length > 0) {
            renderGroup(listContainer, "Yesterday", groups.yesterday);
        }
        // Older Group
        if (groups.older.length > 0) {
            renderGroup(listContainer, "Older", groups.older);
        }

    } catch (err) {
        listContainer.innerHTML = '<div class="history-empty">Failed to load history</div>';
    }
}

function groupConversations(convs) {
    const today = [];
    const yesterday = [];
    const older = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    convs.forEach(c => {
        const dateStr = c.updated_at || c.created_at;
        const uDate = new Date(dateStr);
        if (uDate >= startOfToday) {
            today.push(c);
        } else if (uDate >= startOfYesterday) {
            yesterday.push(c);
        } else {
            older.push(c);
        }
    });

    return { today, yesterday, older };
}

function renderGroup(container, title, items) {
    const groupBlock = document.createElement("div");
    groupBlock.className = "history-group";

    const groupHeader = document.createElement("div");
    groupHeader.className = "history-group-title";
    groupHeader.innerText = title;
    groupBlock.appendChild(groupHeader);

    items.forEach(item => {
        const itemBtn = document.createElement("button");
        itemBtn.className = "history-item";
        if (window.activeConversationId === item.id) {
            itemBtn.classList.add("active");
        }
        itemBtn.setAttribute("data-id", item.id);

        // Bind click selection
        itemBtn.addEventListener("click", (e) => {
            // Confirm we aren't clicking delete
            if (e.target.closest(".history-item-delete")) return;
            selectConversation(item.id, item.title);

            // Collapses sidebar on mobile screen
            const sidebar = document.getElementById("sidebar");
            if (sidebar) sidebar.classList.remove("active");
        });

        const leftSide = document.createElement("div");
        leftSide.className = "history-item-left";
        leftSide.innerHTML = `<i class="fa-regular fa-comment"></i><span class="history-item-title">${escapeHTML(item.title)}</span>`;
        itemBtn.appendChild(leftSide);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "history-item-delete";
        deleteBtn.title = "Delete Conversation";
        deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteConversationSession(item.id);
        });
        itemBtn.appendChild(deleteBtn);

        groupBlock.appendChild(itemBtn);
    });

    container.appendChild(groupBlock);
}

function startNewChatSession() {
    window.activeConversationId = null;
    document.getElementById("chat-title").innerText = "New Conversation";

    // Clear active status
    document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active"));

    // Unhide empty state body, clean comments
    const emptyState = document.getElementById("chat-empty-state");
    const chatBody = document.getElementById("chat-body");

    // Clean old bubbles, keep empty state visible
    const messages = chatBody.querySelectorAll(".message-row");
    messages.forEach(m => m.remove());
    if (emptyState) {
        emptyState.classList.remove("hidden");
    }
}

async function selectConversation(id, title) {
    window.activeConversationId = id;
    document.getElementById("chat-title").innerText = title;

    // highlight sidebar
    document.querySelectorAll(".history-item").forEach(el => {
        el.classList.remove("active");
        if (el.getAttribute("data-id") === id) {
            el.classList.add("active");
        }
    });

    // Make message loading call
    const chatBody = document.getElementById("chat-body");
    const emptyState = document.getElementById("chat-empty-state");

    // Clear previous bubbles
    chatBody.querySelectorAll(".message-row").forEach(m => m.remove());
    if (emptyState) emptyState.classList.add("hidden");

    // Show spinner helper inside chat
    const loadingText = document.createElement("div");
    loadingText.className = "message-row system";
    loadingText.innerHTML = '<div style="margin: auto; color: var(--text-secondary);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading context...</div>';
    chatBody.appendChild(loadingText);

    try {
        const response = await fetch(`/api/conversations/${id}/messages`);
        const res = await response.json();
        loadingText.remove();

        if (res.success && res.messages) {
            res.messages.forEach(msg => {
                appendMessageBubble(msg.role, msg.content, msg.created_at);
            });
            scrollToBottom();
        } else {
            appendMessageBubble("system", "Failed to retrieve conversation history.");
        }
    } catch (err) {
        loadingText.remove();
        appendMessageBubble("system", "Network connection issues syncing log.");
    }
}

async function deleteConversationSession(id) {
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) return;

    try {
        const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        const res = await response.json();
        if (res.success) {
            if (window.activeConversationId === id) {
                startNewChatSession();
            }
            loadConversationsList();
        } else {
            alert("Failed to delete matching log: " + res.error);
        }
    } catch (e) {
        alert("Network error deleting conversation.");
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Share helper function so chat.js can hook into rendering logs
window.loadConversationsList = loadConversationsList;
window.startNewChatSession = startNewChatSession;
