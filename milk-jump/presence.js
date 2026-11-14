(() => {
  'use strict';
  const config=window.MILK_LEADERBOARD_CONFIG || {};
  let visitorId;
  try {
    visitorId=localStorage.getItem('milk-presence-visitor');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitorId||'')){
      visitorId=crypto.randomUUID();localStorage.setItem('milk-presence-visitor',visitorId);
    }
  }catch{visitorId=crypto.randomUUID();}
  let busy=false;
  async function ping(){
    if(document.hidden || busy || !navigator.onLine)return;
    if(!config.url || !config.key)return;
    busy=true;
    try{
      const response=await fetch(config.url.replace(/\/$/,'')+'/rest/v1/rpc/milk_presence_heartbeat',{
        method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},
        body:JSON.stringify({p_visitor_id:visitorId}),signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)throw new Error('Heartbeat failed');
    }catch{ /* 统计失败时静默等待下次重试，不影响游戏。 */ }
    finally{busy=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void ping();});
  window.addEventListener('online',ping);
  window.setInterval(ping,30000);
  void ping();
})();
