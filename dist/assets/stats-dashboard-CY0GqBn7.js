class m{constructor(){this._dbName="monochrome-stats",this._db=null,this._init()}async _init(){try{this._db=await this._openDB()}catch(t){console.warn("[StatsDashboard] DB init failed:",t)}}_openDB(){return new Promise((t,s)=>{const i=indexedDB.open(this._dbName,2);i.onupgradeneeded=l=>{const o=l.target.result;if(!o.objectStoreNames.contains("plays")){const r=o.createObjectStore("plays",{keyPath:"id",autoIncrement:!0});r.createIndex("trackId","trackId",{unique:!1}),r.createIndex("artistName","artistName",{unique:!1}),r.createIndex("date","date",{unique:!1}),r.createIndex("hour","hour",{unique:!1})}o.objectStoreNames.contains("streaks")||o.createObjectStore("streaks",{keyPath:"date"})},i.onsuccess=()=>t(i.result),i.onerror=()=>s(i.error)})}async recordPlay(t,s){if(!t||!this._db)return;const i=new Date,l={trackId:t.id,title:t.title,artistName:t.artist?.name||t.artists?.[0]?.name||"Unknown",albumTitle:t.album?.title||"",duration:s||0,timestamp:i.getTime(),date:i.toISOString().split("T")[0],hour:i.getHours(),dayOfWeek:i.getDay()};this._db.transaction("plays","readwrite").objectStore("plays").add(l),this._db.transaction("streaks","readwrite").objectStore("streaks").put({date:l.date,count:1})}async getStats(t=30){if(!this._db)return this._emptyStats();const s=Date.now()-t*24*60*60*1e3,l=(await this._getAllPlays()).filter(n=>n.timestamp>=s),o={},r={},e=new Array(24).fill(0),a=new Array(7).fill(0),c={};let u=0;for(const n of l)o[n.trackId]=o[n.trackId]||{title:n.title,artist:n.artistName,count:0},o[n.trackId].count++,r[n.artistName]=(r[n.artistName]||0)+1,e[n.hour]++,a[n.dayOfWeek]++,c[n.date]=(c[n.date]||0)+1,u+=n.duration||0;const y=Object.values(o).sort((n,d)=>d.count-n.count).slice(0,10),p=Object.entries(r).sort((n,d)=>d[1]-n[1]).slice(0,10).map(([n,d])=>({name:n,count:d})),h=await this._calculateStreak(),v=new Set(l.map(n=>n.trackId)).size;return{totalPlays:l.length,uniqueTracks:v,totalDuration:u,topTracks:y,topArtists:p,hourCounts:e,dayCounts:a,dateCounts:c,streak:h,personality:this._getPersonality(e,p)}}_getPersonality(t,s){const i=t.slice(22).reduce((r,e)=>r+e,0)+t.slice(0,5).reduce((r,e)=>r+e,0),l=t.slice(5,12).reduce((r,e)=>r+e,0),o=t.reduce((r,e)=>r+e,0);return o===0?{badge:"Newcomer",icon:"🌱",desc:"Just getting started!"}:i/o>.4?{badge:"Night Owl",icon:"🦉",desc:"You love late-night listening sessions"}:l/o>.4?{badge:"Early Bird",icon:"🐦",desc:"Music is your morning ritual"}:s.length>0&&s[0].count>o*.3?{badge:"Superfan",icon:"⭐",desc:`Obsessed with ${s[0].name}`}:{badge:"Explorer",icon:"🌍",desc:"You love discovering new music"}}async _calculateStreak(){if(!this._db)return 0;const s=this._db.transaction("streaks","readonly").objectStore("streaks"),i=await new Promise(e=>{const a=s.getAll();a.onsuccess=()=>e(a.result),a.onerror=()=>e([])}),l=new Set(i.map(e=>e.date));let o=0;const r=new Date;for(let e=0;e<365;e++){const a=new Date(r);if(a.setDate(a.getDate()-e),l.has(a.toISOString().split("T")[0]))o++;else break}return o}_getAllPlays(){return new Promise(t=>{const i=this._db.transaction("plays","readonly").objectStore("plays").getAll();i.onsuccess=()=>t(i.result||[]),i.onerror=()=>t([])})}_emptyStats(){return{totalPlays:0,uniqueTracks:0,totalDuration:0,topTracks:[],topArtists:[],hourCounts:new Array(24).fill(0),dayCounts:new Array(7).fill(0),dateCounts:{},streak:0,personality:{badge:"Newcomer",icon:"🌱",desc:"Start listening!"}}}async renderDashboard(t){if(!t)return;const s=await this.getStats(30),i=Math.floor(s.totalDuration/3600),l=Math.floor(s.totalDuration%3600/60),o=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],r=Math.max(...s.hourCounts,1),e=Math.max(...s.dayCounts,1);t.innerHTML=`
      <div class="stats-dashboard">
        <div class="stats-header">
          <h2>Your Music Stats</h2>
          <div class="stats-period-tabs">
            <button class="stats-tab active" data-days="7">7 Days</button>
            <button class="stats-tab" data-days="30">30 Days</button>
            <button class="stats-tab" data-days="90">90 Days</button>
            <button class="stats-tab" data-days="365">1 Year</button>
          </div>
        </div>

        <div class="stats-personality">
          <span class="personality-icon">${s.personality.icon}</span>
          <div>
            <h3>${s.personality.badge}</h3>
            <p>${s.personality.desc}</p>
          </div>
        </div>

        <div class="stats-overview">
          <div class="stat-card"><span class="stat-value">${s.totalPlays}</span><span class="stat-label">Total Plays</span></div>
          <div class="stat-card"><span class="stat-value">${s.uniqueTracks}</span><span class="stat-label">Unique Tracks</span></div>
          <div class="stat-card"><span class="stat-value">${i}h ${l}m</span><span class="stat-label">Listen Time</span></div>
          <div class="stat-card streak"><span class="stat-value">${s.streak}</span><span class="stat-label">Day Streak 🔥</span></div>
        </div>

        <div class="stats-section">
          <h3>Top Tracks</h3>
          <div class="top-list">
            ${s.topTracks.map((a,c)=>`
              <div class="top-item">
                <span class="top-rank">${c+1}</span>
                <div class="top-info"><span class="top-title">${a.title}</span><span class="top-artist">${a.artist}</span></div>
                <span class="top-count">${a.count} plays</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="stats-section">
          <h3>Top Artists</h3>
          <div class="top-list">
            ${s.topArtists.map((a,c)=>`
              <div class="top-item">
                <span class="top-rank">${c+1}</span>
                <div class="top-info"><span class="top-title">${a.name}</span></div>
                <span class="top-count">${a.count} plays</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="stats-section">
          <h3>Listening Activity by Hour</h3>
          <div class="hour-chart">
            ${s.hourCounts.map((a,c)=>`
              <div class="hour-bar" style="height:${a/r*100}%" title="${c}:00 - ${a} plays"></div>
            `).join("")}
          </div>
          <div class="hour-labels">${Array.from({length:24},(a,c)=>`<span>${c}</span>`).join("")}</div>
        </div>

        <div class="stats-section">
          <h3>Listening Activity by Day</h3>
          <div class="day-chart">
            ${s.dayCounts.map((a,c)=>`
              <div class="day-bar-wrapper">
                <div class="day-bar" style="width:${a/e*100}%"></div>
                <span class="day-label">${o[c]}</span>
                <span class="day-count">${a}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `,t.querySelectorAll(".stats-tab").forEach(a=>{a.addEventListener("click",async()=>{t.querySelectorAll(".stats-tab").forEach(c=>c.classList.remove("active")),a.classList.add("active"),await this.renderDashboard(t)})})}}export{m as StatsDashboard};
//# sourceMappingURL=stats-dashboard-CY0GqBn7.js.map
