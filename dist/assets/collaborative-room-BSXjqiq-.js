class n{constructor(t){this._player=t,this._roomId=null,this._isHost=!1,this._channel=null,this._participants=[],this._chatMessages=[],this._container=null,this._storageKey="collab-room-state"}renderPage(t){this._container=t,t.innerHTML=`
      <div class="collab-room-page">
        <h1 class="page-title">Collaborative Room</h1>
        <p class="page-subtitle">Listen together with friends in sync</p>

        <div class="collab-join-section">
          <div class="collab-create">
            <h3>Create a Room</h3>
            <p>Start a new listening session and invite friends</p>
            <button class="btn-primary collab-create-btn"><span>Create Room</span></button>
          </div>
          <div class="collab-divider">OR</div>
          <div class="collab-join">
            <h3>Join a Room</h3>
            <input type="text" class="collab-room-input" placeholder="Enter Room ID..." />
            <button class="btn-secondary collab-join-btn"><span>Join Room</span></button>
          </div>
        </div>

        <div class="collab-active-section" style="display:none">
          <div class="collab-room-header">
            <div class="collab-room-info">
              <span class="collab-room-id-label">Room ID:</span>
              <span class="collab-room-id-value"></span>
              <button class="collab-copy-btn" title="Copy Room ID">Copy</button>
            </div>
            <div class="collab-participants">
              <span class="collab-participants-count">1 listener</span>
            </div>
            <button class="btn-danger collab-leave-btn">Leave Room</button>
          </div>

          <div class="collab-now-playing">
            <h3>Now Playing</h3>
            <div class="collab-track-info">
              <span class="collab-track-title">No track playing</span>
              <span class="collab-track-artist"></span>
            </div>
            <div class="collab-sync-status">
              <span class="collab-sync-indicator sync-ok">In Sync</span>
            </div>
          </div>

          <div class="collab-chat">
            <h3>Chat</h3>
            <div class="collab-messages"></div>
            <div class="collab-chat-input">
              <input type="text" class="collab-message-input" placeholder="Say something..." />
              <button class="collab-send-btn">Send</button>
            </div>
          </div>
        </div>
      </div>
    `,this._attachEvents(t)}_attachEvents(t){t.querySelector(".collab-create-btn")?.addEventListener("click",()=>{this._createRoom()}),t.querySelector(".collab-join-btn")?.addEventListener("click",()=>{const e=t.querySelector(".collab-room-input")?.value?.trim();e&&this._joinRoom(e)}),t.querySelector(".collab-room-input")?.addEventListener("keydown",e=>{e.key==="Enter"&&t.querySelector(".collab-join-btn")?.click()}),t.querySelector(".collab-leave-btn")?.addEventListener("click",()=>{this._leaveRoom()}),t.querySelector(".collab-copy-btn")?.addEventListener("click",()=>{const e=t.querySelector(".collab-room-id-value")?.textContent;e&&navigator.clipboard.writeText(e).then(()=>{t.querySelector(".collab-copy-btn").textContent="Copied!",setTimeout(()=>{const s=t.querySelector(".collab-copy-btn");s&&(s.textContent="Copy")},2e3)})}),t.querySelector(".collab-send-btn")?.addEventListener("click",()=>{this._sendChat()}),t.querySelector(".collab-message-input")?.addEventListener("keydown",e=>{e.key==="Enter"&&this._sendChat()})}_generateRoomId(){return Math.random().toString(36).substring(2,8).toUpperCase()}_createRoom(){this._roomId=this._generateRoomId(),this._isHost=!0,this._openChannel(this._roomId),this._showActiveRoom(),this._updateRoomInfo(),this._broadcastState(),console.log("[CollabRoom] Created room:",this._roomId)}_joinRoom(t){this._roomId=t.toUpperCase(),this._isHost=!1,this._openChannel(this._roomId),this._showActiveRoom(),this._updateRoomInfo(),this._channel.postMessage({type:"request-sync",from:this._getPeerId()}),console.log("[CollabRoom] Joined room:",this._roomId)}_openChannel(t){this._channel&&this._channel.close(),this._channel=new BroadcastChannel(`collab-room-${t}`),this._channel.onmessage=e=>this._handleMessage(e.data)}_handleMessage(t){if(!(!t||!t.type))switch(t.type){case"sync-state":this._isHost||this._syncToState(t.state);break;case"chat":this._addChatMessage(t.author,t.text,!1);break;case"request-sync":this._isHost&&this._broadcastState();break;case"participant-join":this._participants.push(t.peerId),this._updateParticipantCount();break;case"participant-leave":this._participants=this._participants.filter(e=>e!==t.peerId),this._updateParticipantCount();break}}_broadcastState(){if(!this._channel||!this._isHost)return;const t=this._player?.currentTrack,e={trackId:t?.id,trackTitle:t?.title,trackArtist:t?.artist?.name||t?.artists?.[0]?.name,isPlaying:!this._player?._audio?.paused,currentTime:this._player?._audio?.currentTime||0,timestamp:Date.now()};this._channel.postMessage({type:"sync-state",state:e}),this._updateNowPlaying(e)}_syncToState(t){t&&(this._updateNowPlaying(t),this._updateSyncStatus(!0),console.log("[CollabRoom] Synced to host state:",t))}_showActiveRoom(){const t=this._container?.querySelector(".collab-join-section"),e=this._container?.querySelector(".collab-active-section");t&&(t.style.display="none"),e&&(e.style.display="block"),this._channel?.postMessage({type:"participant-join",peerId:this._getPeerId()}),this._isHost&&(this._syncInterval=setInterval(()=>this._broadcastState(),5e3))}_leaveRoom(){this._channel?.postMessage({type:"participant-leave",peerId:this._getPeerId()}),this._channel?.close(),this._channel=null,this._syncInterval&&clearInterval(this._syncInterval),this._roomId=null,this._isHost=!1;const t=this._container?.querySelector(".collab-join-section"),e=this._container?.querySelector(".collab-active-section");t&&(t.style.display=""),e&&(e.style.display="none")}_updateRoomInfo(){const t=this._container?.querySelector(".collab-room-id-value");t&&(t.textContent=this._roomId)}_updateParticipantCount(){const t=this._container?.querySelector(".collab-participants-count"),e=this._participants.length+1;t&&(t.textContent=`${e} listener${e!==1?"s":""}`)}_updateNowPlaying(t){const e=this._container?.querySelector(".collab-track-title"),s=this._container?.querySelector(".collab-track-artist");e&&(e.textContent=t.trackTitle||"No track playing"),s&&(s.textContent=t.trackArtist||"")}_updateSyncStatus(t){const e=this._container?.querySelector(".collab-sync-indicator");e&&(e.textContent=t?"In Sync":"Out of Sync",e.className=`collab-sync-indicator ${t?"sync-ok":"sync-warn"}`)}_sendChat(){const t=this._container?.querySelector(".collab-message-input"),e=t?.value?.trim();if(!e||!this._channel)return;this._addChatMessage("You",e,!0),this._channel.postMessage({type:"chat",author:"Guest",text:e}),t&&(t.value="")}_addChatMessage(t,e,s){const a=this._container?.querySelector(".collab-messages");if(!a)return;const o=document.createElement("div");o.className=`collab-message ${s?"self":"other"}`,o.innerHTML=`<span class="collab-msg-author">${t}</span><span class="collab-msg-text">${e}</span>`,a.appendChild(o),a.scrollTop=a.scrollHeight,this._chatMessages.push({author:t,text:e,isSelf:s})}_getPeerId(){return this._peerId||(this._peerId=Math.random().toString(36).substring(2,10)),this._peerId}destroy(){this._leaveRoom()}}export{n as CollaborativeRoom};
//# sourceMappingURL=collaborative-room-BSXjqiq-.js.map
