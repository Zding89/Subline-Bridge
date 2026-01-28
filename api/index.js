const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Subline-Bridge
 * 1. 改名为 Subline-Bridge
 * 2. 主页垂直居中，标题居中
 * 3. 主页说明移动到底部
 * 4. 预览页 URL 自动换行全显示
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
        height: 100vh; /* 强制占满全屏 */
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
    }

    /* 居中容器 */
    .center-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center; /* 垂直居中 */
        align-items: center;
        width: 100%;
        padding: 20px;
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
        height: 32px; /* 稍微减小高度 */
        padding: 0 10px; /* 减小内边距，防止移动端挤压 */
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
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { color: var(--fg); border-color: var(--fg); }
    .btn-primary { background: var(--fg); color: var(--bg); border-color: var(--fg); height: 40px; font-size: 14px; }
    .btn-primary:hover { background: #333; color: #fff; }
    .btn-active { background: var(--fg); color: var(--bg); border-color: var(--fg); }

    /* 输入框 */
    input {
        width: 100%;
        height: 44px;
        padding: 0 12px;
        font-size: 15px;
        border: 1px solid var(--gray-100);
        border-radius: 6px;
        transition: border-color 0.15s;
        margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: var(--fg); }

    /* 生成结果区域 */
    .result-area {
        margin-top: 20px;
        border-top: 1px solid var(--gray-100);
        padding-top: 20px;
        display: none; /* 默认隐藏 */
    }
    .result-link {
        background: var(--gray-50);
        padding: 12px;
        border-radius: 6px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--gray-900);
        word-break: break-all; /* 自动换行 */
        border: 1px solid var(--gray-100);
        margin-bottom: 12px;
        cursor: text;
        max-height: 100px;
        overflow-y: auto;
    }
    .action-buttons {
        display: flex;
        gap: 10px;
    }
    .action-buttons .btn {
        flex: 1;
        height: 36px;
    }

    /* 预览页特定样式 */
    .preview-header {
        position: sticky;
        top: 0;
        background: rgba(255,255,255,0.95);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--gray-100);
        z-index: 10;
        padding: 12px 0;
        width: 100%;
    }
    
    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start; /* 顶部对齐，适应换行内容 */
        gap: 12px;
        flex-wrap: wrap;
    }

    .title-group {
        display: flex;
        flex-direction: column; /* 改为垂直排列，适应长URL */
        align-items: flex-start;
        gap: 4px;
        min-width: 0;
        flex: 1; /* 占据剩余空间 */
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .logo-text { font-weight: 700; font-size: 15px; letter-spacing: -0.5px; }
    
    .url-text {
        color: var(--gray-500);
        font-size: 12px;
        font-family: var(--font-mono);
        /* 移除截断，改为换行 */
        word-break: break-all;
        line-height: 1.4;
    }

    .toolbar {
        display: flex;
        gap: 6px; /* 减小间距 */
        flex-wrap: wrap;
        align-items: center;
        flex-shrink: 0; /* 防止被挤压 */
    }

    .code-wrapper {
        flex: 1;
        display: flex;
        font-family: var(--font-mono);
        font-size: 13px;
        line-height: 20px;
        padding-top: 20px;
        overflow-x: auto;
    }

    .line-nums {
        text-align: right;
        padding-right: 12px;
        color: var(--gray-200);
        user-select: none;
        border-right: 1px solid var(--gray-100);
        margin-right: 12px;
        min-width: 36px;
        white-space: pre; 
    }
    .code-body {
        color: var(--fg);
        white-space: pre;
        tab-size: 2;
    }

    /* 移动端适配 */
    @media (max-width: 600px) {
        .header-row { flex-direction: column; align-items: stretch; gap: 12px; }
        .title-group { width: 100%; } /* 手机端占满宽度 */
        .toolbar { width: 100%; justify-content: space-between; }
        .btn { padding: 0 8px; font-size: 12px; } /* 进一步缩小移动端按钮 */
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
        <title>Subline-Bridge</title>
        ${commonStyle}
        <script>
            function generateLink() {
                const input = document.getElementById('urlInput');
                const originalUrl = input.value.trim();
                
                if (!originalUrl) {
                    input.focus();
                    return;
                }

                // 构造当前站点的 API 地址
                const host = window.location.host;
                const protocol = window.location.protocol;
                const proxyUrl = \`\${protocol}//\${host}/api?url=\${encodeURIComponent(originalUrl)}\`;

                // 显示结果区域
                document.getElementById('resultArea').style.display = 'block';
                const linkBox = document.getElementById('generatedLink');
                linkBox.textContent = proxyUrl;
                
                // 更新预览按钮链接
                document.getElementById('previewBtn').onclick = () => {
                    window.location.href = \`?url=\${encodeURIComponent(originalUrl)}\`;
                };

                // 滚动到底部
                linkBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            function copyHomeLink() {
                const text = document.getElementById('generatedLink').textContent;
                copyToClipboard(text, document.getElementById('copyHomeBtn'));
            }

            // 通用复制函数
            function copyToClipboard(text, btnElement) {
                const doCopy = () => {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        return navigator.clipboard.writeText(text);
                    }
                    // 兼容旧版
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    return Promise.resolve();
                };

                doCopy().then(() => {
                    const originalText = btnElement.innerText;
                    btnElement.innerText = '已复制';
                    btnElement.classList.add('btn-active');
                    setTimeout(() => {
                        btnElement.innerText = originalText;
                        btnElement.classList.remove('btn-active');
                    }, 2000);
                }).catch(() => alert('复制失败，请手动选择复制'));
            }
        </script>
    </head>
    <body>
        <div class="center-wrapper">
            <div class="container" style="max-width: 600px;">
                <div style="border: 1px solid var(--gray-100); border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <!-- 标题居中 -->
                    <div style="margin-bottom: 24px; text-align: center;">
                        <h1 style="font-size: 22px; font-weight: 700; margin: 0;">Subline-Bridge</h1>
                    </div>

                    <form onsubmit="event.preventDefault(); generateLink()">
                        <input id="urlInput" name="u" placeholder="在此粘贴原始订阅链接..." required autofocus autocomplete="off">
                        <button type="submit" class="btn btn-primary" style="width: 100%;">转换</button>
                    </form>

                    <!-- 生成结果区域 -->
                    <div id="resultArea" class="result-area">
                        <div style="font-size: 12px; color: var(--gray-500); margin-bottom: 6px;">转换后的订阅链接：</div>
                        <div id="generatedLink" class="result-link" onclick="const range=document.createRange();range.selectNodeContents(this);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);"></div>
                        <div class="action-buttons">
                            <button id="copyHomeBtn" type="button" class="btn" onclick="copyHomeLink()">复制</button>
                            <button id="previewBtn" type="button" class="btn">预览</button>
                        </div>
                    </div>

                    <!-- 说明列表移动到底部 -->
                    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px dashed var(--gray-100);">
                        <ul style="padding-left: 20px; color: var(--gray-500); font-size: 13px; margin: 0; line-height: 1.6;">
                            <li>解决订阅链接连接被墙问题</li>
                            <li>支持浏览器预览与转换</li>
                        </ul>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 24px; font-size: 12px; color: var(--gray-200); display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span>Powered by Zding</span>
                    <a href="https://github.com/Zding89/Subline-Bridge" target="_blank" style="color: inherit; display: flex; text-decoration: none; align-items: center;" title="View on GitHub">
                        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                            <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                        </svg>
                    </a>
                </div>
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
                const btn = document.getElementById('copyBtn');
                
                // 增强型复制逻辑：兼容移动端 WebView
                const copyToClipboard = (text) => {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        return navigator.clipboard.writeText(text);
                    }
                    return new Promise((resolve, reject) => {
                        try {
                            const textArea = document.createElement("textarea");
                            textArea.value = text;
                            textArea.style.position = "fixed";
                            textArea.style.left = "-9999px";
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    });
                };

                copyToClipboard(url).then(() => {
                    const originalText = btn.innerText;
                    btn.innerText = '已复制';
                    btn.classList.add('btn-active');
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.classList.remove('btn-active');
                    }, 2000);
                }).catch(err => {
                    alert('复制失败，请手动复制浏览器地址栏');
                });
            }
        </script>
    </head>
    <body>
        <header class="preview-header">
            <div class="container header-row">
                <!-- 左侧：标题与状态 -->
                <div class="title-group">
                    <div class="title-row">
                        <div class="logo-text">Preview</div>
                        <span style="${badgeStyle}">${status}</span>
                    </div>
                    <!-- URL 自动换行 -->
                    <span class="url-text" title="${targetUrl}">${targetUrl}</span>
                </div>
                
                <!-- 右侧：工具栏 -->
                <div class="toolbar">
                    <a href="${baseUrl}&ua=clash" class="btn ${currentUA==='clash'?'btn-active':''}">Clash</a>
                    <a href="${baseUrl}&ua=singbox" class="btn ${currentUA==='singbox'?'btn-active':''}">Sing-box</a>
                    <a href="${baseUrl}&ua=base64" class="btn ${currentUA==='base64'?'btn-active':''}">Base64</a>
                    <!-- 复制按钮 -->
                    <button id="copyBtn" onclick="copyLink()" class="btn">复制链接</button>
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
