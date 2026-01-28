# Subline-Bridge

Subline-Bridge 是一个运行在 Vercel 上的轻量级订阅代理工具。
解决订阅链接被墙、无法直连更新的问题，并提供优雅的移动端适配预览界面。

## 特性

利用 Vercel 边缘网络拉取被墙订阅。

自动识别 Clash/Shadowrocket 等工具。

支持手动切换 UA，诱导机场下发 Clash / Sing-box / Base64 格式。

## 部署

本项目专为 Vercel 设计，无需服务器。

Fork 本仓库。

在 Vercel 导入项目。

点击 Deploy 即可。

注意：vercel默认域名大部分地区被墙，需要自己添加自定义域名。

## 使用

1. Web 界面

访问你的 Vercel 域名，粘贴原始订阅链接，点击 "转换" 即可生成代理链接或预览。

2. URL 参数

直接拼接使用：
https://你的域名/api?url=https://机场订阅地址

强制格式参数 (&ua=):

clash (默认)

singbox

base64

示例：.../api?url=xxx&ua=base64

## 免责声明

本项目仅供学习研究，请勿用于非法用途。流量费用由用户自行承担。

Powered by Zding | GitHub Repository
