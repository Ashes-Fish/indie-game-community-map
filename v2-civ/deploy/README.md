# 全国版部署（腾讯云服务器）

全国版是纯静态站：构建产物 `dist/` 放到服务器上，由宝塔自带的 nginx 直接提供，不需要 Node 进程。

- 服务器：`118.89.150.249`（OpenCloudOS 9，宝塔面板），root 用密钥 `~/.ssh/id_ed25519_cloudrelay` 登录
- 文件目录：`/www/wwwroot/igcm`（上一版保留在 `/www/wwwroot/igcm.old`）
- nginx 站点：`/www/server/panel/vhost/nginx/igcm.conf`（内容同本目录的 `nginx-igcm.conf`），监听 **8090**
- 访问地址：`http://118.89.150.249:8090/`
- 同一台机器上还有和光官网（80 端口的域名站、8080 端口的 IP 预览），互不影响

## 更新

在 `v2-civ` 目录里：

```sh
sh deploy/update.sh
```

会重新构建、上传、整体替换。浏览器缓存：`assets/` 下带哈希的文件缓存一年，模型、数据、贴图缓存 1 小时，首页不缓存。

## 回滚

```sh
ssh -i ~/.ssh/id_ed25519_cloudrelay root@118.89.150.249 'cd /www/wwwroot && mv igcm igcm.bad && mv igcm.old igcm'
```

## 端口

腾讯云控制台 → 轻量应用服务器 / 云服务器 → 这台机器 →「防火墙」或「安全组」→ 入站规则，放开 **TCP 8090**，来源 `0.0.0.0/0`。服务器本机的防火墙没有拦 8090。

## 以后换成域名

有了备案的域名后，把 `nginx-igcm.conf` 里的 `listen 8090` 改成 `listen 80` 并写上 `server_name 你的域名`，再在宝塔里申请证书开 https。

## 注意

全国版用了 DataV 的省界数据，地图合规（审图号）问题还没解决；公开访问前已知悉这一点（2026-11-16 决定公开）。

## 提交反馈

页面左下角「提交反馈」→ 称呼、邮箱、内容 → `POST /api/feedback` → nginx 转给本机 `127.0.0.1:3201` 的 `feedback-server.mjs`（只用 Node 自带模块）。

- 服务：`systemctl status igcm-feedback`（`/etc/systemd/system/igcm-feedback.service`，以 `igcm` 用户运行）
- 数据：`/srv/igcm-feedback/feedback.jsonl`，一行一条 `{at,name,email,text,page,ua,ip}`。查看：
  `ssh -i ~/.ssh/id_ed25519_cloudrelay root@118.89.150.249 'cat /srv/igcm-feedback/feedback.jsonl'`
- 防刷：隐藏字段、每个 IP 10 分钟 5 条、全站每天 500 条
- 邮件通知：`/etc/igcm-feedback.env`（权限 600，自己在服务器上写，授权码不进仓库）
  ```
  SMTP_USER=xxx@qq.com
  SMTP_PASS=<QQ 邮箱授权码>
  NOTIFY_TO=xxx@qq.com
  ```
  改完 `systemctl restart igcm-feedback`；`curl -s 127.0.0.1:3201/api/feedback/health` 里 `"mail":true` 即已开启。不配则只存不发。
- 更新接收程序：`scp feedback-server.mjs root@…:/srv/igcm-feedback/ && systemctl restart igcm-feedback`
- 本地开发：`PORT=3201 node deploy/feedback-server.mjs`，vite 已把 `/api` 代理过去。

## 二维码

`docs/网站二维码.png` / `.svg` 指向 `http://118.89.150.249:8090/`（纠错等级 H）。用手机相机或浏览器扫码可直接打开；微信内置浏览器对 IP + http 链接可能提示"非官方网页"，点"继续访问"即可，要彻底消除需要备案域名 + https。
