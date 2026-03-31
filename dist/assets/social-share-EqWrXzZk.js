class p{constructor(e){this.player=e,this._btn=null,this._createShareButton()}_createShareButton(){if(document.querySelector(".now-playing-bar .social-share-btn"))return;const e=document.createElement("button");e.className="social-share-btn",e.title="Share Track",e.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',e.style.cssText="background:none;border:none;color:var(--text-secondary);cursor:pointer;padding:4px;display:flex;align-items:center;opacity:0.7;transition:all 0.2s;",e.addEventListener("click",r=>{r.stopPropagation(),this._showShareMenu(r)}),e.addEventListener("mouseenter",()=>e.style.opacity="1"),e.addEventListener("mouseleave",()=>e.style.opacity="0.7"),this._btn=e;const o=document.querySelector(".now-playing-bar .edit-btn")||document.querySelector("#toggle-lyrics-btn");o&&o.parentNode&&o.parentNode.insertBefore(e,o.nextSibling)}_showShareMenu(e){const o=this.player?.currentTrack;if(!o){alert("No track is currently playing");return}document.getElementById("social-share-menu")?.remove();const r=o.title||"Unknown",d=o.artist?.name||"Unknown",i=`${r} by ${d}`,a=window.location.href,t=document.createElement("div");t.id="social-share-menu",t.style.cssText=`
      position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
    `;const s=[{name:"Twitter / X",icon:"X",action:()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(i)}&url=${encodeURIComponent(a)}`,"_blank")},{name:"WhatsApp",icon:"WA",action:()=>window.open(`https://wa.me/?text=${encodeURIComponent(i+" "+a)}`,"_blank")},{name:"Telegram",icon:"TG",action:()=>window.open(`https://t.me/share/url?url=${encodeURIComponent(a)}&text=${encodeURIComponent(i)}`,"_blank")},{name:"Copy Link",icon:"LINK",action:()=>{navigator.clipboard.writeText(`${i} - ${a}`),this._showCopied()}}];navigator.share&&s.unshift({name:"Share...",icon:"OS",action:()=>navigator.share({title:r,text:i,url:a}).catch(()=>{})}),t.innerHTML=`
      <div style="background:var(--bg-secondary,#1a1a2e);border-radius:16px;padding:24px;min-width:280px;color:var(--text-primary,#fff);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;">Share Track</h3>
          <button id="share-menu-close" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:20px;">&times;</button>
        </div>
        <div style="margin-bottom:16px;padding:12px;background:var(--bg-tertiary,#252540);border-radius:10px;">
          <div style="font-weight:600;font-size:14px;">${r}</div>
          <div style="color:var(--text-secondary);font-size:12px;margin-top:2px;">${d}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${s.map((n,c)=>`
            <button class="share-platform-btn" data-index="${c}" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;border:1px solid var(--border,#333);background:var(--bg-tertiary,#252540);color:var(--text-primary);cursor:pointer;font-size:14px;transition:all 0.2s;text-align:left;width:100%;">
              <span style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--accent,#00d4ff);color:#000;border-radius:8px;font-weight:bold;font-size:11px;">${n.icon}</span>
              ${n.name}
            </button>
          `).join("")}
        </div>
      </div>
    `,document.body.appendChild(t),t.querySelector("#share-menu-close").addEventListener("click",()=>t.remove()),t.addEventListener("click",n=>{n.target===t&&t.remove()}),t.querySelectorAll(".share-platform-btn").forEach(n=>{n.addEventListener("mouseenter",()=>n.style.background="var(--accent,#00d4ff)"),n.addEventListener("mouseleave",()=>n.style.background="var(--bg-tertiary,#252540)"),n.addEventListener("click",()=>{const c=parseInt(n.dataset.index);s[c].action(),t.remove()})})}_showCopied(){const e=document.createElement("div");e.textContent="Link copied!",e.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--accent,#00d4ff);color:#000;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:10001;animation:fadeInUp 0.3s ease;",document.body.appendChild(e),setTimeout(()=>e.remove(),2e3)}}export{p as SocialShare};
//# sourceMappingURL=social-share-EqWrXzZk.js.map
