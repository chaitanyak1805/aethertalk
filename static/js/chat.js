// Chat interface event handlers: Form submissions, message bubble builders, Markdown formatting

document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chat-form");
    const messageInput = document.getElementById("message-input");
    const chatBody = document.getElementById("chat-body");
    const emptyState = document.getElementById("chat-empty-state");

    // Auto-adjust height of textarea
    if (messageInput) {
        messageInput.addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = (this.scrollHeight) + "px";
        });

        // Submit on Enter, carriage return on Shift + Enter
        messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event("submit"));
            }
        });
    }

    if (chatForm) {
        chatForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const rawMessage = messageInput.value.trim();
            if (!rawMessage) return;

            // Clear input box
            messageInput.value = "";
            messageInput.style.height = "auto";

            // Hide empty state if first message
            if (emptyState) emptyState.classList.add("hidden");

            // Stop any playing speech voiceovers
            if (window.haltVoicePipeline) window.haltVoicePipeline();

            // Append user message immediately
            appendMessageBubble("user", rawMessage);
            scrollToBottom();

            // Add typing indicator bubble
            const typingBubble = appendTypingIndicator();
            scrollToBottom();

            // Disable input area
            toggleInputDisabled(true);

            const activeModel = document.getElementById("model-select")?.value || "openai/gpt-oss-120b";

            try {
                const response = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: rawMessage,
                        conversation_id: window.activeConversationId,
                        model: activeModel
                    })
                });

                // Remove typing bubble
                typingBubble.remove();

                const res = await response.json();
                if (res.success) {
                    // Update active conversation details if new chat
                    if (res.new_conversation_created) {
                        window.activeConversationId = res.conversation_id;
                        document.getElementById("chat-title").innerText = res.conversation_title;
                        if (window.loadConversationsList) window.loadConversationsList();
                    }

                    // Append bot bubble
                    appendMessageBubble("assistant", res.assistant_message.content, res.assistant_message.created_at);
                    scrollToBottom();
                } else {
                    appendMessageBubble("system", `System Error: ${res.error}`);
                    scrollToBottom();
                }

            } catch (err) {
                typingBubble.remove();
                appendMessageBubble("system", "Transmission error: Unable to contact chatbot engine.");
                scrollToBottom();
            } finally {
                toggleInputDisabled(false);
            }
        });
    }

    // Set starter prompt handlers
    document.querySelectorAll(".prompt-starter-card").forEach(card => {
        card.addEventListener("click", () => {
            const prompt = card.getAttribute("data-prompt");
            if (messageInput && prompt) {
                messageInput.value = prompt;
                messageInput.dispatchEvent(new Event("input"));
                messageInput.focus();
            }
        });
    });
});

function toggleInputDisabled(disabled) {
    const input = document.getElementById("message-input");
    const send = document.getElementById("send-button");
    const mic = document.getElementById("voice-input-btn");

    if (input) input.disabled = disabled;
    if (send) send.disabled = disabled;
    if (mic) mic.disabled = disabled;
}

function appendMessageBubble(role, content, timestamp = null) {
    const chatBody = document.getElementById("chat-body");
    if (!chatBody) return;

    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const card = document.createElement("div");
    card.className = "message-card";

    // Header (Author + Timestamp)
    const header = document.createElement("div");
    header.className = `message-header ${role === 'user' ? 'user' : ''}`;

    const authorSpan = document.createElement("span");
    authorSpan.style.fontWeight = "600";
    authorSpan.innerText = role === "user" ? "You" : (role === "system" ? "System" : "Aether Assistant");
    header.appendChild(authorSpan);

    const timeSpan = document.createElement("span");
    timeSpan.style.opacity = "0.7";
    timeSpan.innerText = getFormattedTime(timestamp);
    header.appendChild(timeSpan);

    card.appendChild(header);

    // Message Bubble wrapper
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (role === "assistant") {
        bubble.innerHTML = formatMarkdown(content);
    } else {
        bubble.innerText = content; // User queries rendered inside plain escape string block
    }
    card.appendChild(bubble);

    // Actions under Assistant text
    if (role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        // Listen voice playback button
        const voiceBtn = document.createElement("button");
        voiceBtn.className = "bubble-action-btn voice-bubble-btn";
        voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
        voiceBtn.addEventListener("click", () => {
            // Strip markdown from content before reading aloud to make synthesis audio cleaner
            const textToRead = bubble.innerText;
            if (window.triggerSpeechSynthesizer) {
                window.triggerSpeechSynthesizer(textToRead, voiceBtn);
            }
        });
        actions.appendChild(voiceBtn);

        // Copy button
        const copyBtn = document.createElement("button");
        copyBtn.className = "bubble-action-btn";
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                }, 2000);
            });
        });
        actions.appendChild(copyBtn);

        card.appendChild(actions);
    }

    row.appendChild(card);
    chatBody.appendChild(row);
}

function appendTypingIndicator() {
    const chatBody = document.getElementById("chat-body");
    const row = document.createElement("div");
    row.className = "message-row assistant typing-wrap";

    const card = document.createElement("div");
    card.className = "message-card";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";

    bubble.appendChild(indicator);
    card.appendChild(bubble);
    row.appendChild(card);
    chatBody.appendChild(row);
    return row;
}

function getFormattedTime(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const chatBody = document.getElementById("chat-body");
    if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
    }
}

// Lightweight secure Markdown Parser for assistant outputs
function formatMarkdown(text) {
    if (!text) return "";

    // Escape basic HTML tag nodes to prevent injection
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Code blocks with syntax wrappers
    html = html.replace(/```([\s\S]*?)```/g, (match, block) => {
        return `<pre><code>${block.trim()}</code></pre>`;
    });

    // Inline ticks code snippets
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold symbols
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic symbols
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers tags formatting
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Lists (nested matches / normal bullethooks)
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');

    // Replace double newlines with paragraphs
    // Make sure we don't break code blocks during matching
    const blocks = html.split(/\n\n+/);
    const reformattedBlocks = blocks.map(block => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("<pre>") || trimmed.startsWith("<h3>") || trimmed.startsWith("<h2>") || trimmed.startsWith("<h1>") || trimmed.startsWith("<li>")) {
            return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    });

    return reformattedBlocks.join("");
}

// Shares elements for conversation reload hooks
window.appendMessageBubble = appendMessageBubble;
window.scrollToBottom = scrollToBottom;
