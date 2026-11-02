# 中国独立游戏社团地图

把国内的独立游戏社团 / 开发者社群按城市标注在一张地图上，方便找组织、找同行、找合作。

本项目包含两条并行的探索路径：

- **`site/`** —— 第一阶段的纯前端静态站点，常规地图视图，数据来自整理的社团名录。
- **`demo/`** —— 类《文明六》六边形地块风格的地图实验，尝试用 4X 游戏的视觉语言来组织"社交版图"。

## 目录结构

```
docs/                  开发文档（技术选型、数据层、阶段划分）
site/                  静态站点
  ├── index 相关入口
  ├── data.js          站点数据入口
  ├── data/
  │   └── communities.json   社团名录主数据
  └── images/          各社团 logo 与照片
demo/                  六边形地块地图实验
  ├── index.html       总览页
  ├── terrain.js/json  地形数据与渲染逻辑
  ├── tile/            单个地块页面
  ├── _bake/           地形烘焙脚本（bake.py）与生成的河流 geojson
  └── *.png            地块贴图与截图
附件下载_独立游戏社团信息统计表/
                      原始调研表格（xlsx）与配图
```

## 数据说明

社团主数据在 `site/data/communities.json`，每条记录包含：

| 字段 | 含义 |
| --- | --- |
| `name` | 社团名称 |
| `city` / `otherCities` | 主城市 / 覆盖的其他城市 |
| `founded` | 成立时间 |
| `address` | 所在地址或线上形式 |
| `leader` | 负责人 |
| `contact` | 联系方式 |
| `size` / `sizeRaw` | 成员规模 |
| `intro` | 一句话简介 |
| `wechatGroup` / `qqGroup` | 微信群 / QQ 群 |
| `website` | 官网 |
| `logo` / `photos` | 图片资源 |

> ⚠️ 数据中的联系方式来自公开征集与社群协作整理，仅用于方便同行互相找到彼此。请勿用于商业推广、批量加好友或任何形式的骚扰。

## 本地预览

`site/` 与 `demo/` 都是纯静态页面，起一个静态服务器即可：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/site/` 或 `http://localhost:8000/demo/`。

`demo/_bake/bake.py` 用于重新烘焙地形数据，需要 Python 环境，非必需。

## 参与补充

如果发现信息过时、城市标错，或想把自己所在的社团加进来，欢迎提 Issue 或 PR 修改 `communities.json`。新增社团请尽量补齐「名称 / 城市 / 负责人 / 联系方式」四项，否则地图上无法定位。
