class r{constructor(e){this._audioPlayer=e,this._audioContext=null,this._sourceNode=null,this._filters=[],this._container=null,this._presets={flat:[0,0,0,0,0,0,0,0,0,0],bass_boost:[8,6,4,2,0,0,0,0,0,0],treble_boost:[0,0,0,0,0,2,4,6,7,8],vocal:[-2,-1,0,3,5,5,3,0,-1,-2],rock:[5,4,3,1,-1,-1,1,3,4,5],jazz:[4,3,1,2,-2,-2,0,1,3,4],classical:[0,0,0,0,0,0,-2,-3,-4,-4],electronic:[6,5,1,0,-2,2,1,5,6,6],hip_hop:[5,4,2,1,-1,-1,2,3,4,4],acoustic:[3,2,1,2,3,3,2,2,2,2]},this._bands=[{freq:32,label:"32Hz"},{freq:64,label:"64Hz"},{freq:125,label:"125Hz"},{freq:250,label:"250Hz"},{freq:500,label:"500Hz"},{freq:1e3,label:"1kHz"},{freq:2e3,label:"2kHz"},{freq:4e3,label:"4kHz"},{freq:8e3,label:"8kHz"},{freq:16e3,label:"16kHz"}],this._gains=new Array(10).fill(0),this._enabled=!1,this._loadSettings()}renderPage(e){this._container=e,e.innerHTML=`
      <div class="eq-studio-page">
        <h1 class="page-title">Equalizer Studio</h1>
        <p class="page-subtitle">Fine-tune your audio with precision controls</p>

        <div class="eq-studio-controls">
          <div class="eq-toggle-row">
            <label class="eq-toggle">
              <input type="checkbox" class="eq-enable-toggle" ${this._enabled?"checked":""} />
              <span class="eq-toggle-slider"></span>
              <span class="eq-toggle-label">Enable EQ</span>
            </label>
          </div>

          <div class="eq-presets">
            <label>Presets:</label>
            <div class="eq-preset-grid">
              ${Object.keys(this._presets).map(t=>`<button class="eq-preset-btn" data-preset="${t}">${t.replace("_"," ")}</button>`).join("")}
            </div>
          </div>

          <div class="eq-bands">
            ${this._bands.map((t,s)=>`
              <div class="eq-band">
                <input
                  type="range"
                  class="eq-slider"
                  data-band="${s}"
                  min="-12" max="12" step="0.5"
                  value="${this._gains[s]}"
                  orient="vertical"
                />
                <div class="eq-gain-value">${this._gains[s]>0?"+":""}${this._gains[s]}dB</div>
                <div class="eq-band-label">${t.label}</div>
              </div>
            `).join("")}
          </div>

          <div class="eq-actions">
            <button class="btn-secondary eq-reset-btn">Reset All</button>
            <button class="btn-primary eq-apply-btn">Apply</button>
          </div>
        </div>
      </div>
    `,this._attachEvents(e),this._enabled&&this._applyEQ()}_attachEvents(e){e.querySelector(".eq-enable-toggle")?.addEventListener("change",t=>{this._enabled=t.target.checked,this._enabled?(this._initAudioContext(),this._applyEQ()):this._bypass(),this._saveSettings()}),e.querySelectorAll(".eq-preset-btn").forEach(t=>{t.addEventListener("click",()=>{const s=t.dataset.preset;this._applyPreset(s,e)})}),e.querySelectorAll(".eq-slider").forEach(t=>{t.addEventListener("input",s=>{const i=parseInt(s.target.dataset.band),a=parseFloat(s.target.value);this._gains[i]=a;const l=s.target.parentNode.querySelector(".eq-gain-value");l&&(l.textContent=`${a>0?"+":""}${a}dB`),this._enabled&&this._updateBand(i,a)})}),e.querySelector(".eq-reset-btn")?.addEventListener("click",()=>{this._resetAll(e)}),e.querySelector(".eq-apply-btn")?.addEventListener("click",()=>{this._enabled||(e.querySelector(".eq-enable-toggle").checked=!0,this._enabled=!0),this._initAudioContext(),this._applyEQ(),this._saveSettings()})}_initAudioContext(){try{if(!this._audioContext){const e=window.AudioContext||window.webkitAudioContext;this._audioContext=new e}this._audioContext.state==="suspended"&&this._audioContext.resume(),!this._sourceNode&&this._audioPlayer&&(this._sourceNode=this._audioContext.createMediaElementSource(this._audioPlayer),this._createFilters(),this._sourceNode.connect(this._filters[0]),this._filters[this._filters.length-1].connect(this._audioContext.destination))}catch(e){console.warn("[EQStudio] AudioContext init failed:",e)}}_createFilters(){if(this._audioContext){this._filters=this._bands.map((e,t)=>{const s=this._audioContext.createBiquadFilter();return t===0?s.type="lowshelf":t===this._bands.length-1?s.type="highshelf":s.type="peaking",s.frequency.value=e.freq,s.Q.value=1.4,s.gain.value=this._gains[t],s});for(let e=0;e<this._filters.length-1;e++)this._filters[e].connect(this._filters[e+1])}}_applyEQ(){this._initAudioContext(),this._filters.length&&this._gains.forEach((e,t)=>{this._filters[t]&&(this._filters[t].gain.value=e)})}_updateBand(e,t){this._filters[e]&&(this._filters[e].gain.value=t)}_bypass(){this._filters.length&&this._gains.forEach((e,t)=>{this._filters[t]&&(this._filters[t].gain.value=0)})}_applyPreset(e,t){const s=this._presets[e];s&&(this._gains=[...s],t.querySelectorAll(".eq-slider").forEach((i,a)=>{i.value=this._gains[a];const l=i.parentNode.querySelector(".eq-gain-value");l&&(l.textContent=`${this._gains[a]>0?"+":""}${this._gains[a]}dB`)}),t.querySelectorAll(".eq-preset-btn").forEach(i=>{i.classList.toggle("active",i.dataset.preset===e)}),this._enabled&&this._applyEQ())}_resetAll(e){this._gains=new Array(10).fill(0),e.querySelectorAll(".eq-slider").forEach((t,s)=>{t.value=0;const i=t.parentNode.querySelector(".eq-gain-value");i&&(i.textContent="0dB")}),e.querySelectorAll(".eq-preset-btn").forEach(t=>t.classList.remove("active")),this._enabled&&this._applyEQ()}_saveSettings(){try{localStorage.setItem("eq-studio-settings",JSON.stringify({enabled:this._enabled,gains:this._gains}))}catch{}}_loadSettings(){try{const e=localStorage.getItem("eq-studio-settings");if(e){const t=JSON.parse(e);this._enabled=t.enabled||!1,this._gains=t.gains||new Array(10).fill(0)}}catch{}}destroy(){this._bypass(),this._audioContext&&this._audioContext.close()}}export{r as EqualizerStudio};
//# sourceMappingURL=equalizer-studio-WYMaFaoY.js.map
