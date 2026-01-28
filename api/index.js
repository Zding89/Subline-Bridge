const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Vercel Proxy - Vercel Style Edition
 * 1. 默认 Clash 格式
 * 2. Vercel 极简黑白风格 UI
 * 3. 增加一键复制功能
 */
module.exports = (req, res) => {
    // --- 1. 参数解析 ---
    const currentUrl = new URL(req.url, `http://${req.headers.host}`);
    const queryUrl = currentUrl.searchParams.get('url');
    
    // 默认行为改为 'clash'
    const targetUA = currentUrl.searchParams.get('ua') || 'clash'; 
    
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
    
    // 判断是否为浏览器访问
    const isBrowser = (clientUA.match(/(Mozilla|Chrome|Safari|Edge)/i) && 
                      !clientUA.match(/(Clash|Shadowrocket|Quantumult|Stash|V2Ray|Sing-Box)/i));
    
    // 构造 Headers
    const proxyHeaders = {};
    proxyHeaders['Accept'] = '*/*';
    proxyHeaders['Connection'] = 'close';

    // === 核心：身份伪装 ===
    if (isBrowser) {
        // 浏览器预览模式：根据 selection 伪装
        if (targetUA === 'base64') {
            proxyHeaders['User-Agent'] = '2rayNG/1.8.5'; // Base64
        } else if (targetUA === 'singbox') {
            proxyHeaders['User-Agent'] = 'Sing-Box/1.0'; // JSON
        } else {
            // 默认 (clash)
            proxyHeaders['User-Agent'] = 'Clash/Meta';   // YAML
        }
    } else {
        // 工具直连模式：直接透传工具的 UA
        proxyHeaders['User-Agent'] = clientUA;
    }

    // --- 3. 发起请求 ---
    const requestModule = targetUrl.startsWith('https') ? https : http;
    
    const proxyReq = requestModule.get(targetUrl, {
        headers: proxyHeaders,
        rejectUnauthorized: false
    }, (proxyRes) => {
        
        // --- 场景 A: 浏览器预览 (返回 Vercel 风格 HTML) ---
        if (isBrowser) {
            let rawData = [];
            proxyRes.on('data', (chunk) => { rawData.push(chunk); });
            proxyRes.on('end', () => {
                const fullBuffer = Buffer.concat(rawData);
                const content = fullBuffer.toString('utf8');
                
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                // 传入 host 用于生成完整的复制链接
                res.end(renderDashboard(targetUrl, proxyRes.statusCode, content, targetUA, req.headers.host));
            });
            return;
        }

        // --- 场景 B: 工具直连 (透传数据) ---
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

// --- Vercel 风格 CSS ---
const vercelStyle = `
<style>
    :root {
        --geist-foreground: #000;
        --geist-background: #fff;
        --accents-1: #fafafa;
        --accents-2: #eaeaea;
        --accents-3: #999;
        --accents-4: #888;
        --accents-5: #666;
        --accents-8: #000;
        --success: #0070f3;
        --error: #ee0000;
        --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        --font-mono: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    body {
        font-family: var(--font-sans);
        background-color: var(--geist-background);
        color: var(--geist-foreground);
        margin: 0;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
    }
    .container {
        max-width: 960px;
        margin: 0 auto;
        padding: 0 24px;
        width: 100%;
        box-sizing: border-box;
    }
    .card {
        border: 1px solid var(--accents-2);
        border-radius: 8px;
        padding: 24px;
        margin-top: 40px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        transition: box-shadow 0.2s;
    }
    .card:hover {
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    }
    h1, h2 { letter-spacing: -0.05em; margin-top: 0; }
    h1 { font-size: 32px; font-weight: 700; }
    p { color: var(--accents-5); line-height: 1.6; }
    
    input {
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        border: 1px solid var(--accents-2);
        border-radius: 6px;
        margin: 16px 0;
        box-sizing: border-box;
        transition: border-color 0.15s ease;
    }
    input:focus { outline: none; border-color: var(--accents-8); }
    
    .btn {
        background: var(--geist-foreground);
        color: var(--geist-background);
        border: 1px solid var(--geist-foreground);
        padding: 0 24px;
        height: 40px;
        border-radius: 6px;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
    }
    .btn:hover { background: transparent; color: var(--geist-foreground); }
    .btn-secondary {
        background: transparent;
        color: var(--accents-5);
        border: 1px solid var(--accents-2);
    }
    .btn-secondary:hover { color: var(--geist-foreground); border-color: var(--geist-foreground); }
    .btn-active {
        background: var(--geist-foreground);
        color: var(--geist-background);
        border-color: var(--geist-foreground);
    }
    .btn-active:hover { color: var(--geist-background); background: #333; }

    .header { border-bottom: 1px solid var(--accents-2); padding: 16px 0; background: rgba(255,255,255,0.8); backdrop-filter: blur(5px); position: sticky; top: 0; z-index: 10; }
    .header-content { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-weight: 800; font-size: 20px; display: flex; align-items: center; gap: 8px; }
    .status-badge { font-size: 12px; padding: 4px 8px; border-radius: 100px; font-weight: 600; }
    .status-200 { background: #d7f5fc; color: #0070f3; }
    .status-error { background: #fceceb; color: #ee0000; }

    .editor-wrapper { flex: 1; display: flex; background: #000; color: #fff; overflow: hidden; }
    .line-numbers { padding: 20px 16px; text-align: right; color: #444; font-family: var(--font-mono); font-size: 13px; border-right: 1px solid #333; user-select: none; }
    .code-area { flex: 1; padding: 20px; overflow: auto; font-family: var(--font-mono); font-size: 13px; line-height: 1.5; white-space: pre; }
    
    .feature-list { list-style: none; padding: 0; margin: 20px 0; }
    .feature-list li { display: flex; align-items: center; margin-bottom: 12px; color: var(--accents-5); font-size: 14px; }
    .feature-list li::before { content: "✓"; margin-right: 10px; color: var(--geist-foreground); font-weight: bold; }
</style>
`;

// --- 主页 HTML (Vercel 风格) ---
function renderHome() {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vercel Proxy</title>
        ${vercelStyle}
    </head>
    <body>
        <div class="container" style="display: flex; flex-direction: column; justify-content: center; min-height: 80vh; max-width: 500px;">
            <div class="card">
                <h1>Vercel Proxy</h1>
                <p>一个极简、高速的订阅代理服务。</p>
                
                <ul class="feature-list">
                    <li>解决订阅链接连接被墙问题</li>
                    <li>支持浏览器预览 (自动识别格式)</li>
                    <li>增加一键复制订阅链接功能</li>
                </ul>

                <form onsubmit="event.preventDefault(); window.location.href='?url='+encodeURIComponent(this.u.value)">
                    <input name="u" placeholder="在此粘贴原始订阅链接..." required autofocus>
                    <button type="submit" class="btn" style="width: 100%;">生成代理链接</button>
                </form>
            </div>
            <p style="text-align: center; margin-top: 24px; font-size: 12px; color: var(--accents-3);">Powered by Vercel Edge Network</p>
        </div>
    </body>
    </html>`;
}

// --- 预览页 HTML (Vercel 风格) ---
function renderDashboard(targetUrl, status, content, currentUA, host) {
    const isOk = status >= 200 && status < 300;
    
    // 生成干净的代理链接 (不带 UA 参数，让工具自动处理)
    const cleanProxyUrl = `https://${host}/api?url=${encodeURIComponent(targetUrl)}`;
    
    const baseUrl = `?url=${encodeURIComponent(targetUrl)}`;

    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preview - ${status}</title>
        ${vercelStyle}
        <script>
            function copyLink() {
                const url = "${cleanProxyUrl}";
                navigator.clipboard.writeText(url).then(() => {
                    const btn = document.getElementById('copyBtn');
                    const originalText = btn.innerText;
                    btn.innerText = '已复制 ✓';
                    btn.style.background = '#000';
                    btn.style.color = '#fff';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 2000);
                });
            }
        </script>
    </head>
    <body>
        <div class="header">
            <div class="container header-content">
                <div class="logo">
                    <svg height="20" viewBox="0 0 116 100" fill="#000"><path fill-rule="evenodd" clip-rule="evenodd" d="M57.5 0L115 100H0L57.5 0Z" /></svg>
                    <span style="margin-left: 12px;">Proxy Preview</span>
                    <span class="status-badge ${isOk ? 'status-200' : 'status-error'}" style="margin-left: 10px;">${status}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <a href="${baseUrl}&ua=clash" class="btn btn-secondary ${currentUA==='clash'?'btn-active':''}" style="height: 32px; font-size: 12px;">Clash</a>
                    <a href="${baseUrl}&ua=singbox" class="btn btn-secondary ${currentUA==='singbox'?'btn-active':''}" style="height: 32px; font-size: 12px;">Sing-box</a>
                    <a href="${baseUrl}&ua=base64" class="btn btn-secondary ${currentUA==='base64'?'btn-active':''}" style="height: 32px; font-size: 12px;">Base64</a>
                    <button id="copyBtn" onclick="copyLink()" class="btn" style="height: 32px; font-size: 12px; margin-left: 8px;">复制链接</button>
                </div>
            </div>
            <div class="container" style="margin-top: 12px; font-size: 12px; color: var(--accents-5); display: flex; justify-content: space-between;">
                <span style="font-family: var(--font-mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 70%;">${targetUrl}</span>
                <span>Size: ${(content.length/1024).toFixed(2)} KB</span>
            </div>
        </div>
        
        <div class="editor-wrapper">
            <div class="line-numbers">
                ${Array.from({length: Math.min(100, content.split('\n').length)}, (_, i) => i + 1).join('\n')}
                ${content.split('\n').length > 100 ? '...' : ''}
            </div>
            <div class="code-area">${content.replace(/</g, '&lt;')}</div>
        </div>
    </body>
    </html>`;
}
