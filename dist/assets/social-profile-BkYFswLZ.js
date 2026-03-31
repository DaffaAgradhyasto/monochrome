class d{constructor(i){this._syncManager=i,this._container=null,this._profileData=null}renderPage(i,s){if(this._container=i,this._profileData=s,!s){i.innerHTML=`
        <div class="social-profile-page">
          <div class="profile-not-found">
            <h2>Profile not found</h2>
            <p>This user doesn't have a public profile yet.</p>
          </div>
        </div>
      `;return}const t=s.stats||{},a=s.topTracks||[],l=s.topArtists||[],n=s.recentTracks||[],o=this._computeBadges(t);i.innerHTML=`
      <div class="social-profile-page">
        <div class="profile-header">
          <div class="profile-avatar">
            ${s.avatarUrl?`<img src="${s.avatarUrl}" alt="${s.displayName}" class="profile-avatar-img" />`:`<div class="profile-avatar-placeholder">${(s.displayName||"U")[0].toUpperCase()}</div>`}
          </div>
          <div class="profile-info">
            <h1 class="profile-display-name">${s.displayName||"Unknown User"}</h1>
            <p class="profile-username">@${s.username||"unknown"}</p>
            ${s.bio?`<p class="profile-bio">${s.bio}</p>`:""}
            <div class="profile-meta">
              <span class="profile-joined">Joined ${this._formatDate(s.joinedAt)}</span>
            </div>
          </div>
          <div class="profile-share">
            <button class="btn-secondary profile-share-btn" title="Share Profile">
              Share Profile
            </button>
          </div>
        </div>

        <div class="profile-stats-row">
          <div class="profile-stat">
            <div class="profile-stat-value">${t.totalPlays||0}</div>
            <div class="profile-stat-label">Total Plays</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${t.uniqueArtists||0}</div>
            <div class="profile-stat-label">Artists</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${t.listeningHours||0}h</div>
            <div class="profile-stat-label">Listening Time</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${t.streak||0}</div>
            <div class="profile-stat-label">Day Streak</div>
          </div>
        </div>

        ${o.length>0?`
          <div class="profile-badges-section">
            <h3>Badges</h3>
            <div class="profile-badges">
              ${o.map(e=>`
                <div class="profile-badge" title="${e.description}">
                  <span class="profile-badge-icon">${e.icon}</span>
                  <span class="profile-badge-name">${e.name}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `:""}

        <div class="profile-content-grid">
          ${a.length>0?`
            <div class="profile-section">
              <h3>Top Tracks</h3>
              <div class="profile-track-list">
                ${a.slice(0,5).map((e,r)=>`
                  <div class="profile-track-item">
                    <span class="profile-track-rank">${r+1}</span>
                    <div class="profile-track-info">
                      <div class="profile-track-title">${e.title||"Unknown"}</div>
                      <div class="profile-track-artist">${e.artist||"Unknown"}</div>
                    </div>
                    <span class="profile-track-plays">${e.plays||0} plays</span>
                  </div>
                `).join("")}
              </div>
            </div>
          `:""}

          ${l.length>0?`
            <div class="profile-section">
              <h3>Top Artists</h3>
              <div class="profile-artist-list">
                ${l.slice(0,5).map((e,r)=>`
                  <div class="profile-artist-item">
                    <span class="profile-artist-rank">${r+1}</span>
                    <div class="profile-artist-info">
                      <div class="profile-artist-name">${e.name||"Unknown"}</div>
                    </div>
                    <span class="profile-artist-plays">${e.plays||0} plays</span>
                  </div>
                `).join("")}
              </div>
            </div>
          `:""}
        </div>

        ${n.length>0?`
          <div class="profile-section profile-recent">
            <h3>Recently Played</h3>
            <div class="profile-recent-list">
              ${n.slice(0,10).map(e=>`
                <div class="profile-recent-item">
                  <div class="profile-recent-info">
                    <div class="profile-recent-title">${e.title||"Unknown"}</div>
                    <div class="profile-recent-artist">${e.artist||"Unknown"}</div>
                  </div>
                  <span class="profile-recent-time">${this._formatRelativeTime(e.playedAt)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        `:""}
      </div>
    `,this._attachEvents(i,s)}_attachEvents(i,s){i.querySelector(".profile-share-btn")?.addEventListener("click",()=>{const t=`${window.location.origin}/user/@${s.username}`;navigator.share?navigator.share({title:`${s.displayName}'s Music Profile`,url:t}).catch(()=>{}):navigator.clipboard.writeText(t).then(()=>{const a=i.querySelector(".profile-share-btn");a&&(a.textContent="Copied!",setTimeout(()=>{a.textContent="Share Profile"},2e3))})})}_computeBadges(i){const s=[];return(i.totalPlays||0)>=1e3&&s.push({icon:"🏆",name:"Music Addict",description:"1000+ plays"}),(i.streak||0)>=7&&s.push({icon:"🔥",name:"7-Day Streak",description:"Listened 7 days in a row"}),(i.uniqueArtists||0)>=50&&s.push({icon:"🌍",name:"Explorer",description:"Listened to 50+ artists"}),(i.listeningHours||0)>=100&&s.push({icon:"⏱️",name:"Century",description:"100+ hours of listening"}),(i.streak||0)>=30&&s.push({icon:"⭐",name:"Dedicated",description:"30-day listening streak"}),s}_formatDate(i){if(!i)return"Unknown";try{return new Date(i).toLocaleDateString("en-US",{year:"numeric",month:"long"})}catch{return i}}_formatRelativeTime(i){if(!i)return"";try{const s=Date.now()-new Date(i).getTime(),t=Math.floor(s/6e4);if(t<1)return"Just now";if(t<60)return`${t}m ago`;const a=Math.floor(t/60);return a<24?`${a}h ago`:`${Math.floor(a/24)}d ago`}catch{return""}}async buildProfileData(i,s,t,a){let l={totalPlays:0,uniqueArtists:0,listeningHours:0,streak:0},n=[],o=[],e=[];try{if(window.monochromePlaybackStats){const r=window.monochromePlaybackStats;l=await r.getStats?.()||l,n=await r.getTopTracks?.(5)||[],o=await r.getTopArtists?.(5)||[],e=await r.getRecentTracks?.(10)||[]}}catch(r){console.warn("[SocialProfile] Could not load stats:",r)}return{username:i,displayName:s,bio:t,avatarUrl:a,joinedAt:new Date().toISOString(),stats:l,topTracks:n,topArtists:o,recentTracks:e}}}export{d as SocialProfile};
//# sourceMappingURL=social-profile-BkYFswLZ.js.map
