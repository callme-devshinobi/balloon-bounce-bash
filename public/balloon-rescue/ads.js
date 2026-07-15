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

  function mountAd(container, key, width, height){
    if(!container) return;
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.width = width;
    iframe.height = height;
    iframe.setAttribute('scrolling','no');
    iframe.setAttribute('frameborder','0');
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.background = 'transparent';
    iframe.srcdoc = buildAdSrcDoc(key, width, height);
    container.appendChild(iframe);
    return iframe;
  }

  // Mount the persistent bottom banner immediately.
  function mountBottomBanner(){
    const el = document.getElementById('ad-banner');
    mountAd(el, BANNER_KEY, 320, 50);
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

    mountAd(slot, REWARD_KEY, 160, 300);
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
