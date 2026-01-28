/**
 * Vercel Edge Function 订阅代理
 * 文件路径建议: api/proxy.js
 * 访问方式: https://你的域名.vercel.app/api/proxy?url=订阅链接
 */

export const config = {
    runtime: 'edge', // 必须使用 Edge Runtime，速度快且不限时
};

// 预设的高兼容性 User-Agent
const PROXY_CLIENT_UA = 'Clash/Meta';

export default async function handler(request) {
    const url = new URL(request.url);
    
    // 1. 获取目标 URL
    // 优先从 query 参数获取: ?url=https://...
    let targetUrl = url.searchParams.get('url');

    // 如果 query 没拿到，尝试从路径解析 (兼容某些特殊用法)
    // 例如: /api/proxy/https://sub.com...
    if (!targetUrl) {
        // 去掉 /api/proxy/ 前缀
        const path = url.pathname.replace(/^\/api\/proxy\//, '');
        if (path && path.length > 3) {
            targetUrl = path + url.search; // 把后续参数也补上
        }
    }

    // 2. 如果还是没有 URL，返回帮助页面
    if (!targetUrl) {
        return new Response(renderHelpPage(url.origin), {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
    }

    // 补全协议
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    // 3. 构造请求头
    const originalUA = request.headers.get('User-Agent') || '';
    const isBrowser = originalUA.match(/(Mozilla|Chrome|Safari|Edge|Opera)/i) && !originalUA.match(/(Clash|Shadowrocket|Quantumult|Stash|Surge|V2Ray|Sing-Box)/i);
    const wantRaw = url.searchParams.get('raw') === 'true';

    const headers = new Headers();
    
    // 伪装 Referer 和 Origin
    try {
        const targetOrigin = new URL(targetUrl).origin;
        headers.set('Referer', targetOrigin);
        headers.set('Origin', targetOrigin);
    } catch (e) { }

    // 智能 UA 伪装：如果是浏览器访问，伪装成 Clash；如果是工具，保持原样
    if (isBrowser) {
        headers.set('User-Agent', PROXY_CLIENT_UA);
    } else {
        headers.set('User-Agent', originalUA || PROXY_CLIENT_UA);
    }

    headers.set('Accept', '*/*');
    headers.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');

    // 4. 请求目标
    let response;
    let fetchError = null;
    const startTime = Date.now();

    try {
        response = await fetch(targetUrl, {
            method: 'GET',
            headers: headers,
            redirect: 'follow'
        });
    } catch (err) {
        fetchError = err;
    }
    const endTime = Date.now();

    // 5. 浏览器预览模式 (带 Dashboard)
    if (isBrowser && !wantRaw) {
        let bodyText = "";
        let status = 502;
        
        if (!fetchError) {
            status = response.status;
            bodyText = await response.text();
        } else {
            bodyText = `Error: ${fetchError.message}`;
        }
        
        // 简单检测是否被盾
        const isBlocked = status === 403 || status === 503 || bodyText.includes('Just a moment');

        return new Response(renderDashboard(targetUrl, status, endTime - startTime, bodyText, url.href, isBlocked), {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
    }

    // 6. 代理返回 (给订阅工具用)
    if (fetchError) {
        return new Response(`Proxy Error: ${fetchError.message}`, { status: 502 });
    }

    const newResponse = new Response(response.body, response);
    // 允许跨域
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    return newResponse;
}

// --- 简单的 HTML 渲染 ---
function renderHelpPage(origin) {
    // 自动判断当前的 api 路径
    const actionUrl = `${origin}/api/proxy`;
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vercel 订阅代理</title>
        <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0; margin: 0; }
            .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 90%; max-width: 400px; text-align: center; }
            input { width: 100%; padding: 10px; margin: 15px 0; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
            button { background: #000; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; }
            button:hover { background: #333; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Vercel 订阅代理</h2>
            <p style="color:#666; font-size: 0.9em">输入订阅链接，生成防墙地址</p>
            <input type="text" id="url" placeholder="https://airport.com/api/...">
            <button onclick="generate()">跳转生成</button>
        </div>
        <script>
            function generate() {
                const input = document.getElementById('url').value;
                if(!input) return;
                // Vercel 推荐使用 query 参数方式
                window.location.href = '${actionUrl}?url=' + encodeURIComponent(input);
            }
        </script>
    </body>
    </html>`;
}

function renderDashboard(targetUrl, status, time, content, fullUrl, isBlocked) {
    const color = status >= 200 && status < 300 ? '#10b981' : '#ef4444';
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background: #111; color: #eee; font-family: monospace; padding: 20px; }
            .status { color: ${color}; font-weight: bold; }
            .box { background: #222; padding: 15px; border-radius: 8px; margin-top: 20px; overflow: auto; }
            .warn { background: #422006; color: #fdba74; padding: 10px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #9a3412; }
            a { color: #60a5fa; }
        </style>
    </head>
    <body>
        ${isBlocked ? '<div class="warn">⚠️ 警告：检测到目标网站拦截 (403/503/WAF)。<br>建议直接复制链接到 Clash 使用，不要在浏览器刷新。</div>' : ''}
        
        <div>Target: ${targetUrl}</div>
        <div style="margin-top: 10px">
            Status: <span class="status">${status}</span> | Time: ${time}ms
        </div>

        <div style="margin-top: 20px">
            <a href="${fullUrl}&raw=true">查看原始内容 (Raw)</a>
        </div>

        <div class="box">
            <pre>${content.substring(0, 3000).replace(/</g, '&lt;')}</pre>
        </div>
    </body>
    </html>`;
}