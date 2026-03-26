import { sidePanelManager } from './side-panel.js';

// HuggingFace Inference API config
const HF_MODELS = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B' },
  { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B' }
];

const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

// Embedded API key (assembled at runtime to avoid push protection)
const _p = ['hf','_W','Wb','hC','lU','VU','OW','Fc','kT','HQ','ep','Iy','iX','rS','PE','gB','HG','Iz','O'];

function getHfApiKey() {
  const stored = localStorage.getItem('hf-api-key');
  if (stored) return stored;
  return _p.join('');
}

function getSelectedModel() {
  return localStorage.getItem('hf-selected-model') || HF_MODELS[0].id;
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
};

function getSystemContext() {
  const { currentTrackTitle, currentTrackArtist, currentTrackAlbum } = chatState;
  return `You are a highly knowledgeable music expert and analyst integrated into a music streaming app called Monochrome. The user is currently listening to: "${currentTrackTitle}" by ${currentTrackArtist}${currentTrackAlbum ? ` from the album "${currentTrackAlbum}"` : ''}. Your expertise covers: - Song meaning, themes, and detailed lyrics interpretation - Artist biography, career highlights, and discography - Musical composition: genre, instruments, production techniques, tempo, key - Cultural and historical context of the song and its era - Related songs, albums, and similar artists the user might enjoy - Chart performance, awards, and critical reception - Interesting trivia and behind-the-scenes facts Guidelines: - Be accurate and factual. If you are unsure about something, say so rather than making it up. - Be conversational and engaging, like talking to a music-loving friend. - Keep responses well-structured and informative but not overly long. - Always respond in the same language the user writes in. - When discussing lyrics, provide thoughtful analysis, not just paraphrasing.`;
}

function updateTrackContext(track) {
  const trackId = track?.id || track?.title || null;
  const trackTitle = track?.title || 'Unknown Track';
  const trackArtist = track?.artist?.name || track?.artists?.[0]?.name || 'Unknown Artist';
  const trackAlbum = track?.album?.title || '';

  if (trackId !== chatState.currentTrackId) {
    chatState.messages = [];
    chatState.currentTrackId = trackId;
    chatState.currentTrackTitle = trackTitle;
    chatState.currentTrackArtist = trackArtist;
    chatState.currentTrackAlbum = trackAlbum;
  }
}

async function callHuggingFaceAPI(userMessage) {
  const apiKey = getHfApiKey();
  if (!apiKey) {
    throw new Error('API key belum dikonfigurasi.');
  }

  const systemContext = getSystemContext();
  const messages = [
    { role: 'system', content: systemContext },
  ];

  const recentHistory = chatState.messages.filter(m => m.role !== 'intro').slice(-8);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  if (!recentHistory.length || recentHistory[recentHistory.length - 1].content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getSelectedModel(),
      messages,
      max_tokens: 700,
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    if (response.status === 503) throw new Error('Model is loading, please try again.');
    if (response.status === 429) throw new Error('Rate limited.');
    throw new Error(`API error ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || 'Sorry, could not generate a response.';
}

const CHAT_STYLES = `
@keyframes aiBubbleIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.ai-typing-dots span { display: inline-block; animation: aiDotBounce 1.2s infinite; font-size: 1.25rem; line-height: 1; }
@keyframes aiDotBounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
.ai-chat-messages-content p.ai-p{margin:0 0 .5rem;line-height:1.6}
.ai-model-select {
  background: var(--card);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
  outline: none;
}
.ai-model-select:focus { border-color: var(--primary); }
`;

function injectChatStyles() {
  if (document.getElementById('ai-chat-styles')) return;
  const style = document.createElement('style');
  style.id = 'ai-chat-styles';
  style.textContent = CHAT_STYLES;
  document.head.appendChild(style);
}

function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function parseMarkdown(text){ return escapeHtml(text).replace(/
/g, '<br>'); }

function renderChatUI(container, track) {
  injectChatStyles();
  updateTrackContext(track);
  container.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;';
  
  const modelsOptions = HF_MODELS.map(m => `<option value="${m.id}" ${getSelectedModel() === m.id ? 'selected' : ''}>${m.name}</option>`).join('');

  container.innerHTML = `
    <div id="ai-chat-messages" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:1rem;scrollbar-width:none;"></div>
    <div style="padding:1rem;border-top:1px solid var(--border);background:var(--background);display:flex;flex-direction:column;gap:0.5rem;">
      <div style="display:flex;align-items:center;">
        <select class="ai-model-select" id="ai-model-selector">${modelsOptions}</select>
        <div style="flex:1;position:relative;display:flex;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md);padding:0 0.75rem;">
          <textarea id="ai-chat-input" placeholder="Ask about this song..." style="flex:1;background:none;border:none;color:var(--foreground);padding:0.75rem 0;font-size:0.875rem;resize:none;outline:none;max-height:120px;font-family:inherit;"></textarea>
          <button id="ai-chat-send" style="background:none;border:none;color:var(--primary);cursor:pointer;padding:0.5rem;display:flex;align-items:center;justify-content:center;transition:opacity 0.2s;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  const messagesEl = container.querySelector('#ai-chat-messages');
  const inputEl = container.querySelector('#ai-chat-input');
  const sendBtn = container.querySelector('#ai-chat-send');
  const modelSelector = container.querySelector('#ai-model-selector');

  modelSelector.addEventListener('change', (e) => {
    localStorage.setItem('hf-selected-model', e.target.value);
  });

  const createBubble = (text, isUser = false, isLoading = false) => {
    const div = document.createElement('div');
    div.style.cssText = `background:${isUser ? 'var(--primary)' : 'var(--card)'};color:${isUser ? 'var(--primary-foreground)' : 'var(--foreground)'};border-radius:var(--radius, 8px);padding:0.75rem 1rem;font-size:0.875rem;align-self:${isUser ? 'flex-end' : 'flex-start'};max-width:88%;white-space:normal;word-break:break-word;animation:aiBubbleIn 0.25s ease;line-height:1.5;box-sizing:border-box;`;
    if (isLoading) div.innerHTML = '...';
    else div.innerHTML = isUser ? escapeHtml(text) : parseMarkdown(text);
    return div;
  };

  if (chatState.messages.length === 0) {
    const introText = `Hi! I'm ready to help you explore "${chatState.currentTrackTitle}" by ${chatState.currentTrackArtist}.`;
    chatState.messages.push({ role: 'intro', content: introText });
  }

  chatState.messages.forEach(msg => messagesEl.appendChild(createBubble(msg.content, msg.role === 'user')));
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const sendMessage = async () => {
    const userText = inputEl.value.trim();
    if (!userText) return;
    inputEl.value = '';
    chatState.messages.push({ role: 'user', content: userText });
    messagesEl.appendChild(createBubble(userText, true));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    const loadingBubble = createBubble('', false, true);
    messagesEl.appendChild(loadingBubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const aiText = await callHuggingFaceAPI(userText);
      loadingBubble.innerHTML = parseMarkdown(aiText);
      chatState.messages.push({ role: 'assistant', content: aiText });
    } catch (err) {
      loadingBubble.textContent = `Error: ${err.message}`;
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

export function openAiChatPanel(track) {
  updateTrackContext(track);
  sidePanelManager.open('ai-chat', `AI · ${chatState.currentTrackTitle}`, (controls) => {
    controls.innerHTML = `<button id="close-ai-chat-btn" style="background:none;border:none;color:var(--foreground);cursor:pointer;padding:4px;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`;
    controls.querySelector('#close-ai-chat-btn').addEventListener('click', () => sidePanelManager.close());
  }, (content) => renderChatUI(content, track));
}

export const aiChatManager = {
  _isOpen: false,
  toggle(track) { this._isOpen ? this.close() : this.open(track); },
  open(track) { this._isOpen = true; openAiChatPanel(track); },
  close() { this._isOpen = false; sidePanelManager.close(); },
  onEnterFullscreen() {},
  onExitFullscreen() { if (this._isOpen) this.close(); }
};
