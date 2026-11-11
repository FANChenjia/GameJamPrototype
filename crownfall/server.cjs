'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Game = require('./game.js');

function createServer() {
  const rooms = new Map();
  const publicFiles = new Set(['index.html', 'styles.css', 'cards.css', 'table-flip.css', 'game.js', 'cards.js', 'table-flip.js', 'tutorial.js', 'app.js', 'favicon.svg']);
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const view = room => ({ code: room.code, ready: Boolean(room.seats[1]), connected: room.streams.map(Boolean), votes: room.votes, gameIndex: room.gameIndex, state: Game.snapshot(room.state) });
  function broadcast(room) {
    const message = 'data: ' + JSON.stringify(view(room)) + '\n\n';
    room.streams.forEach(stream => { if (stream && !stream.destroyed && !stream.writableEnded) stream.write(message); });
  }
  function authenticate(body) {
    const room = rooms.get(String(body.code || '').toUpperCase());
    if (!room) throw new Error('房间已过期，请重新创建');
    const seat = room.seats.findIndex(t => t && t === body.token);
    if (seat === -1) throw new Error('连接凭证失效，请重新加入');
    room.updatedAt = Date.now();
    return { room, seat };
  }
  async function readBody(req) {
    let data = '';
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 8192) throw new Error('请求过大');
    }
    try { return JSON.parse(data || '{}'); } catch { throw new Error('请求格式错误'); }
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // Only the served game may issue browser requests to the LAN authority.
    const origin = req.headers.origin;
    if (origin && origin !== 'http://' + req.headers.host && origin !== 'https://' + req.headers.host) return json(res, 403, { error: '仅允许同源连接' });
    try {
      if (req.method === 'GET' && url.pathname === '/api/info') {
        const port = server.address().port;
        const addresses = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => 'http://' + n.address + ':' + port);
        return json(res, 200, { addresses, port });
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        const { room, seat } = authenticate(Object.fromEntries(url.searchParams));
        const previous = room.streams[seat];
        room.streams[seat] = res;
        if (previous) previous.end();
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 2000\n\n');
        broadcast(room);
        const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n'); }, 15000);
        req.on('close', () => {
          clearInterval(heartbeat);
          if (room.streams[seat] === res) { room.streams[seat] = null; room.updatedAt = Date.now(); broadcast(room); }
        });
        return;
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        const body = await readBody(req);
        if (url.pathname === '/api/create') {
          if (rooms.size >= 100) return json(res, 503, { error: '房间暂满，请稍后再试' });
          let code;
          do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
          const token = crypto.randomBytes(24).toString('hex');
          const room = { code, seats: [token, null], streams: [null, null], state: Game.create(), votes: [], gameIndex: 0, updatedAt: Date.now() };
          rooms.set(code, room);
          return json(res, 201, { token, seat: 0, ...view(room) });
        }
        if (url.pathname === '/api/join') {
          const code = String(body.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) return json(res, 404, { error: '找不到房间，请核对六位房间码' });
          if (room.seats[1]) return json(res, 409, { error: '这个房间已有两位玩家' });
          const token = crypto.randomBytes(24).toString('hex');
          room.seats[1] = token; room.updatedAt = Date.now();
          broadcast(room);
          return json(res, 200, { token, seat: 1, ...view(room) });
        }
        if (url.pathname === '/api/resume') {
          const { room, seat } = authenticate(body);
          return json(res, 200, { seat, ...view(room) });
        }
        if (url.pathname === '/api/action') {
          const { room, seat } = authenticate(body);
          if (!room.seats[1]) throw new Error('等待另一位玩家入座');
          if (!room.streams[1 - seat]) throw new Error('对方正在重连，请稍候');
          if (body.seq !== room.state.seq) throw new Error('牌桌已更新，请重试');
          Game.act(room.state, seat, body.action);
          broadcast(room);
          return json(res, 200, { ok: true });
        }
        if (url.pathname === '/api/rematch') {
          const { room, seat } = authenticate(body);
          if (room.state.phase !== 'over') throw new Error('本局尚未结束');
          if (!room.votes.includes(seat)) room.votes.push(seat);
          if (room.votes.length === 2) { room.gameIndex++; room.state = Game.create(Math.random, room.gameIndex % 2); room.votes = []; }
          broadcast(room);
          return json(res, 200, { ok: true });
        }
        return json(res, 404, { error: '接口不存在' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: '不支持的方法' });
      const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!publicFiles.has(filename)) return json(res, 404, { error: '页面不存在' });
      const data = await fs.promises.readFile(path.join(__dirname, filename));
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: error.message || '操作失败' });
      else res.end();
    }
  });
  const cleanup = setInterval(() => {
    for (const [code, room] of rooms) if (!room.streams.some(Boolean) && Date.now() - room.updatedAt > 7200000) rooms.delete(code);
  }, 60000);
  cleanup.unref();
  server.on('close', () => { clearInterval(cleanup); for (const room of rooms.values()) room.streams.forEach(s => s?.end()); });
  return server;
}
if (require.main === module) {
  const port = Number(process.env.PORT) || 3210;
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    console.log('\n  CROWNFALL / 王阵\n  本机: http://localhost:' + port);
    for (const ni of Object.values(os.networkInterfaces()).flat()) if (ni && ni.family === 'IPv4' && !ni.internal) console.log('  局域网: http://' + ni.address + ':' + port);
    console.log('\n  保持此窗口开启。按 Ctrl+C 停止。\n');
  });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '端口 ' + port + ' 已被使用。可设置 PORT 后重试。' : error.message); process.exitCode = 1; });
}
module.exports = { createServer };
