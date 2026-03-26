import { sidePanelManager } from './side-panel.js';

// HuggingFace Inference API config
const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

const AI_MODELS = [
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
    { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B' },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B' },
    { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini' },
    { id: '01-ai/Yi-1.5-34B-Chat', name: 'Yi 1.5 34B' },
    { id: 'deepseek-ai/deepseek-llm-67b-chat', name: 'DeepSeek 67B' }
];

function getHfApiKey() {
    const stored = localStorage.getItem('hf-api-key');
    if (stored) return stored;
    return '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';
}

export function initAiChat(apiKey) {
    if (apiKey) {
        localStorage.setItem('hf-api-key', apiKey);
    }
}

const chatState = {
    messages: [],
    currentTrackId: null,
    currentTrackTitle: '',
    currentTrackArtist: '',
    currentTrackAlbum: '',
    currentModel: AI_MODELS[0].id
};

function getSystemContext() {
    const { currentTrackTitle, currentTrackArtist, currentTrackAlbum } = chatState;
    return `You are a highly knowledgeable music expert and analyst integrated into a music streaming app called Monochrome. The user is currently listening to: "${currentTrackTitle}" by ${currentTrackArtist}${currentTrackAlbum ? ` from the album "${currentTrackAlbum}"` : ''}. Your expertise covers song meaning, themes, artist biography, and musical composition. Always respond in the same language the user writes in.`;
}

function updateTrackContext(track) {
    const trackId = track?.id || track?.title || null;
    if (trackId !== chatState.currentTrackId) {
        chatState.messages = [];
        chatState.currentTrackId = trackId;
        chatState.currentTrackTitle = track?.title || 'Unknown Track';
        chatState.currentTrackArtist = track?.artist?.name || track?.artists?.[0]?.name || 'Unknown Artist';
        chatState.currentTrackAlbum = track?.album?.title || '';
    }
}

async function callHuggingFaceAPI(userMessage) {
    const apiKey = getHfApiKey();
    const systemContext = getSystemContext();
    const messages = [
        { role: 'system', content: systemContext },
        ...chatState.messages.filter(m => m.role !== 'intro').slice(-8).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
    ];

    const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: chatState.currentModel,
            messages,
            max_tokens: 700,
            temperature: 0.7,
        }),
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || 'No response';
}

function renderChatUI(container, track) {
    updateTrackContext(track);
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;';
    
    container.innerHTML = `
        <div id="ai-chat-messages" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:1rem;scrollbar-width:thin;"></div>
        <div style="padding:1rem;border-top:1px solid var(--border);background:var(--background);display:flex;flex-direction:column;gap:0.5rem;">
            <div style="display:flex;gap:0.5rem;align-items:flex-end;">
                <select id="ai-model-select" style="background:var(--card);color:var(--foreground);border:1px solid var(--border);border-radius:4px;padding:4px;font-size:0.75rem;max-width:120px;outline:none;">
                    ${AI_MODELS.map(m => `<option value="${m.id}" ${m.id === chatState.currentModel ? 'selected' : ''}>${m.name}</option>`).join('')}
                </select>
                <textarea id="ai-chat-input" placeholder="Ask about this song..." style="flex:1;background:var(--card);color:var(--foreground);border:1px solid var(--border);border-radius:8px;padding:0.75rem;font-size:0.875rem;resize:none;max-height:120px;outline:none;transition:border-color 0.2s;"></textarea>
                <button id="ai-chat-send" style="background:var(--primary);color:var(--primary-foreground);border:none;border-radius:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
            </div>
        </div>
    `;

    const messagesEl = container.querySelector('#ai-chat-messages');
    const inputEl = container.querySelector('#ai-chat-input');
    const sendBtn = container.querySelector('#ai-chat-send');
    const modelSelect = container.querySelector('#ai-model-select');

    modelSelect.addEventListener('change', (e) => {
        chatState.currentModel = e.target.value;
    });

    const createBubble = (text, isUser = false) => {
        const div = document.createElement('div');
        div.style.cssText = `background:${isUser ? 'var(--primary)' : 'var(--card)'};color:${isUser ? 'var(--primary-foreground)' : 'var(--foreground)'};border-radius:8px;padding:0.75rem 1rem;font-size:0.875rem;align-self:${isUser ? 'flex-end' : 'flex-start'};max-width:88%;line-height:1.5;`;
        div.textContent = text;
        return div;
    };

    if (chatState.messages.length === 0) {
        const intro = `Hi! I'm ready to help you explore "${chatState.currentTrackTitle}".`;
        chatState.messages.push({ role: 'intro', content: intro });
    }
    chatState.messages.forEach(msg => messagesEl.appendChild(createBubble(msg.content, msg.role === 'user')));
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const sendMessage = async () => {
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = '';
        chatState.messages.push({ role: 'user', content: text });
        messagesEl.appendChild(createBubble(text, true));
        messagesEl.scrollTop = messagesEl.scrollHeight;
        
        const loading = createBubble('...', false);
        messagesEl.appendChild(loading);
        
        try {
            const aiText = await callHuggingFaceAPI(text);
            loading.textContent = aiText;
            chatState.messages.push({ role: 'assistant', content: aiText });
        } catch (err) {
            loading.textContent = `Error: ${err.message}`;
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

export function openAiChatPanel(track) {
    updateTrackContext(track);
    sidePanelManager.open('ai-chat', `AI · ${chatState.currentTrackTitle}`, 
        controls => {
            controls.innerHTML = `<button id="close-ai-chat-btn" style="background:none;border:none;color:var(--foreground);cursor:pointer;padding:4px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
            controls.querySelector('#close-ai-chat-btn').addEventListener('click', () => aiChatManager.close());
        },
        content => renderChatUI(content, track)
    );
}

export const aiChatManager = {
    _isOpen: false,
    toggle(track) { this._isOpen ? this.close() : this.open(track); },
    open(track) { this._isOpen = true; openAiChatPanel(track); },
    close() { this._isOpen = false; sidePanelManager.close(); }
};
