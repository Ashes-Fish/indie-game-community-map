# 中国独立游戏社团地图

把国内的独立游戏社团 / 开发者社群按城市标注在一张地图上，方便找组织、找同行、找合作。

当前版本是 `v2-civ/`：用《文明6》画风做的长三角样片，推到 main 后由 GitHub Actions 自动构建并发布到 [GitHub Pages](https://ashes-fish.github.io/indie-game-community-map/)。

## 目录结构

```
v2-civ/                长三角《文明6》画风样片（Vite + three.js），说明见 v2-civ/README.md
site/
  ├── data/
  │   └── communities.json   社团名录主数据（v2-civ 构建时直接读取）
  └── images/          各社团 logo 与照片原图
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

```bash
cd v2-civ
npm install
npm run dev
```

## 参与补充

如果发现信息过时、城市标错，或想把自己所在的社团加进来，欢迎提 Issue 或 PR 修改 `communities.json`。新增社团请尽量补齐「名称 / 城市 / 负责人 / 联系方式」四项，否则地图上无法定位。
