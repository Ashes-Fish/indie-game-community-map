#!/bin/sh
# 构建全国版并上传到腾讯云服务器（宝塔 nginx 静态站，http://118.89.150.249:8090/）。
# 用法：在 v2-civ 目录里 sh deploy/update.sh
# 需要能用密钥以 root 登录服务器：默认 ~/.ssh/id_ed25519_cloudrelay，可用 SSH_KEY、SERVER 覆盖。
# 先在临时目录解压，再整体换掉旧目录（上一版留在 igcm.old，出问题可以手动换回来）。
set -e
cd "$(dirname "$0")/.."
SERVER="${SERVER:-root@118.89.150.249}"
KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_cloudrelay}"
npx vite build --emptyOutDir
tar -C dist -czf - . | ssh -i "$KEY" "$SERVER" 'set -e; R=/www/wwwroot/igcm; rm -rf $R.new; mkdir -p $R.new; tar -C $R.new -xzf -;
  if [ -d $R ]; then rm -rf $R.old; mv $R $R.old; fi; mv $R.new $R; chown -R www:www $R 2>/dev/null || true;
  echo "已更新：$(find $R -type f | wc -l) 个文件"'
