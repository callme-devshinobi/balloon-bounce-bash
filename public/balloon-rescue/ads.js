/* Adsterra ad helpers - iframe-isolated to avoid document.write issues */
(function(){
  'use strict';

  const BANNER_KEY = 'a4e73aa7b810bddbfa148d0e8fc3cc78'; // 320x50
  const REWARD_KEY = '1bd8324c8233e2e40028ca230e267d5d'; // 160x300

  function buildAdSrcDoc(key, width, height){
    // Adsterra "highperformanceformat" invoke script uses document.write.
    // Isolating inside an iframe with srcdoc gives it a clean document.
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:transparent;overflow:hidden}
      body{display:flex;align-items:center;justify-content:center}
    </style></head><body>
      <script type="text/javascript">
        atOptions = {
          'key' : '${key}',
          'format' : 'iframe',
          'height' : ${height},
          'width' : ${width},
          'params' : {}
        };
      <\/script>
      <script type="text/javascript" src="https://www.highperformanceformat.com/${key}/invoke.js"><\/script>
    </body></html>`;
  }

  function hasRenderedAd(iframe){
    try{
      const doc = iframe.contentDocument;
      if(!doc || !doc.body) return false;
      const renderedFrame = doc.body.querySelector('iframe');
      const adObject = doc.body.querySelector('ins, a, img, embed, object');
      return Boolean(renderedFrame || adObject || doc.body.children.length > 2);
    }catch(err){
      // If the ad document becomes cross-origin after loading, treat it as a display attempt.
      return true;
    }
  }

  function mountAd(container, key, width, height, options){
    if(!container) return null;
    const cfg = Object.assign({ label:'Ad', maxRetries:3, checkDelay:3200, retryDelay:1400 }, options || {});
    container.innerHTML = '';
    container.dataset.adState = 'loading';

    const unit = document.createElement('div');
    unit.className = 'ad-unit';
    unit.style.width = width + 'px';
    unit.style.height = height + 'px';

    const fallback = document.createElement('div');
    fallback.className = 'ad-fallback ad-loading';
    fallback.innerHTML = `<span class="ad-spinner"></span><span>${cfg.label} loading…</span>`;
    unit.appendChild(fallback);
    container.appendChild(unit);

    let attempt = 0;
    let checkTimer = 0;
    let retryTimer = 0;
    let currentFrame = null;

    const setFallback = (state, text)=>{
      container.dataset.adState = state;
      fallback.className = 'ad-fallback ad-' + state;
      fallback.innerHTML = state === 'loading'
        ? `<span class="ad-spinner"></span><span>${text}</span>`
        : `<span>${text}</span>`;
    };

    const cleanupTimers = ()=>{
      if(checkTimer) clearTimeout(checkTimer);
      if(retryTimer) clearTimeout(retryTimer);
      checkTimer = 0;
      retryTimer = 0;
    };

    const attemptLoad = ()=>{
      cleanupTimers();
      attempt++;
      setFallback('loading', attempt === 1 ? `${cfg.label} loading…` : `${cfg.label} retry ${attempt}/${cfg.maxRetries}…`);

      if(currentFrame) currentFrame.remove();
      const iframe = document.createElement('iframe');
      currentFrame = iframe;
      iframe.width = width;
      iframe.height = height;
      iframe.title = cfg.label;
      iframe.setAttribute('scrolling','no');
      iframe.setAttribute('frameborder','0');
      iframe.setAttribute('aria-label', cfg.label);
      iframe.style.border = '0';
      iframe.style.display = 'block';
      iframe.style.background = 'transparent';
      iframe.onload = ()=>{
        checkTimer = window.setTimeout(()=>{
          if(iframe !== currentFrame) return;
          if(hasRenderedAd(iframe)){
            container.dataset.adState = 'loaded';
            fallback.className = 'ad-fallback ad-loaded';
            fallback.textContent = '';
          }else if(attempt < cfg.maxRetries){
            setFallback('retrying', `${cfg.label} not visible — retrying…`);
            retryTimer = window.setTimeout(attemptLoad, cfg.retryDelay);
          }else{
            setFallback('error', `${cfg.label} unavailable`);
          }
        }, cfg.checkDelay);
      };
      iframe.onerror = ()=>{
        if(attempt < cfg.maxRetries){
          setFallback('retrying', `${cfg.label} failed — retrying…`);
          retryTimer = window.setTimeout(attemptLoad, cfg.retryDelay);
        }else{
          setFallback('error', `${cfg.label} unavailable`);
        }
      };
      iframe.srcdoc = buildAdSrcDoc(key, width, height);
      unit.insertBefore(iframe, fallback);
    };

    attemptLoad();
    return { retry: attemptLoad, destroy: cleanupTimers, get iframe(){ return currentFrame; } };
  }

  // Mount the persistent bottom banner immediately.
  function mountBottomBanner(){
    const el = document.getElementById('ad-banner');
    mountAd(el, BANNER_KEY, 320, 50, { label:'Banner ad' });
  }

  // Show the rewarded 160x300 banner for `seconds` seconds, then call onDone().
  let rewardActive = false;
  function showReward(seconds, onDone){
    if(rewardActive){ if(onDone) onDone(); return; }
    rewardActive = true;
    const overlay = document.getElementById('reward-modal');
    const slot = document.getElementById('reward-ad-slot');
    const timerEl = document.getElementById('reward-timer');
    const skipBtn = document.getElementById('reward-skip');
    if(!overlay || !slot){ rewardActive=false; if(onDone) onDone(); return; }

    mountAd(slot, REWARD_KEY, 160, 300, { label:'Reward ad' });
    overlay.classList.remove('hidden');
    let remaining = Math.max(1, seconds|0);
    if(timerEl) timerEl.textContent = remaining + 's';
    if(skipBtn){ skipBtn.disabled = true; skipBtn.textContent = 'Please wait ' + remaining + 's'; }

    const iv = setInterval(()=>{
      remaining--;
      if(timerEl) timerEl.textContent = Math.max(0,remaining) + 's';
      if(skipBtn) skipBtn.textContent = remaining>0 ? ('Please wait '+remaining+'s') : 'Continue';
      if(remaining<=0){
        clearInterval(iv);
        if(skipBtn){ skipBtn.disabled = false; }
      }
    }, 1000);

    const finish = ()=>{
      clearInterval(iv);
      overlay.classList.add('hidden');
      slot.innerHTML = '';
      rewardActive = false;
      if(skipBtn){ skipBtn.removeEventListener('click', onSkip); }
      if(onDone) onDone();
    };

    function onSkip(){ if(!skipBtn.disabled) finish(); }
    if(skipBtn) skipBtn.addEventListener('click', onSkip);

    // Auto-close after seconds+0.5s buffer if user doesn't click.
    setTimeout(()=>{ if(rewardActive) finish(); }, (seconds*1000)+500);
  }

  window.Ads = {
    mountBottomBanner,
    showReward
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', mountBottomBanner);
  } else {
    mountBottomBanner();
  }
})();
