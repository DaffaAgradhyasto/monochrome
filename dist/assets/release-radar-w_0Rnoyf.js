class c{constructor(e){this._musicAPI=e,this._followedArtists=this._loadFollowedArtists(),this._seenReleases=this._loadSeenReleases(),this._container=null,this._releases=[]}async renderPage(e){this._container=e,e.innerHTML=`
      <div class="release-radar-page">
        <h1 class="page-title">Release Radar</h1>
        <p class="page-subtitle">New music from artists you follow</p>

        <div class="radar-controls">
          <button class="btn-primary radar-refresh-btn">
            <span>Refresh</span>
          </button>
          <span class="radar-last-updated"></span>
        </div>

        <div class="radar-follow-section">
          <h3>Follow an Artist</h3>
          <div class="radar-follow-input-row">
            <input type="text" class="radar-artist-input" placeholder="Artist name..." />
            <button class="btn-secondary radar-follow-btn">Follow</button>
          </div>
        </div>

        <div class="radar-followed-section">
          <h3>Followed Artists (<span class="radar-followed-count">${this._followedArtists.length}</span>)</h3>
          <div class="radar-followed-list">
            ${this._renderFollowedArtists()}
          </div>
        </div>

        <div class="radar-releases-section">
          <h3>Recent Releases</h3>
          <div class="radar-loading" style="display:none">Checking for new releases...</div>
          <div class="radar-releases-list">
            <p class="radar-empty">Follow artists to see their latest releases here.</p>
          </div>
        </div>
      </div>
    `,this._attachEvents(e),this._followedArtists.length>0&&await this._fetchReleases(e)}_attachEvents(e){e.querySelector(".radar-refresh-btn")?.addEventListener("click",async()=>{await this._fetchReleases(e)}),e.querySelector(".radar-follow-btn")?.addEventListener("click",()=>{const t=e.querySelector(".radar-artist-input"),a=t?.value?.trim();a&&(this._followArtist(a,e),t.value="")}),e.querySelector(".radar-artist-input")?.addEventListener("keydown",t=>{t.key==="Enter"&&e.querySelector(".radar-follow-btn")?.click()})}_renderFollowedArtists(){return this._followedArtists.length?this._followedArtists.map(e=>`
      <div class="radar-artist-chip" data-artist="${e}">
        <span>${e}</span>
        <button class="radar-unfollow-btn" data-artist="${e}" title="Unfollow">×</button>
      </div>
    `).join(""):'<p class="radar-empty">No followed artists yet.</p>'}_followArtist(e,t){this._followedArtists.includes(e)||(this._followedArtists.push(e),this._saveFollowedArtists(),this._updateFollowedUI(t))}_unfollowArtist(e,t){this._followedArtists=this._followedArtists.filter(a=>a!==e),this._saveFollowedArtists(),this._updateFollowedUI(t)}_updateFollowedUI(e){const t=e.querySelector(".radar-followed-list"),a=e.querySelector(".radar-followed-count");t&&(t.innerHTML=this._renderFollowedArtists(),t.querySelectorAll(".radar-unfollow-btn").forEach(s=>{s.addEventListener("click",()=>{this._unfollowArtist(s.dataset.artist,e)})})),a&&(a.textContent=this._followedArtists.length)}async _fetchReleases(e){if(!this._followedArtists.length)return;const t=e.querySelector(".radar-loading"),a=e.querySelector(".radar-releases-list"),s=e.querySelector(".radar-last-updated");t&&(t.style.display="block"),a&&(a.innerHTML="");const r=[];for(const i of this._followedArtists)try{const l=await this._fetchArtistReleases(i);r.push(...l)}catch(l){console.warn("[ReleaseRadar] Failed to fetch releases for:",i,l)}r.sort((i,l)=>new Date(l.date||0)-new Date(i.date||0)),this._releases=r,t&&(t.style.display="none"),this._renderReleases(e,r),s&&(s.textContent=`Updated: ${new Date().toLocaleTimeString()}`)}async _fetchArtistReleases(e){try{const t=`https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(e)}&fmt=json&limit=1`,a=await fetch(t);if(!a.ok)return[];const r=(await a.json()).artists?.[0];if(!r)return[];const i=`https://musicbrainz.org/ws/2/release-group/?artist=${r.id}&type=album|single|ep&fmt=json&limit=5`,l=await fetch(i);return l.ok?((await l.json())["release-groups"]||[]).map(o=>({id:o.id,title:o.title,artist:e,type:o["primary-type"]||"Release",date:o["first-release-date"]||"",isNew:!this._seenReleases.has(o.id)})):[]}catch{return[]}}_renderReleases(e,t){const a=e.querySelector(".radar-releases-list");if(a){if(!t.length){a.innerHTML='<p class="radar-empty">No recent releases found.</p>';return}a.innerHTML=t.map(s=>`
      <div class="radar-release-card ${s.isNew?"radar-new":""}">
        ${s.isNew?'<span class="radar-new-badge">NEW</span>':""}
        <div class="radar-release-info">
          <div class="radar-release-title">${s.title}</div>
          <div class="radar-release-artist">${s.artist}</div>
          <div class="radar-release-meta">${s.type} · ${s.date||"Unknown date"}</div>
        </div>
        <button class="radar-listen-btn" data-artist="${s.artist}" data-title="${s.title}">Listen</button>
      </div>
    `).join(""),t.forEach(s=>this._seenReleases.add(s.id)),this._saveSeenReleases(),a.querySelectorAll(".radar-listen-btn").forEach(s=>{s.addEventListener("click",async()=>{if(this._musicAPI)try{const r=await this._musicAPI.search(`${s.dataset.title} ${s.dataset.artist}`);r?.tracks?.length&&console.log("[ReleaseRadar] Found tracks for release:",r.tracks[0])}catch(r){console.warn("[ReleaseRadar] Search failed:",r)}})})}}_loadFollowedArtists(){try{return JSON.parse(localStorage.getItem("release-radar-artists")||"[]")}catch{return[]}}_saveFollowedArtists(){try{localStorage.setItem("release-radar-artists",JSON.stringify(this._followedArtists))}catch{}}_loadSeenReleases(){try{const e=JSON.parse(localStorage.getItem("release-radar-seen")||"[]");return new Set(e)}catch{return new Set}}_saveSeenReleases(){try{localStorage.setItem("release-radar-seen",JSON.stringify([...this._seenReleases]))}catch{}}async getNewReleasesCount(){let e=0;for(const t of this._followedArtists)try{const a=await this._fetchArtistReleases(t);e+=a.filter(s=>s.isNew).length}catch{}return e}}export{c as ReleaseRadar};
//# sourceMappingURL=release-radar-w_0Rnoyf.js.map
