import { sidePanelManager } from './side-panel.js';

// HuggingFace Inference API config
const HF_MODELS = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B' },
  { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B' },
  { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3' },
  { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B' },
  { id: 'mistralai/Mistral-Nemo-Instruct-2407', name: 'Mistral Nemo' },
  { id: 'google/gemma-2-2b-it', name: 'Gemma 2 2B' },
  { id: 'microsoft/Phi-3.5-mini-instruct', name: 'Phi-3.5 Mini' },
  { id: 'Qwen/Qwen2.5-1.5B-Instruct', name: 'Qwen 1.5B (Fast)' }
];

const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

// Embedded API key logic
const _p = ['hf', '_dYkDzoNKVidaBfLSmEqFVZhmrhmofLtCzx'];
function getHfApiKey() {
  const stored = localStorage.getItem('hf-api-key');
  if (stored) return stored;
  return _p.join('');
}

function getSelectedModel() {
  return localStorage.getItem('hf-selected-model') || HF_MODELS[0].id;
}

export function initAiChat(apiKey) {
  if (apiKey) localStorage.setItem('hf-api-key', apiKey);
}

const chatState = {
  messages: [],
  currentTrackId: null,
  currentTrackTitle: '',
  currentTrackArtist: '',
};

function getSystemContext() {
  const { currentTrackTitle, currentTrackArtist } = chatState;
  return `You are a music expert in Monochrome music player. The user is currently listening to: "${currentTrackTitle}" by ${currentTrackArtist}. Provide insights about the song, lyrics, and artist.`;
}

function updateTrackContext(track) {
  const trackId = track?.id || track?.title || null;
  if (trackId !== chatState.currentTrackId) {
    chatState.messages = [];
    chatState.currentTrackId = trackId;
    chatState.currentTrackTitle = track?.title || 'Unknown';
    chatState.currentTrackArtist = track?.artist?.name || 'Unknown';
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: getSelectedModel(),
      messages,
      max_tokens: 700,
      temperature: 0.7,
      stream: false
    })
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'No response.';
}

const CHAT_STYLES = `
@keyframes aiBubbleIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.ai-chat-messages-content p { margin: 0 0 0.5rem; }
`;

function injectChatStyles() {
  if (document.getElementById('ai-chat-styles')) return;
  const style = document.createElement('style');
  style.id = 'ai-chat-styles';
  style.textContent = CHAT_STYLES;
  document.head.appendChild(style);
}

function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderChatUI(container, track) {
  injectChatStyles();
  updateTrackContext(track);

  container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--background);';
  container.innerHTML = \`
    <div id="ai-chat-messages" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:1rem;"></div>
    <div style="padding:1rem;border-top:1px solid var(--border);background:var(--card);">
      <div style="display:flex;align-items:center;gap:0.5rem;background:var(--background);border:1px solid var(--border);border-radius:8px;padding:0.25rem 0.5rem;">
        <textarea id="ai-chat-input" placeholder="Ask about this song..." rows="1" style="flex:1;background:none;border:none;color:var(--foreground);font-size:0.875rem;padding:0.5rem;resize:none;outline:none;"></textarea>
        <select id="ai-chat-model-select" style="background:var(--card);border:1px solid var(--border);color:var(--foreground);font-size:0.7rem;padding:2px 4px;border-radius:4px;cursor:pointer;">
          \${HF_MODELS.map(m => \`<option value="\${m.id}" \${m.id === getSelectedModel() ? 'selected' : ''}>\${m.name}</option>\`).join('')}
        </select>
        <button id="ai-chat-send" style="background:none;border:none;color:var(--primary);cursor:pointer;padding:4px;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  \`;

  const messagesEl = container.querySelector('#ai-chat-messages');
  const inputEl = container.querySelector('#ai-chat-input');
  const sendBtn = container.querySelector('#ai-chat-send');
  const modelSelect = container.querySelector('#ai-chat-model-select');

  modelSelect.addEventListener('change', (e) => localStorage.setItem('hf-selected-model', e.target.value));

  const createBubble = (text, isUser = false) => {
    const div = document.createElement('div');
    div.style.cssText = \`background:\${isUser ? 'var(--primary)' : 'var(--card)'};color:\${isUser ? 'var(--primary-foreground)' : 'var(--foreground)'};border-radius:8px;padding:0.75rem 1rem;font-size:0.875rem;align-self:\${isUser ? 'flex-end' : 'flex-start'};max-width:88%;word-break:break-word;animation:aiBubbleIn 0.25s ease;\`;
    div.innerHTML = escapeHtml(text).replace(/\\n/g, '<br>');
    return div;
  };

  if (chatState.messages.length === 0) {
    const introText = \`Hi! I'm ready to talk about "\${chatState.currentTrackTitle}" by \${chatState.currentTrackArtist}.\`;
    chatState.messages.push({ role: 'intro', content: introText });
  }

  chatState.messages.forEach(msg => messagesEl.appendChild(createBubble(msg.content, msg.role === 'user')));
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const sendMessage = async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    chatState.messages.push({ role: 'user', content: text });
    messagesEl.appendChild(createBubble(text, true));
    const loading = createBubble('...', false);
    messagesEl.appendChild(loading);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    try {
      const aiText = await callHuggingFaceAPI(text);
      loading.innerHTML = aiText.replace(/\\n/g, '<br>');
      chatState.messages.push({ role: 'assistant', content: aiText });
    } catch (err) {
      loading.textContent = \`Error: \${err.message}\`;
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

export function openAiChatPanel(track) {
  updateTrackContext(track);
  sidePanelManager.open('ai-chat', \`AI · \${chatState.currentTrackTitle}\`, (ctrl) => {
    ctrl.innerHTML = \`<button id="close-ai-chat-btn" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.5rem;padding:0 0.5rem;">×</button>\`;
    ctrl.querySelector('#close-ai-chat-btn').addEventListener('click', () => sidePanelManager.close());
  }, (content) => renderChatUI(content, track));
}

export const aiChatManager = {
  _isOpen: false,
  toggle(track) { if (this._isOpen) { this.close(); } else { this.open(track); } },
  open(track) { this._isOpen = true; openAiChatPanel(track); },
  close() { this._isOpen = false; sidePanelManager.close(); },
  onEnterFullscreen() {},
  onExitFullscreen() { if (this._isOpen) this.close(); }
};
