# v2-civ · 中国独立游戏社团地图（《文明6》画风）

全国是一个 3D 世界、一个镜头（`src/scene.js`）：没有社群的地方是古舆图纸面（`src/natink.js`），有社群的城市周围从纸上长出 3D 地块（`src/data/patches.json`，现在 7 块：长三角、京津、成渝、珠三角、关中、辽沈、闽南闽东），从全国一路滚轮推到街区，不换页。坐标是全国统一的阿尔伯斯投影（`src/albers.js`），六边形是全国一张网格。Vite + three.js，建筑是 Blender 烘焙的 GLB（`assets-src/`）。方案见 `docs/全国一张世界方案.md`（城市表、合规等见 `docs/全国版规划方案.md`）。

## 怎么跑

```bash
cd v2-civ
npm install
npm run dev      # 开发预览
npm run build    # 产物在 dist/，任何静态服务器都能开，例如 npx serve dist
```

URL 参数：不带参数从全国视角开始；`?region=chengyu` 从某地块全景开始，`?view=hangzhou&d=60` 直接看某城，`?open=cyberia` 打开某社团面板，`?tour` 自动从全国推到杭州，`?paper=mo` 换纯墨做旧纸面。调试/截图用：`?cx=1400&cz=600&d=50` 看任意坐标（全国公里坐标），`?q=low` 强制手机画质，`?ao=0` 关掉顶点环境光遮蔽（对比用），`?mock=shanghai:40` 加占位社群测试城市分档。

城市范围按社群数自动分档、社群自动落位，规则和新增社群的流程见 `docs/城市规模与据点方案.md`。

## 数据来源

- 高程：AWS Terrain Tiles（Terrarium，z9，含 SRTM/GEBCO 等），每个地块烘焙成 `public/data/patches/<地块>/height.png`；高程上限按地块自动定（`patches.json` 的 `hmax`），地貌和山形按"高出本地块低地多少"判断，成都平原不会被当成山。
- 海岸、湖泊、江河：Terrarium 水深 + Natural Earth 10m（land / lakes / rivers），烘焙成水域距离场 `water.png`。长三角的运河、黄浦江、西湖为手绘近似。
- 全国纸面：省界、国界、九段线和全部地级城市驻地来自 DataV.GeoAtlas（高德数据），江河湖泊来自 Natural Earth，山形和海面来自 Terrarium z6，烘焙成 `public/data/china/` 和 `src/data/china-cities.json`，浏览器里画成古舆图。**正式公开前要按《全国版规划方案》3.2 节换成标准地图数据。**
- 重新烘焙（需要 numpy、Pillow、scipy；没有 Python 时可用 Blender 自带的 Python，见 `assets-src/README.md`）：新增社群后先跑 `node scripts/patches.mjs`（按社群城市自动算地块：320 公里内的城市连成一块，外扩 150 公里），再跑 `python scripts/bake_patch.py [地块…]` 烘地块（自动下载高程和 Natural Earth）；`python scripts/bake_china.py` 烘全国纸面数据。原始数据放 `bake-raw/`，不进仓库。地块的名字沿用 `src/data/regions.json`（按中心就近匹配），新地区可在那里加一行起名。
- 社团：直接读仓库 `site/data/communities.json`，logo 由 `site/images/` 缩成 256px webp。

## 画面环境（P2）

- **地表贴图**：`scripts/paint_textures.py` 程序化画 6 张 512² 无缝手绘贴图（草地、水田、林地、山石、沙滩、雪地），A 通道存高度，竖排成一张 `public/tex/terrain.webp`（约 500 KB），前端读成一张 2D 数组纹理。地形着色器按地貌、高程、坡度和噪声算各层权重，再按高度混合；地貌权重先经大幅噪声扭曲再取样，拉远看不到六边形马赛克。水田行向跟着每块田转，稻浪随风走。手机少采一层宏观纹理。改贴图：改脚本后 `python3 scripts/paint_textures.py --preview`（预览图在 /tmp/igcm-tex/），再把脚本打印的各层平均色填进 `terrain.js` 的 `M_*` 常量。
- **水**：波纹法线图在加载时用正弦波叠加生成（不下载）；按水域距离场的切线方向做双相位流动，河道往东流，沿岸泡沫顺着海岸漂；浅水透出沙底和焦散，向岸推进的浪线，成片出现的波光。运河等细河用同一张波纹图沿河道流动。
- **云**：迷雾边缘的云团、开场云层和地面云影已去掉，未开拓区域只保留羊皮纸古舆图。
- **生命感**（`life.js`）：树随风摆、阵风成片推过林子（顶点着色器），稻浪，村落和城里炊烟（粒子全在着色器里），路上行人戴斗笠、牛车，湖和城市上空的鸟群（翅膀在顶点着色器里扇），灯笼和窗光闪烁、霓虹偶尔跳闪。
- **顶点环境光遮蔽**（`ao.js` + `ao.worker.js`）：`bakeAO(object3D, { radius, strength })` 对任意网格层级通用：先把长三角形细分，再在 worker 里体素化、每个顶点打半球射线，结果乘进顶点色并按几何指纹缓存。现在接在城市、社团建筑、西湖、树和民居上；以后新建筑（包括异步加载的 GLB）建好后调一次即可。手机关掉实时后期也有体积感。
- **字体**：横幅、标题、社团名用思源宋体 Bold 子集（改名 IGCM Serif，OFL 要求改名），约 57 KB。改了社团数据或界面文案后在 `v2-civ` 下重跑 `python3 scripts/font_subset.py`（首次会下载字体到 `scripts/.cache/`，不提交）。
- **界面**：`icons.js` 统一线描图标和两套描金边框（SVG + border-image 九宫格），标题牌、按钮、列表、侧面板、城市横幅都换了。
- **性能**：纸面区域跳过整套地表着色；屏幕空间 AO 只在拉近（<140）时开；帧率低于约 52 时自动降一档渲染分辨率（只降不升）。gzip 总量约 1.41 MB（桌面），手机不加载后期约 1.28 MB。截图在 `env-shots/`。

## 做了哪些文明6元素

连续地形 + 淡六边形网格；羊皮纸战争迷雾（古舆图墨线山形、水波纹、城池符号、罗盘，边缘烧焦+薄雾，开场从城市向外揭开）；现代 CBD 城市中心（按档位 6 种天际线，Blender 烘焙）+ 城市横幅 + 领土描边；7 种现代据点造型（孵化器 · 路演厅、环形社区客厅、霓虹电竞塔 · 咖啡馆、穹顶科技馆、潮玩街区、存档站、松林艺术工坊）+ logo 旗；乡村是两层小洋楼；悬停高亮/点击飞入/侧面板（微信、QQ 群一键复制）；Ludere 上海—常熟商路和商队；开场巡游建城（光柱、尘土、回弹、通知卡片）+ 重播；黄山自然奇观与云海、西湖雷峰塔、京杭运河乌篷船；AO、辉光、移轴景深、ACES 调色、大气雾；手机自动降画质、底部面板。

## 已知不足

- 同档位的城市共用两套 CBD 天际线，各城主要靠地标（东方明珠、天宁塔、方塔、雷峰塔、中华门）区分。
- 手机竖屏全景纸面占比偏大。
- n8ao 的半分辨率模式与 three r187 不兼容，桌面只在拉近时开 AO。
