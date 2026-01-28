const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Vercel Proxy - 终极版
 * 特性：无长度限制、代码高亮框、智能格式诱导、工具直连
 */
module.exports = (req, res) => {
    // --- 1. 参数解析 ---
    const currentUrl = new URL(req.url, `http://${req.headers.host}`);
    const queryUrl = currentUrl.searchParams.get('url');
    // 获取用户想伪装的客户端类型 (clash, singbox, base64)
    const targetUA = currentUrl.searchParams.get('ua') || 'default'; 
    
    let targetUrl = '';

    // 优先使用 ?url= 参数
    if (queryUrl) {
        targetUrl = queryUrl;
    } else {
        // 尝试从路径解析
        const path = currentUrl.pathname.replace(/^\/api\//, '').replace(/^\//, '');
        if (path && path !== 'favicon.ico') {
            targetUrl = path + currentUrl.search;
        }
    }

    // 如果没有目标 URL，返回首页
    if (!targetUrl) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderHome());
        return;
    }

    // 补全 https
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
    }

    // --- 2. 智能 User-Agent 伪装逻辑 ---
    const clientUA = req.headers['user-agent'] || '';
    
    // 判断是否为浏览器访问 (用来决定是显示网页还是直接返回数据)
    // 如果 URL 里带了 &browser=true 强制显示网页
    const isBrowser = (clientUA.match(/(Mozilla|Chrome|Safari|Edge)/i) && 
                      !clientUA.match(/(Clash|Shadowrocket|Quantumult|Stash|V2Ray|Sing-Box)/i));
    
    // 构造发给机场的 Headers
    const proxyHeaders = {};
    proxyHeaders['Accept'] = '*/*';
    proxyHeaders['Connection'] = 'close';

    // === 核心：决定用什么身份去请求机场 ===
    if (isBrowser) {
        // 如果是浏览器在预览，根据用户点击的按钮来伪装
        if (targetUA === 'clash') {
            proxyHeaders['User-Agent'] = 'Clash/Meta'; // 诱导返回 YAML
        } else if (targetUA === 'singbox') {
            proxyHeaders['User-Agent'] = 'Sing-Box/1.0'; // 诱导返回 JSON
        } else {
            // 默认伪装成 v2rayNG (通常返回 Base64)
            proxyHeaders['User-Agent'] = '2rayNG/1.8.5'; 
        }
    } else {
        // === 关键点：工具直连 ===
        // 如果是 Clash 软件在访问，直接透传它的 UA，确保机场识别正确
        proxyHeaders['User-Agent'] = clientUA;
    }

    // --- 3. 发起请求 ---
    const requestModule = targetUrl.startsWith('https') ? https : http;
    
    const proxyReq = requestModule.get(targetUrl, {
        headers: proxyHeaders,
        rejectUnauthorized: false // 忽略 SSL 错误
    }, (proxyRes) => {
        
        // --- 场景 A: 浏览器预览 (返回漂亮的 HTML) ---
        if (isBrowser) {
            let rawData = [];
            
            proxyRes.on('data', (chunk) => { 
                rawData.push(chunk); 
            });
            
            proxyRes.on('end', () => {
                // 拼接 Buffer，防止中文乱码
                const fullBuffer = Buffer.concat(rawData);
                const content = fullBuffer.toString('utf8');
                
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(renderDashboard(targetUrl, proxyRes.statusCode, content, targetUA));
            });
            return;
        }

        // --- 场景 B: 订阅工具直连 (返回纯净数据) ---
        res.statusCode = proxyRes.statusCode;
        // 转发所有重要的 Header (Content-Type, Disposition 等)
        Object.keys(proxyRes.headers).forEach(key => {
            // 排除可能引起传输错误的头
            if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key)) {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        // 允许跨域
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // 直接管道转发，不做任何处理，保证源汁源味
        proxyRes.pipe(res);
    });

    // 错误处理
    proxyReq.on('error', (e) => {
        res.statusCode = 502;
        res.end(`Proxy Error: ${e.message}`);
    });

    proxyReq.end();
};

// --- 首页 HTML ---
function renderHome() {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vercel 订阅代理</title>
        <style>
            body { background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .card { background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); width: 90%; max-width: 480px; }
            h2 { margin-top: 0; color: #1a1a1a; text-align: center; }
            input { width: 100%; padding: 12px; margin: 20px 0; border: 2px solid #e1e4e8; border-radius: 8px; box-sizing: border-box; font-size: 16px; transition: border-color 0.2s; }
            input:focus { border-color: #0070f3; outline: none; }
            button { background: #0070f3; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; }
            button:hover { background: #0051a2; }
            .note { margin-top: 20px; font-size: 13px; color: #666; line-height: 1.5; background: #fafafa; padding: 10px; border-radius: 6px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🚀 订阅加速代理</h2>
            <form onsubmit="event.preventDefault(); window.location.href='?url='+encodeURIComponent(this.u.value)">
                <input name="u" placeholder="在此粘贴原始订阅链接..." required>
                <button type="submit">生成代理链接</button>
            </form>
            <div class="note">
                <strong>✨ 功能说明：</strong><br>
                1. 自动解决机场屏蔽/墙问题<br>
                2. 支持浏览器预览不同格式 (Clash/Base64)<br>
                3. 工具访问时自动透传原始内容
            </div>
        </div>
    </body>
    </html>`;
}

// --- 仪表盘 HTML (代码框风格) ---
function renderDashboard(targetUrl, status, content, currentUA) {
    const isOk = status >= 200 && status < 300;
    const statusColor = isOk ? '#10b981' : '#ef4444';
    
    // 计算当前 URL (不带 ua 参数)
    const baseUrl = `?url=${encodeURIComponent(targetUrl)}`;
    
    // 按钮样式
    const btnClass = "padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; border: 1px solid rgba(255,255,255,0.2); margin-right: 8px; transition: all 0.2s;";
    const activeBtn = "background: #0070f3; color: white; border-color: #0070f3;";
    const inactiveBtn = "background: rgba(255,255,255,0.05); color: #888; hover:background: rgba(255,255,255,0.1);";

    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>订阅预览</title>
        <style>
            body { margin: 0; padding: 0; background: #0d1117; color: #c9d1d9; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; height: 100vh; display: flex; flex-direction: column; }
            .header { background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 24px; flex-shrink: 0; }
            .status-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
            .url-display { font-size: 14px; color: #8b949e; word-break: break-all; }
            .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; background: ${statusColor}; }
            
            .toolbar { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
            .btn-group { display: flex; }
            
            .editor-container { flex: 1; overflow: hidden; position: relative; display: flex; }
            .line-numbers { background: #0d1117; border-right: 1px solid #30363d; padding: 16px 10px; text-align: right; color: #484f58; font-size: 13px; line-height: 1.5; user-select: none; min-width: 40px; overflow: hidden; }
            .code-content { flex: 1; padding: 16px; overflow: auto; font-size: 13px; line-height: 1.5; white-space: pre; color: #e6edf3; tab-size: 4; }
            
            /* 滚动条样式 */
            ::-webkit-scrollbar { width: 10px; height: 10px; }
            ::-webkit-scrollbar-track { background: #0d1117; }
            ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 5px; }
            ::-webkit-scrollbar-thumb:hover { background: #484f58; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="status-bar">
                <div class="url-display">Target: ${targetUrl}</div>
                <div class="badge">Status: ${status}</div>
            </div>
            <div class="toolbar">
                <span style="font-size: 13px; color: #8b949e;">预览格式 (模拟UA): </span>
                <div class="btn-group">
                    <a href="${baseUrl}&ua=default" style="${btnClass} ${currentUA==='default' || !currentUA ? activeBtn : inactiveBtn}">Base64 (默认)</a>
                    <a href="${baseUrl}&ua=clash" style="${btnClass} ${currentUA==='clash' ? activeBtn : inactiveBtn}">Clash</a>
                    <a href="${baseUrl}&ua=singbox" style="${btnClass} ${currentUA==='singbox' ? activeBtn : inactiveBtn}">Sing-box</a>
                </div>
                <span style="flex:1"></span>
                <span style="font-size: 13px; color: #484f58;">大小: ${(content.length/1024).toFixed(2)} KB</span>
            </div>
        </div>
        
        <div class="editor-container">
            <div class="code-content">${content.replace(/</g, '&lt;')}</div>
        </div>
    </body>
    </html>`;
}
