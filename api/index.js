/**
 * Vercel Serverless Function 代理 (Node.js 版)
 * 核心：必须放在 api/index.js 路径下！
 */

// 这是一个标准的 Node.js 函数，兼容性最强
export default async function handler(req, res) {
    // 1. 解析目标 URL
    // 支持两种方式：
    // A. ?url=https://...
    // B. /api/https://... (路径参数)
    
    let targetUrl = req.query.url;

    // 如果 query 里没有，尝试从路径里解析
    // req.url 可能是 "/api/index?url=..." 也可能是 "/api/sub.com/..."
    if (!targetUrl) {
        // 移除 "/api/" 前缀，剩下的就是目标
        // 注意：Vercel 的 rewrite 规则可能会影响 req.url，这里做个简单处理
        const pathPart = req.url.replace(/^\/api\//, '').replace(/^\//, '');
        
        // 如果路径里包含实质内容 (不是空的或者仅仅是 index)
        if (pathPart && pathPart !== 'index' && !pathPart.startsWith('?')) {
            targetUrl = pathPart;
            // 把 query 参数补回去 (比如 ?token=123)
            const queryIndex = req.url.indexOf('?');
            if (queryIndex !== -1) {
                targetUrl += req.url.substring(queryIndex);
            }
        }
    }

    // 2. 如果还是没有 URL，返回帮助页面
    if (!targetUrl) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(renderHelpPage());
    }

    // 3. 自动补全 https
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    // 4. 构造请求头
    const originalUA = req.headers['user-agent'] || '';
    const isBrowser = originalUA.match(/(Mozilla|Chrome|Safari|Edge|Opera)/i) && !originalUA.match(/(Clash|Shadowrocket|Quantumult|Stash|Surge|V2Ray)/i);
    const wantRaw = req.query.raw === 'true';

    // 准备发送给目标服务器的 Headers
    const fetchHeaders = new Headers();
    
    // 伪装 User-Agent
    const PROXY_UA = 'Clash/Meta';
    if (isBrowser) {
        fetchHeaders.set('User-Agent', PROXY_UA);
    } else {
        fetchHeaders.set('User-Agent', originalUA || PROXY_UA);
    }

    // 简单的反爬虫绕过
    fetchHeaders.set('Accept', '*/*');
    try {
        const u = new URL(targetUrl);
        fetchHeaders.set('Host', u.host);
    } catch(e) {}

    // 5. 发起请求 (Node 18+ 原生 fetch)
    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: fetchHeaders,
            redirect: 'follow'
        });

        // 6. 浏览器预览模式 (Dashboard)
        if (isBrowser && !wantRaw) {
            const bodyText = await response.text();
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(renderDashboard(targetUrl, response.status, bodyText, isBrowser));
        }

        // 7. 代理模式 (直接返回流)
        // 复制响应头
        response.headers.forEach((value, key) => {
            // 排除可能导致乱码或错误的头
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        // 允许跨域
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status);

        // 将流导向 response
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));

    } catch (error) {
        return res.status(502).send(`Proxy Error: ${error.message}`);
    }
}

// --- 简单的 HTML 界面 ---
function renderHelpPage() {
    return `
    <html>
    <body style="font-family: sans-serif; padding: 50px; text-align: center; background: #f5f5f5;">
        <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto;">
            <h2 style="color: #333;">Vercel 订阅代理</h2>
            <input type="text" id="url" placeholder="https://机场.com/api/..." style="width: 100%; padding: 12px; margin: 20px 0; border: 1px solid #ddd; border-radius: 5px;">
            <button onclick="go()" style="background: black; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; width: 100%;">生成代理链接</button>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">自动识别浏览器/Clash请求</p>
        </div>
        <script>
            function go() {
                const url = document.getElementById('url').value;
                if(url) window.location.href = '?url=' + encodeURIComponent(url);
            }
        </script>
    </body>
    </html>`;
}

function renderDashboard(target, status, content, isBrowser) {
    const isOk = status >= 200 && status < 300;
    const color = isOk ? 'green' : 'red';
    
    // 简单的转义防止 XSS
    const safeContent = content.replace(/</g, '&lt;').substring(0, 3000);

    return `
    <html>
    <body style="background: #111; color: #fff; font-family: monospace; padding: 20px;">
        <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
            <h3 style="margin: 0;">目标: ${target}</h3>
            <p>状态: <strong style="color: ${color}">${status}</strong> ${isBrowser ? '(已伪装UA)' : ''}</p>
            <a href="?url=${encodeURIComponent(target)}&raw=true" style="color: #3b82f6;">查看原始数据 (Raw)</a>
        </div>
        <pre style="white-space: pre-wrap; word-break: break-all; color: #ccc;">${safeContent}</pre>
    </body>
    </html>`;
}
