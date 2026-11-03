# v2-civ · 长三角《文明6》画风样片

只做长三角一小块，用来判断画风。Vite + three.js，模型全部由代码程序化生成。

## 怎么跑

```bash
cd v2-civ
npm install
npm run dev      # 开发预览
npm run build    # 产物在 dist/，任何静态服务器都能开，例如 npx serve dist
```

URL 参数（调试/截图用）：`?instant` 跳过开场动画，`?view=hangzhou&d=60` 直接看某城，`?open=cyberia` 打开某社团面板，`?q=low` 强制手机画质。

## 数据来源

- 高程：AWS Terrain Tiles（Terrarium，z9，含 SRTM/GEBCO 等），烘焙成 `public/data/height.png`。
- 海岸、湖泊、长江：Terrarium 水深 + Natural Earth 10m（land / lakes / rivers），烘焙成水域距离场 `public/data/water.png`。运河、黄浦江、西湖为手绘近似。
- 社团：直接读仓库 `site/data/communities.json`，logo 由 `site/images/` 缩成 256px webp。
- 重新烘焙：`scripts/fetch_dem.py` 下载高程瓦片，Natural Earth 三个 geojson 放 `bake-raw/ne/`，再跑 `scripts/bake.py`。

## 做了哪些文明6元素

连续地形 + 淡六边形网格；羊皮纸战争迷雾（古舆图墨线山形、水波纹、城池符号、罗盘，边缘烧焦+薄雾，开场从城市向外揭开）；中式城郭城市中心 + 城市横幅 + 领土描边；7 个社团各一种区域造型（会馆戏台、土楼、赛博塔+咖啡馆、观星台、牌坊市街、存档亭、松林画室）+ logo 旗；悬停高亮/点击飞入/侧面板（微信、QQ 群一键复制）；Ludere 上海—常熟商路和商队；开场巡游建城（光柱、尘土、回弹、通知卡片）+ 重播；黄山自然奇观与云海、西湖雷峰塔、京杭运河乌篷船；AO、辉光、移轴景深、ACES 调色、大气雾；手机自动降画质、底部面板。

## 已知不足

- 地表是程序化着色，拉近后地面细节偏软，没有文明6那种手绘地形贴图；远景地块呈"马赛克"感。
- 建筑是简单低多边形，各城城郭长得差不多，只靠地标（东方明珠、天宁塔、方塔、雷峰塔、中华门）区分。
- 迷雾边缘是着色器里的烧焦+薄雾，不是文明6那种体积云；手机竖屏全景纸面占比偏大。
- n8ao 的半分辨率模式与 three r187 不兼容，桌面只在拉近时开 AO。
