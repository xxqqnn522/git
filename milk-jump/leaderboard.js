(() => {
  'use strict';
  const config = window.MILK_LEADERBOARD_CONFIG || {};
  const configured = /^https:\/\//.test(config.url || '') && !!config.key;
  const status = document.querySelector('#ranking-status');
  const nickname = document.querySelector('#player-name');
  const list = document.querySelector('#ranking-body');
  const selector = document.querySelector('#ranking-difficulty');
  let currentRun = null, requestNumber = 0, uploading = false;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  let playerId = read('milk-player-id', null);
  if (!playerId) { playerId = crypto.randomUUID(); write('milk-player-id', playerId); }
  nickname.value = read('milk-player-name', '游客' + playerId.slice(0, 4));
  nickname.addEventListener('change', () => {
    nickname.value = nickname.value.trim().slice(0, 20) || '游客' + playerId.slice(0, 4);
    write('milk-player-name', nickname.value);
  });
  let queue = read('milk-score-outbox', []);
  if (!Array.isArray(queue)) queue = [];
  async function rpc(name, body) {
    const response = await fetch(config.url.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.key },
      body: JSON.stringify(body), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) { const error=new Error('排行榜请求失败 (' + response.status + ')'); error.status=response.status;throw error; }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  function empty(text) {
    list.replaceChildren();
    const row = document.createElement('tr'), cell = document.createElement('td');
    cell.colSpan = 5; cell.textContent = text; row.append(cell); list.append(row);
  }
  async function refresh() {
    const request = ++requestNumber;
    if (!configured) { empty('全站排行榜尚未接入数据库'); status.textContent = '数据库配置完成后，将显示所有玩家的成绩。'; return; }
    status.textContent = '正在加载…';
    try {
      let rows;
      try { rows=await rpc('milk_top_ten_v3',{p_difficulty:selector.value}); }
      catch(error){if(error.status!==404)throw error;rows=await rpc('milk_top_ten',{p_difficulty:selector.value});}
      if (request !== requestNumber) return;
      list.replaceChildren();
      if (!rows?.length) empty('还没有成绩，来争夺第一名吧！');
      (rows || []).forEach((item, index) => {
        const row = document.createElement('tr');
        for (const value of [index + 1, item.nickname, item.character_name || '未记录', item.score, new Date(item.achieved_at).toLocaleString('zh-CN')]) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        list.append(row);
      });
      status.textContent = queue.length ? `有 ${queue.length} 局等待上传。` : '每位玩家取该难度最高分，同分按先达到者优先。';
    } catch { if (request === requestNumber) { empty('排行榜暂时无法加载，请稍后刷新'); status.textContent = '网络或数据库连接失败，游戏可继续。'; } }
  }
  async function flush() {
    if (!configured || uploading || !queue.length) return;
    uploading = true;
    try {
      while (queue.length) {
        await rpc('milk_record_run_v3', { ...queue[0], p_character:queue[0].p_character || '未记录' });
        queue.shift(); write('milk-score-outbox', queue);
      }
      await refresh();
    } catch(error) { status.textContent = error.status===404 ? '请先运行角色字段升级脚本，成绩已暂存，升级后会自动重试。' : `有 ${queue.length} 局尚未上传，联网后会重试，请保留本浏览器数据。`; }
    finally { uploading = false; }
  }
  window.MilkLeaderboard = {
    start(difficulty, character) {
      if (currentRun) return;
      currentRun = { p_run_id: crypto.randomUUID(), p_player_id: playerId,
        p_nickname: nickname.value.trim().slice(0, 20) || '游客' + playerId.slice(0, 4),
        p_difficulty: difficulty, p_character:character || '未记录', p_score: 0, p_duration_ms: 0, p_reason: 'failed', started: performance.now() };
    },
    setCharacter(character) { if(currentRun)currentRun.p_character=character; },
    finish(score, reason = 'failed') {
      if (!currentRun) return;
      const record = { ...currentRun, p_score: score, p_reason: reason,
        p_duration_ms: Math.max(0, Math.round(performance.now() - currentRun.started)) };
      delete record.started; currentRun = null;
      queue.push(record);
      if (!write('milk-score-outbox', queue)) status.textContent = '浏览器存储不足，请勿关闭页面；联网后将尝试上传。';
      void flush();
    }
  };
  selector.addEventListener('change', refresh);
  document.querySelector('#ranking-refresh').addEventListener('click', () => { void refresh(); void flush(); });
  window.addEventListener('online', flush);
  window.setInterval(flush, 30000);
  void refresh(); void flush();
})();
