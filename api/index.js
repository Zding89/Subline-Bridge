const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Vercel Proxy - 极简统一风格版
 * 1. 纯白 Vercel 风格 (主页/预览页统一)
 * 2. 完美适配移动端
 * 3. 修复行号对齐问题
 */
module.exports = (req, res) => {
    // --- 1. 参数解析 ---
    const currentUrl = new URL(req.url, `http://${req.headers.host}`);
    const queryUrl = currentUrl.searchParams.get('url');
    
    const targetUA = currentUrl.searchParams.get('ua') || 'clash'; 
    
    let targetUrl = '';

    if (queryUrl) {
        targetUrl = queryUrl;
    } else {
        const path = currentUrl.pathname.replace(/^\/api\//, '').replace(/^\//, '');
        if (path && path !== 'favicon.ico') {
            targetUrl = path + currentUrl.search;
        }
    }

    if (!targetUrl) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(renderHome());
        return;
    }

    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
    }

    // --- 2. 伪装逻辑 ---
    const clientUA = req.headers['user-agent'] || '';
    const isBrowser = (clientUA.match(/(Mozilla|Chrome|Safari|Edge)/i) && 
                      !clientUA.match(/(Clash|Shadowrocket|Quantumult|Stash|V2Ray|Sing-Box)/i));
    
    const proxyHeaders = {};
    proxyHeaders['Accept'] = '*/*';
    proxyHeaders['Connection'] = 'close';

    if (isBrowser) {
        if (targetUA === 'base64') {
            proxyHeaders['User-Agent'] = '2rayNG/1.8.5';
        } else if (targetUA === 'singbox') {
            proxyHeaders['User-Agent'] = 'Sing-Box/1.0';
        } else {
            proxyHeaders['User-Agent'] = 'Clash/Meta';
        }
    } else {
        proxyHeaders['User-Agent'] = clientUA;
    }

    // --- 3. 发起请求 ---
    const requestModule = targetUrl.startsWith('https') ? https : http;
    
    const proxyReq = requestModule.get(targetUrl, {
        headers: proxyHeaders,
        rejectUnauthorized: false
    }, (proxyRes) => {
        
        if (isBrowser) {
            let rawData = [];
            proxyRes.on('data', (chunk) => { rawData.push(chunk); });
            proxyRes.on('end', () => {
                const fullBuffer = Buffer.concat(rawData);
                const content = fullBuffer.toString('utf8');
                
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(renderDashboard(targetUrl, proxyRes.statusCode, content, targetUA, req.headers.host));
            });
            return;
        }

        res.statusCode = proxyRes.statusCode;
        Object.keys(proxyRes.headers).forEach(key => {
            if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key)) {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        res.statusCode = 502;
        res.end(`Proxy Error: ${e.message}`);
    });

    proxyReq.end();
};

// --- CSS 样式 (主页与预览页通用) ---
const commonStyle = `
<style>
    :root {
        --bg: #fff;
        --fg: #000;
        --gray-50: #fafafa;
        --gray-100: #eaeaea;
        --gray-200: #999;
        --gray-500: #666;
        --gray-900: #111;
        --success-bg: #d7f5fc;
        --success-fg: #0070f3;
        --error-bg: #fceceb;
        --error-fg: #ee0000;
        --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        --font-mono: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    
    * { box-sizing: border-box; }
    
    body {
        font-family: var(--font-sans);
        background-color: var(--bg);
        color: var(--fg);
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 0 20px;
        width: 100%;
    }

    /* 按钮通用样式 */
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        padding: 0 16px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 6px;
        border: 1px solid var(--gray-100);
        background: #fff;
        color: var(--gray-500);
        cursor: pointer;
        transition: all 0.15s ease;
        text-decoration: none;
        white-space: nowrap;
    }
    .btn:hover { color: var(--fg); border-color: var(--fg); }
    .btn-primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
    .btn-primary:hover { background: #333; color: #fff; }
    .btn-active { background: var(--fg); color: var(--bg); border-color: var(--fg); }

    /* 输入框 */
    input {
        width: 100%;
        height: 48px;
        padding: 0 16px;
        font-size: 16px;
        border: 1px solid var(--gray-100);
        border-radius: 6px;
        transition: border-color 0.15s;
        margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: var(--fg); }

    /* 预览页特定样式 */
    .preview-header {
        position: sticky;
        top: 0;
        background: rgba(255,255,255,0.9);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--gray-100);
        z-index: 10;
        padding: 16px 0;
    }
    
    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap; /* 手机端换行 */
    }

    .title-group {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0; /* 允许截断 */
    }

    .logo-text { font-weight: 700; font-size: 16px; letter-spacing: -0.5px; }
    
    .url-text {
        color: var(--gray-500);
        font-size: 13px;
        font-family: var(--font-mono);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 300px;
    }

    .toolbar {
        display: flex;
        gap: 8px;
        overflow-x: auto; /* 手机端横向滚动 */
        padding-bottom: 2px; /* 滚动条间距 */
    }

    .code-wrapper {
        flex: 1;
        display: flex;
        font-family: var(--font-mono);
        font-size: 13px;
        line-height: 20px;
        padding-top: 20px;
        overflow-x: auto; /* 代码过长横向滚动 */
    }

    /* 行号与代码对齐的关键 */
    .line-nums {
        text-align: right;
        padding-right: 16px;
        color: var(--gray-200);
        user-select: none;
        border-right: 1px solid var(--gray-100);
        margin-right: 16px;
        min-width: 40px;
    }
    .code-body {
        color: var(--fg);
        white-space: pre;
        tab-size: 2;
    }

    /* 移动端适配 */
    @media (max-width: 600px) {
        .url-text { display: none; } /* 手机端隐藏过长URL */
        .header-row { flex-direction: column; align-items: stretch; }
        .title-group { justify-content: space-between; }
        .toolbar { padding-top: 12px; }
        .btn { flex: 1; }
        .line-nums { min-width: 30px; font-size: 11px; }
        .code-body { font-size: 11px; }
    }
</style>
`;

// --- 主页 HTML ---
function renderHome() {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vercel Proxy</title>
        ${commonStyle}
    </head>
    <body>
        <div class="container" style="max-width: 600px; margin-top: 12vh;">
            <div style="border: 1px solid var(--gray-100); border-radius: 12px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="margin-bottom: 24px;">
                    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 12px 0;">Vercel Proxy</h1>
                    <ul style="padding-left: 20px; color: var(--gray-500); font-size: 14px; margin: 0; line-height: 1.6;">
                        <li>解决订阅链接连接被墙问题</li>
                        <li>支持浏览器预览</li>
                    </ul>
                </div>

                <form onsubmit="event.preventDefault(); window.location.href='?url='+encodeURIComponent(this.u.value)">
                    <input name="u" placeholder="在此粘贴原始订阅链接..." required autofocus autocomplete="off">
                    <button type="submit" class="btn btn-primary" style="width: 100%; height: 44px; font-size: 14px;">生成并预览</button>
                </form>
            </div>
            <div style="text-align: center; margin-top: 24px; font-size: 12px; color: var(--gray-200);">
                Powered by Vercel Edge Network
            </div>
        </div>
    </body>
    </html>`;
}

// --- 预览页 HTML ---
function renderDashboard(targetUrl, status, content, currentUA, host) {
    const isOk = status >= 200 && status < 300;
    const cleanProxyUrl = `https://${host}/api?url=${encodeURIComponent(targetUrl)}`;
    const baseUrl = `?url=${encodeURIComponent(targetUrl)}`;
    
    // 计算行数
    const lines = content.split('\n');
    const lineNumbers = Array.from({length: lines.length}, (_, i) => i + 1).join('\n');

    // 状态徽章样式
    const badgeStyle = `padding: 2px 8px; border-radius: 100px; font-size: 11px; font-weight: 600; background: ${isOk ? 'var(--success-bg)' : 'var(--error-bg)'}; color: ${isOk ? 'var(--success-fg)' : 'var(--error-fg)'}`;

    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preview</title>
        ${commonStyle}
        <script>
            function copyLink() {
                const url = "${cleanProxyUrl}";
                navigator.clipboard.writeText(url).then(() => {
                    const btn = document.getElementById('copyBtn');
                    const originalText = btn.innerText;
                    btn.innerText = '已复制';
                    btn.style.borderColor = '#000';
                    btn.style.color = '#000';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.style.borderColor = '';
                        btn.style.color = '';
                    }, 2000);
                });
            }
        </script>
    </head>
    <body>
        <header class="preview-header">
            <div class="container header-row">
                <!-- 左侧：标题与状态 -->
                <div class="title-group">
                    <div class="logo-text">Preview</div>
                    <span style="${badgeStyle}">${status}</span>
                    <span class="url-text" title="${targetUrl}">${targetUrl}</span>
                </div>
                
                <!-- 右侧：工具栏 -->
                <div class="toolbar">
                    <a href="${baseUrl}&ua=clash" class="btn ${currentUA==='clash'?'btn-active':''}">Clash</a>
                    <a href="${baseUrl}&ua=singbox" class="btn ${currentUA==='singbox'?'btn-active':''}">Sing-box</a>
                    <a href="${baseUrl}&ua=base64" class="btn ${currentUA==='base64'?'btn-active':''}">Base64</a>
                    <button id="copyBtn" onclick="copyLink()" class="btn" style="margin-left: 8px;">复制链接</button>
                </div>
            </div>
        </header>

        <div class="container" style="flex: 1; display: flex; overflow: hidden; margin-bottom: 20px;">
            <div class="code-wrapper">
                <div class="line-nums">${lineNumbers}</div>
                <div class="code-body">${content.replace(/</g, '&lt;')}</div>
            </div>
        </div>
    </body>
    </html>`;
}
