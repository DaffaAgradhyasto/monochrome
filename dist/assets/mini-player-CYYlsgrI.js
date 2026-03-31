class n{constructor(t,e){this.player=t,this.audioPlayer=e,this.isVisible=!1,this.isDragging=!1,this.isMinimized=!1,this.dragOffset={x:0,y:0},this.position=JSON.parse(localStorage.getItem("monochrome_miniplayer_pos")||'{"x":20,"y":20}'),this.container=null,this.ui={},this._createUI(),this._attachEvents()}_createUI(){const t=document.createElement("button");t.className="mini-player-toggle",t.title="Mini Player",t.innerHTML=`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <rect x="12" y="10" width="10" height="7" rx="1" fill="currentColor" opacity="0.3"/>
      </svg>
    `,Object.assign(t.style,{background:"none",border:"none",color:"#b3b3b3",cursor:"pointer",padding:"8px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}),t.addEventListener("click",()=>this.toggle());const e=document.querySelector(".now-playing-bar .extra-controls")||document.querySelector(".now-playing-bar .controls");e&&e.appendChild(t),this.ui.toggleBtn=t;const i=document.createElement("div");i.className="monochrome-mini-player",i.innerHTML=`
      <div class="mp-header">
        <span class="mp-title">Mini Player</span>
        <div class="mp-header-actions">
          <button class="mp-minimize" title="Minimize">&#8211;</button>
          <button class="mp-close" title="Close">&times;</button>
        </div>
      </div>
      <div class="mp-body">
        <div class="mp-artwork">
          <img src="" alt="Album Art" class="mp-art-img"/>
        </div>
        <div class="mp-info">
          <div class="mp-track-name">No track</div>
          <div class="mp-artist-name">--</div>
        </div>
        <div class="mp-progress">
          <div class="mp-progress-bar"><div class="mp-progress-fill"></div></div>
          <div class="mp-time"><span class="mp-current">0:00</span><span class="mp-duration">0:00</span></div>
        </div>
        <div class="mp-controls">
          <button class="mp-prev" title="Previous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button class="mp-play" title="Play/Pause">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="mp-next" title="Next">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>
      </div>
    `;const s=document.createElement("style");s.textContent=`
      .monochrome-mini-player {
        position: fixed;
        z-index: 99999;
        width: 300px;
        background: #181818;
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        overflow: hidden;
        display: none;
        font-family: inherit;
        color: #fff;
      }
      .monochrome-mini-player.visible { display: block; }
      .monochrome-mini-player.minimized .mp-body { display: none; }
      .monochrome-mini-player.minimized { width: 200px; }
      .mp-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; background: #222; cursor: move;
        user-select: none;
      }
      .mp-title { font-size: 12px; font-weight: 600; opacity: 0.7; }
      .mp-header-actions button {
        background: none; border: none; color: #b3b3b3;
        cursor: pointer; font-size: 16px; padding: 2px 6px;
      }
      .mp-header-actions button:hover { color: #fff; }
      .mp-body { padding: 12px; }
      .mp-artwork { text-align: center; margin-bottom: 10px; }
      .mp-art-img {
        width: 180px; height: 180px; border-radius: 8px;
        object-fit: cover; background: #333;
      }
      .mp-info { text-align: center; margin-bottom: 10px; }
      .mp-track-name {
        font-size: 14px; font-weight: 600;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .mp-artist-name { font-size: 12px; opacity: 0.6; margin-top: 2px; }
      .mp-progress { margin-bottom: 10px; }
      .mp-progress-bar {
        width: 100%; height: 4px; background: #444;
        border-radius: 2px; cursor: pointer; position: relative;
      }
      .mp-progress-fill {
        height: 100%; background: #1db954; border-radius: 2px;
        width: 0%; transition: width 0.3s linear;
      }
      .mp-time {
        display: flex; justify-content: space-between;
        font-size: 10px; opacity: 0.5; margin-top: 4px;
      }
      .mp-controls {
        display: flex; justify-content: center; align-items: center; gap: 16px;
      }
      .mp-controls button {
        background: none; border: none; color: #b3b3b3;
        cursor: pointer; padding: 6px; border-radius: 50%;
        display: flex; align-items: center;
      }
      .mp-controls button:hover { color: #fff; }
      .mp-play {
        background: #fff !important; color: #000 !important;
        border-radius: 50% !important; padding: 8px !important;
      }
    `,document.head.appendChild(s),i.style.left=this.position.x+"px",i.style.top=this.position.y+"px",document.body.appendChild(i),this.container=i,this.ui.artImg=i.querySelector(".mp-art-img"),this.ui.trackName=i.querySelector(".mp-track-name"),this.ui.artistName=i.querySelector(".mp-artist-name"),this.ui.progressFill=i.querySelector(".mp-progress-fill"),this.ui.currentTime=i.querySelector(".mp-current"),this.ui.duration=i.querySelector(".mp-duration"),this.ui.playBtn=i.querySelector(".mp-play"),this.ui.prevBtn=i.querySelector(".mp-prev"),this.ui.nextBtn=i.querySelector(".mp-next"),this.ui.closeBtn=i.querySelector(".mp-close"),this.ui.minimizeBtn=i.querySelector(".mp-minimize"),this.ui.header=i.querySelector(".mp-header"),this.ui.progressBar=i.querySelector(".mp-progress-bar")}_attachEvents(){this.ui.header.addEventListener("mousedown",t=>{this.isDragging=!0,this.dragOffset.x=t.clientX-this.container.offsetLeft,this.dragOffset.y=t.clientY-this.container.offsetTop}),document.addEventListener("mousemove",t=>{if(!this.isDragging)return;const e=Math.max(0,Math.min(window.innerWidth-300,t.clientX-this.dragOffset.x)),i=Math.max(0,Math.min(window.innerHeight-50,t.clientY-this.dragOffset.y));this.container.style.left=e+"px",this.container.style.top=i+"px",this.position={x:e,y:i}}),document.addEventListener("mouseup",()=>{this.isDragging&&(this.isDragging=!1,localStorage.setItem("monochrome_miniplayer_pos",JSON.stringify(this.position)))}),this.ui.playBtn.addEventListener("click",()=>{this.audioPlayer.paused?this.audioPlayer.play():this.audioPlayer.pause()}),this.ui.prevBtn.addEventListener("click",()=>{this.player.previous&&this.player.previous()}),this.ui.nextBtn.addEventListener("click",()=>{this.player.next&&this.player.next()}),this.ui.closeBtn.addEventListener("click",()=>this.hide()),this.ui.minimizeBtn.addEventListener("click",()=>{this.isMinimized=!this.isMinimized,this.container.classList.toggle("minimized",this.isMinimized)}),this.ui.progressBar.addEventListener("click",t=>{const e=this.ui.progressBar.getBoundingClientRect(),i=(t.clientX-e.left)/e.width;this.audioPlayer.duration&&(this.audioPlayer.currentTime=i*this.audioPlayer.duration)}),this.audioPlayer.addEventListener("timeupdate",()=>this._updateProgress()),this.audioPlayer.addEventListener("play",()=>this._updatePlayBtn()),this.audioPlayer.addEventListener("pause",()=>this._updatePlayBtn()),this.audioPlayer.addEventListener("loadedmetadata",()=>this._updateTrackInfo()),setInterval(()=>this._updateTrackInfo(),2e3)}_updateProgress(){if(!this.isVisible||!this.audioPlayer.duration)return;const t=this.audioPlayer.currentTime/this.audioPlayer.duration*100;this.ui.progressFill.style.width=t+"%",this.ui.currentTime.textContent=this._formatTime(this.audioPlayer.currentTime),this.ui.duration.textContent=this._formatTime(this.audioPlayer.duration)}_updatePlayBtn(){const t=this.audioPlayer.paused?'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>':'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';this.ui.playBtn.innerHTML=t}_updateTrackInfo(){if(!this.isVisible)return;const t=this.player.currentTrack;t&&(this.ui.trackName.textContent=t.title||t.name||"Unknown",this.ui.artistName.textContent=t.artist||t.artistName||"--",(t.albumArt||t.cover||t.image)&&(this.ui.artImg.src=t.albumArt||t.cover||t.image))}_formatTime(t){if(!t||isNaN(t))return"0:00";const e=Math.floor(t/60),i=Math.floor(t%60);return`${e}:${i.toString().padStart(2,"0")}`}toggle(){this.isVisible?this.hide():this.show()}show(){this.isVisible=!0,this.container.classList.add("visible"),this.ui.toggleBtn.style.color="#1db954",this._updateTrackInfo(),this._updatePlayBtn()}hide(){this.isVisible=!1,this.container.classList.remove("visible"),this.ui.toggleBtn.style.color="#b3b3b3"}}export{n as MiniPlayer};
//# sourceMappingURL=mini-player-CYYlsgrI.js.map
