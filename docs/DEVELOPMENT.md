---
title: DEVELOPMENT
---

<Heading id="RTFIQe7P0Vz0L0AsW99fv0" level="1">
  中国独立游戏社团地图 · 开发文档
</Heading>

<BlockQuote id="zIsvb9VMCWJCJsJv7Jak6d">
  <Paragraph id="J4d4HBVNGAr0iDsf8idP21">
    版本：v1.0　｜　日期：2026-09-28　｜　状态：待确认\
    适用范围：<Mark bold>第一阶段（纯前端静态站）</Mark>。自建服务器相关内容放在第二阶段，本文第 12 节只列出预留的接口和迁移路径。
  </Paragraph>
</BlockQuote>

<Divider id="GmDt9lwX1YBqoxr0KQLw1g" />

<Heading id="4haZB8KNu5HJLkTQjOioYb" level="2">
  目录
</Heading>

<NumberedList id="4HPpD8gQ3klEjJP7KhOx6p">
  项目概述
</NumberedList>

<NumberedList id="UGKgKJLAjug3sRv4mD89cJ">
  阶段划分
</NumberedList>

<NumberedList id="h7tO7RQPwElvBE0PezplcW">
  技术选型
</NumberedList>

<NumberedList id="EsOJzWQnTZjQqmf1ZK9sEr">
  目录结构
</NumberedList>

<NumberedList id="FDYtzLvwS2HxFkMrr4R6Ff">
  数据层
</NumberedList>

<NumberedList id="SsjIlzX47b5ZsubnPmlwmX">
  地形烘焙（高精度地图）
</NumberedList>

<NumberedList id="N8xBFMOhqLFxR59WojTCNQ">
  3D 渲染架构
</NumberedList>

<NumberedList id="BGChqLTEdpxTm4if1i0Xom">
  页面规格
</NumberedList>

<NumberedList id="i89WWI0CFFNgsnVxEsYa16">
  视觉与交互规范
</NumberedList>

<NumberedList id="J4hXRU72lumhYEZoyG1o8Y">
  性能预算
</NumberedList>

<NumberedList id="EoYvtuR46uL9ip5U2d9fpd">
  工程规范与测试
</NumberedList>

<NumberedList id="XpEZBmUO2QhoskU7W5AQts">
  第二阶段预留
</NumberedList>

<NumberedList id="jtAcjp22koaDPeorqeWGpN">
  里程碑与验收标准
</NumberedList>

<NumberedList id="SsF82X26RcCwh17X5MQECX">
  风险与待决事项
</NumberedList>

<Divider id="SdxXzWyTTUNc0qgvM8GR0R" />

<Heading id="263RYC0LPLz62FjGs0ElON" level="2">
  1. 项目概述
</Heading>

<Heading id="DAmv6zO1LA6j0YWCbZIDnM" level="3">
  1.1 目标
</Heading>

<Paragraph id="fbDzT93b3V4gxXD8ij7AEy">
  做一个<Mark bold>游戏化的全国独立游戏社团导览网站</Mark>。首页是一张文明六风格的体素六边形大地图，每个社团是图上的一个据点。访客可以在地图上浏览、搜索、查看社团资料，并找到加入方式。
</Paragraph>

<Heading id="2CX79U5ZlwOHB7sZkL7sfo" level="3">
  1.2 核心原则
</Heading>

<Table id="YhKkSmDjmReuIVA3EOOUWu" readonly rowHeader>
  <TableRow id="oTh3HpWAojuCccRkIsOGr1">
    <TableCell id="0b6svTXJHll9SCbpl9Nbu4">
      <Paragraph id="8waITrkzvz1MZsXtgMzEjt">
        原则
      </Paragraph>
    </TableCell>

    <TableCell id="9toVMxlRpEPlADrOD7Bd4S">
      <Paragraph id="yxVauAWPCtGz5w9O2HIJt8">
        含义
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Jf6MqJRY5TSgQju9Gio0jF">
    <TableCell id="5AeyzPOBYd8ByfAEA5gltI">
      <Paragraph id="5dfacB59QIPLjWqTOdPhOF">
        信息优先
      </Paragraph>
    </TableCell>

    <TableCell id="b2Yh1SYu7RJEf2S2nWAyei">
      <Paragraph id="Q6Kok6YgLhefOtVhDKhDXg">
        游戏化只是表现形式。任何社团都能在 3 次点击以内找到，并拿到联系方式
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="XQnuc53RKjG6DulnQZCbII">
    <TableCell id="FcsS7BA3vGHzyyQpIMqBab">
      <Paragraph id="ge3rHYYgC6tcHPZyfJGOz3">
        数据单一来源
      </Paragraph>
    </TableCell>

    <TableCell id="RilyanRs1k8W7ShRkMGNhe">
      <Paragraph id="5gN4eWUlcB9VXclWN72XLk">
        所有页面只读取同一份社团数据，地图和列表不会出现不一致
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="XXk9nzVbaVI0Hu3KX8QOop">
    <TableCell id="a0RdG7dJSwyLeUiKiHn880">
      <Paragraph id="Wy4hjma2guhEPOWdCIFZa4">
        数据源可替换
      </Paragraph>
    </TableCell>

    <TableCell id="IHAKRpruU7aZvGnTnLDInY">
      <Paragraph id="F9mLetOlzj0IWA4z4rgTmZ">
        录入渠道（腾讯文档 → Excel → 以后的服务器）变化时，前端代码不需要改
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="x3asbYmXEcnKFLkP7BjBDb">
    <TableCell id="nIrblwo8dv2cyXPnBOXJRp">
      <Paragraph id="vqLLQwo5AnhTJ6CjseJSYY">
        容错
      </Paragraph>
    </TableCell>

    <TableCell id="XyTCgOAdbC7qhj61hP4jS3">
      <Paragraph id="iI92GcLk5fVHrwZcIZFocY">
        单个社团的数据有问题，不影响其他社团展示
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="NKaEE8crd6FjLOG9Lkv8gE">
    <TableCell id="COG5BA3zRQP0Eii4BWZLNf">
      <Paragraph id="eLOHrylTPkVKVfRQqVtGvn">
        可扩展
      </Paragraph>
    </TableCell>

    <TableCell id="0Ft9UDW9OlttqgoN2LQMRE">
      <Paragraph id="Hnz0GORjbweqpd4IGTQ8GI">
        按 100 个社团设计，数据结构和地图落点能支撑到 500 个
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Heading id="roVeiBYU0ZVaMz1TyOOQI4" level="3">
  1.3 已确认的需求
</Heading>

<BulletedList id="sGrBzNXwIrPwjI1MKtIb7g">
  地图轮廓能让人联想到中国，地形地貌大致符合实际情况；采用<Mark bold>体素风格，并提升精度</Mark>
</BulletedList>

<BulletedList id="D4odGj3rqusShDIYoQ9tcs">
  南海诸岛用<Mark bold>示意性的小岛群</Mark>表示
</BulletedList>

<BulletedList id="VO3fJ3wjx7NN6ogazZ1zCS">
  地图上<Mark bold>不显示</Mark>人口、社团规模、国境线，也没有「下一回合」
</BulletedList>

<BulletedList id="z6bliJUKWQvLxiDBYnIbdj">
  有一个<Mark bold>时间轴按钮</Mark>，点击后弹出按成立年份回放的动画
</BulletedList>

<BulletedList id="0yDM1r2AUM17EWxkm3qjv7">
  页面：首页（地图）、社团详情、关于、加入我们
</BulletedList>

<BulletedList id="53G9oWMSCjLUM4N0zxSHOt">
  手机端<Mark bold>不加载 3D</Mark>，直接显示列表视图
</BulletedList>

<BulletedList id="fqPxttZ5uvz0cQzpuCA4Nw">
  数据目前通过腾讯文档采集，需要能方便地迁移；社团总量约 100 个，数据会持续更新
</BulletedList>

<Divider id="lZnrFcWGGpouhHbPz5vKaH" />

<Heading id="7FE6cDPIP5XMTWbngWv1r9" level="2">
  2. 阶段划分
</Heading>

<Table id="GADdH0wC6NK2leEJXnKWiO" readonly rowHeader>
  <TableRow id="cd5FRDnQMqpv5jjh5bGGEH">
    <TableCell id="TROpBaNox2Cuv8kFqsJkJY" />

    <TableCell id="KpVJuQPfYwowaDHhryS9xr">
      <Paragraph id="mWkfk4HgPRZz8oiW1Ni2sD">
        第一阶段（本文档）
      </Paragraph>
    </TableCell>

    <TableCell id="VdBeDGcKutK6nwpQDaK46z">
      <Paragraph id="M2KI2bBmQWe5lkXdvdBflR">
        第二阶段
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="ukRPcrlfOMHBysWjs2x2jP">
    <TableCell id="jfpjXaicN0GatBQRvmtuq5">
      <Paragraph id="YgUMHRkFYthdGUbjxNqDs4">
        部署形态
      </Paragraph>
    </TableCell>

    <TableCell id="xI61nlMhTWQbkXJH1PmNlp">
      <Paragraph id="7CJAG2QC9fLaBETogzLO1o">
        纯静态文件，任何 Web 服务器都能托管
      </Paragraph>
    </TableCell>

    <TableCell id="oWFxbLQrkGHYXxfSJPNTer">
      <Paragraph id="YExnOH0tKraT8WxumgTA9f">
        Node.js 服务 + 数据库 + Nginx
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="r8xfNI5bbLVpEPvlOoXimc">
    <TableCell id="CLjjCVsc4u1FNulzyG2H1a">
      <Paragraph id="ojMNOPTDqnAydHn037I1lY">
        数据录入
      </Paragraph>
    </TableCell>

    <TableCell id="8hAXIKYuaH2UI11C9sUi6u">
      <Paragraph id="nrpYAQJHmzdJhhlkrl3OBL">
        从腾讯文档导出 xlsx → 运行导入脚本 → 重新构建
      </Paragraph>
    </TableCell>

    <TableCell id="p9rBfujQGU2pU9bL84O37X">
      <Paragraph id="fgX1tlwOOOTkAyw8IVGS3m">
        网站表单 + 管理后台 + 腾讯文档 API 自动同步
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="KYAyzSMh3Almq1x97NCZy0">
    <TableCell id="JQY8EKj5CIsiPYa4dDENAK">
      <Paragraph id="m1aV30GtvNTdHy2xLtykBj">
        数据更新
      </Paragraph>
    </TableCell>

    <TableCell id="4vguGfXoDe24wAhWrkEtF2">
      <Paragraph id="928O68LV1rslfV65yqmW5j">
        重新构建并部署（几分钟）；已打开的页面通过轮询发现新版本
      </Paragraph>
    </TableCell>

    <TableCell id="rr4su0zRCQRnfhmukjIdHz">
      <Paragraph id="2YMZMpJVs3f7zrmlnjGjeR">
        服务器推送（SSE），秒级生效
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="QxwSjElUQvJLBfdBgErkeG">
    <TableCell id="ImYE2uJM14fSMWPGAPjV5S">
      <Paragraph id="WFWC58OnZoIOyNskCx8iqk">
        加入我们
      </Paragraph>
    </TableCell>

    <TableCell id="bqb9puXgs4hB0XdDudYeGV">
      <Paragraph id="KPSJW0N3hs9Ascy8kjdaCQ">
        入驻说明、收集表链接、联系方式
      </Paragraph>
    </TableCell>

    <TableCell id="emLcTuSezOt7DKjwMVRK9Q">
      <Paragraph id="heFfcGTZpG3cWVWvmIElPB">
        站内表单，提交后进入待审核
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="0QctgUSJiHaoUBObKSSFOe">
    <TableCell id="813JNsmEPfxKGxlUUXCJqS">
      <Paragraph id="y12ndWOt0TTNs54i2XszcE">
        隐私控制
      </Paragraph>
    </TableCell>

    <TableCell id="lcfIV5VCH51kmxBjgDlF3M">
      <Paragraph id="50LVTQpqEIlEkVkrpejpRl">
        <Mark bold>构建时</Mark>按字段白名单过滤
      </Paragraph>
    </TableCell>

    <TableCell id="PZNWvpxThxu7HV4jYw7iMP">
      <Paragraph id="wsItFodX3d8EGO2g821ul0">
        后台可以逐个社团、逐个字段设置
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="4lnP5Q3tODAFYnIi9SeW7x">
    <TableCell id="tU8C3zPV6Okxs1T3Z1mQtf">
      <Paragraph id="V6U4YDSQ2dUA1X2dKB0NoG">
        图片
      </Paragraph>
    </TableCell>

    <TableCell id="LTJO4f2DH4xEBgu1eNvVDs">
      <Paragraph id="3O5ioVdveXpv8P7Ks9iuDU">
        仓库内的静态资源，构建时压缩
      </Paragraph>
    </TableCell>

    <TableCell id="vLsNpEM5OMf5Ss0hIPeqz5">
      <Paragraph id="QOfEwXPAJAUWqD0W5txbqk">
        服务器存储，上传时自动处理
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="zXB8UepcTUg3lbS7HEyNnu">
  第一阶段的所有代码都要按第二阶段能<Mark bold>直接接上</Mark>的方式编写，见第 12 节。
</Paragraph>

<Divider id="eEqzSt0GJxIXP1RJbXRG71" />

<Heading id="pQemzm8Bdjr9xcUNShyOgb" level="2">
  3. 技术选型
</Heading>

<Table id="89VBG59UHZiOoDdyj1j9HO" readonly rowHeader>
  <TableRow id="b3CxRP4hZoVaZiVhMb7WCD">
    <TableCell id="FT9538sjyfFzsYS3D2dSAK">
      <Paragraph id="dKJ36fAbEgImeqd6CBFsbS">
        类别
      </Paragraph>
    </TableCell>

    <TableCell id="Wd2NFw03wMw2arcG8eMZ4j">
      <Paragraph id="bJvsUMC6PfY9KGLQlraueh">
        选型
      </Paragraph>
    </TableCell>

    <TableCell id="z5MLLFTAuk9T4Fh8RfOA5l">
      <Paragraph id="sNN3QPnKc2ovsuaMppRI2i">
        说明
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="fSpOHVmaq6uJRGGP6R9zW9">
    <TableCell id="WZvaNyEOA8eqFgU1LGTl9u">
      <Paragraph id="zyb0iCs1qV1iMxqpJH0owD">
        语言
      </Paragraph>
    </TableCell>

    <TableCell id="2I9R5W08obUG2AQgjktH8H">
      <Paragraph id="ZmPvud9mK0YNa4M65yWmnx">
        TypeScript 5（`strict: true`）
      </Paragraph>
    </TableCell>

    <TableCell id="wHxhPf8PRLFVLTwrc0S03A">
      <Paragraph id="NjZOBAxXTUzpidU8jqQM9s">
        前端和脚本共用类型；第二阶段服务端也沿用
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="JmIJB5QXwWR9ZoKjOsfTOY">
    <TableCell id="wsjuNyzVJOTVrk2YuB4FvK">
      <Paragraph id="23pIFCIdJO1jj6gkpcLp6o">
        构建
      </Paragraph>
    </TableCell>

    <TableCell id="r8ibNpTZMLz0shtGImdkLX">
      <Paragraph id="KSToQeEtPke4xZLdnQJTWp">
        Vite 6（多页面模式）
      </Paragraph>
    </TableCell>

    <TableCell id="3DnmGZI8BODHdTH3YmpPQi">
      <Paragraph id="1ORO6rXSuWccMLoSQw0JZA">
        4 个 HTML 入口，按页面拆分代码
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="olgjbp5wQmvlfm91plB8Pa">
    <TableCell id="X0Uztxvv0cxQhHXxV4ql4f">
      <Paragraph id="r5WmEdC93cAO5r6OA0Mk9c">
        3D
      </Paragraph>
    </TableCell>

    <TableCell id="jAh4pDuoNoJwwQJdRbXuId">
      <Paragraph id="rACmDRc5113DimXRs2GXHr">
        three.js（锁定具体版本，打包进本地）
      </Paragraph>
    </TableCell>

    <TableCell id="XogtY9rdBKeVV4ILi48ubx">
      <Paragraph id="PH5J2qHyWsOR6gtZ6dJeJS">
        不使用任何国外 CDN
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="ZusYtqSbcoUZidG4RlrAiw">
    <TableCell id="wAwUegZsccXjhNDurCa9i4">
      <Paragraph id="YVQmRrw4SASur1p0E1SkFW">
        UI
      </Paragraph>
    </TableCell>

    <TableCell id="kDpCY7n2o02RNxPA15IdLa">
      <Paragraph id="056P3fyln99765fl5CJlLQ">
        原生 TS + Web Components（少量）
      </Paragraph>
    </TableCell>

    <TableCell id="IsHpPGd8qHwmbrLcjgfc2K">
      <Paragraph id="DmRY9wGdR4RxpUlI4LoCYG">
        页面交互不复杂，不引入框架，减少依赖和体积
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="rVlc7YibXjK9ajt0xbjSgR">
    <TableCell id="7s1Hj2hUFAtjXkpmP17VWf">
      <Paragraph id="jXz00IYemJQ36AzDz02kAK">
        数据校验
      </Paragraph>
    </TableCell>

    <TableCell id="QUPzA46LrYysUeWUV3Uddz">
      <Paragraph id="sFqHJAGr6GLmuncIuxu39G">
        zod
      </Paragraph>
    </TableCell>

    <TableCell id="uaajRn9UHsj4eelkRMqRW8">
      <Paragraph id="zwqtppa80m3clzjrY3Esy0">
        导入脚本和运行时共用同一份结构定义
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="WvyUeuZG9a7U3CNO7npmcz">
    <TableCell id="FYyvfAHXXpfFWz4wzxY3Cj">
      <Paragraph id="YPb2lmvAgMAcdTnbwhxYQB">
        Excel 解析
      </Paragraph>
    </TableCell>

    <TableCell id="SEwn9xh0fjcO20bhrtdtx0">
      <Paragraph id="voqnfQubKuBdywGt6JFBAs">
        exceljs
      </Paragraph>
    </TableCell>

    <TableCell id="VR5rQbvgMfA38ZQQIlqzsq">
      <Paragraph id="LMR071lMyVYzskUAD8aIg0">
        支持读取单元格和内嵌图片
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="lmuhFfgJI5KtdYthn4V0UB">
    <TableCell id="RVnnUzVpt3Li07CcKGGEbx">
      <Paragraph id="wdvXv4kJV4lGiEtsKJUJxW">
        地理处理（仅在构建阶段使用）
      </Paragraph>
    </TableCell>

    <TableCell id="QN5tNNeu2IASRpHiQrjwcS">
      <Paragraph id="eqvuWaXTIsHpmCmhr4Vz8u">
        @turf/turf、geotiff
      </Paragraph>
    </TableCell>

    <TableCell id="EgZb2AfyHacW4iwwzeZKRZ">
      <Paragraph id="hSmhJyqQN6aiW1NBaWgjoh">
        烘焙地形用，不进入浏览器
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="B8Ce730riEUlELw7HziStE">
    <TableCell id="581ZwUTL2zpVuOIAvfv53b">
      <Paragraph id="ct4n4TPvN72Ofh2o0SKZrZ">
        图片处理（仅在构建阶段使用）
      </Paragraph>
    </TableCell>

    <TableCell id="TmffZi0UwnEwRpUsuFR6zl">
      <Paragraph id="KGCv29qoQ9BcQKfIVmS3P4">
        sharp
      </Paragraph>
    </TableCell>

    <TableCell id="LW8riRsme16rzsO8MgnxiT">
      <Paragraph id="JXM7pPZ0VKNXZtI8UwLGs0">
        把 Logo 和照片转成 WebP 并生成缩略图
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="QTyqksOITVOZC8ZP80CaGW">
    <TableCell id="H3R5c0hnqi9tyhKXt089VS">
      <Paragraph id="4OAtnAwjSinXyFJJUQD1Et">
        单元测试
      </Paragraph>
    </TableCell>

    <TableCell id="CnAOXJZTH4Q3nnnKP0vV3f">
      <Paragraph id="VsJ826vIDWykxtvUTcYOHx">
        Vitest
      </Paragraph>
    </TableCell>

    <TableCell id="ICJaleS9TtX1f9yJ9mvZBq" />
  </TableRow>

  <TableRow id="REoQzPw09NClb5X7cNIShB">
    <TableCell id="ysdJtbuf3Ks56RKhPpsIwB">
      <Paragraph id="ciUIzDxWh0jCZJepO8oxBT">
        端到端测试和截图对比
      </Paragraph>
    </TableCell>

    <TableCell id="qntODnBbcApOxTCL17uNfQ">
      <Paragraph id="vdhQkpmf63E56lzWqDwvaT">
        Playwright
      </Paragraph>
    </TableCell>

    <TableCell id="lyHPkBgcpRZ4vT9Jpf0LCp">
      <Paragraph id="3sIL5WD3FJR1gXQb1bnIQY">
        需要支持 WebGL（Chromium，使用 SwiftShader）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="kSSEyw1kmgXRF3ZHwh2lJi">
    <TableCell id="7Hz91jTFLgan0j2TAdHwSE">
      <Paragraph id="kK4JWQMc3V4IvkG2MonvHR">
        代码规范
      </Paragraph>
    </TableCell>

    <TableCell id="wjpzCXPwyve6z82AHpIUa2">
      <Paragraph id="RScwX0cIIMDee1PxmdSasd">
        ESLint + Prettier + lint-staged
      </Paragraph>
    </TableCell>

    <TableCell id="IJiFfkHfRbLIOLffb9ApJ8">
      <Paragraph id="5G5Fb7YcNNK9sTbDyO4Ios">
        提交代码前自动检查
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="YsmCwPNTSwAJgHfz9LTQNT">
    <TableCell id="fbN1OJ4ugrGbhOhTRw5Xfd">
      <Paragraph id="thVzil9rPuTmhi2FvE2mKa">
        包管理
      </Paragraph>
    </TableCell>

    <TableCell id="9W8i457QmYj03g2kMsnZHL">
      <Paragraph id="nM1Yf8cY3yHPkRZAK0D2jI">
        pnpm
      </Paragraph>
    </TableCell>

    <TableCell id="esmU6AGeXAEpRY9cvU6o7y" />
  </TableRow>

  <TableRow id="NHg2TSfKasrXOfxW1ZiODG">
    <TableCell id="Z1mkuh4aDTM1HrV1knepex">
      <Paragraph id="l7h4TzUVYNB7DJuUNDSfD3">
        Node 版本
      </Paragraph>
    </TableCell>

    <TableCell id="CN9025H6q0PhOpYpEW5GwY">
      <Paragraph id="JucU4IjQfIUSeAwVAIAcEW">
        22 LTS
      </Paragraph>
    </TableCell>

    <TableCell id="VB0qzrOKt5FGN8PLo8LoUY">
      <Paragraph id="1umK7PUkf3aZeNZNJNRbgw">
        通过 `.nvmrc` 锁定
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Divider id="cs1Pg6uUtvesSnlxPNxjMY" />

<Heading id="UTk2dDM2f92fpjgTZhdrbq" level="2">
  4. 目录结构
</Heading>

<Code id="Zvxc3hNXT6fJZOegKJ1BXE">
  ```
  civmap/
  ├─ index.html                 # 首页（地图 / 手机列表）
  ├─ community.html             # 社团详情（?id=xxx）
  ├─ about.html
  ├─ join.html
  ├─ package.json
  ├─ vite.config.ts
  ├─ tsconfig.json
  ├─ .nvmrc / .editorconfig / .eslintrc.cjs / .prettierrc
  │
  ├─ config/
  │  ├─ mapping.config.ts       # 表格表头 → 数据字段 的映射（改表头只改这里）
  │  ├─ privacy.config.ts       # 哪些字段允许公开
  │  └─ site.config.ts          # 站点名、联系方式、收集表链接等
  │
  ├─ data/
  │  ├─ raw/                    # 从腾讯文档导出的 xlsx（不提交到 git）
  │  ├─ registry.json           # 社团永久 ID 登记表（提交）
  │  ├─ placements.json         # 社团在地图上的格子坐标（提交）
  │  ├─ cities.json             # 城市坐标表，约 370 个地级和县级市（提交）
  │  ├─ overrides.json          # 人工修正（坐标微调、字段更正），优先级最高
  │  └─ geo/
  │     ├─ china.json           # 轮廓（已有）
  │     ├─ zones.geojson        # 手绘的地貌分区（提交）
  │     ├─ rivers.geojson       # 主要河流（Natural Earth 裁剪版）
  │     └─ elevation/           # 高程原始数据（不提交，脚本自动下载）
  │
  ├─ scripts/
  │  ├─ import-data.ts          # xlsx → 校验 → 清洗 → communities.json
  │  ├─ check-data.ts           # 只做校验，不写文件（CI 用）
  │  ├─ bake-terrain.ts         # 生成 terrain.bin
  │  └─ fetch-geo.ts            # 下载高程和河流原始数据
  │
  ├─ public/
  │  ├─ data/
  │  │  ├─ communities.json     # 由脚本生成，已过滤隐私字段
  │  │  └─ version.json         # { version, updatedAt }，供前端轮询
  │  ├─ terrain/terrain.bin     # 由脚本生成
  │  └─ media/                  # 由脚本生成：logos/*.webp、photos/*.webp
  │
  ├─ src/
  │  ├─ shared/                 # 前后端共用（第二阶段服务端直接引用）
  │  │  ├─ schema.ts            # zod 结构定义
  │  │  ├─ types.ts
  │  │  └─ hex.ts               # 六边形坐标数学
  │  ├─ data/
  │  │  ├─ DataSource.ts        # 数据源接口
  │  │  ├─ StaticJsonSource.ts  # 第一阶段实现
  │  │  └─ store.ts             # 全局状态（筛选、选中、时间轴年份）
  │  ├─ map/
  │  │  ├─ MapApp.ts            # 地图入口，负责组装各模块
  │  │  ├─ core/                # renderer / camera / controls / 画质档位
  │  │  ├─ terrain/             # 地形分块、网格构建、装饰物生成器
  │  │  ├─ water/               # 水面着色器、浪花
  │  │  ├─ sites/               # 社团据点模型、建城动画
  │  │  ├─ overlays/            # 旗帜标签、悬停框、选中框
  │  │  ├─ minimap/
  │  │  └─ timeline/            # 时间轴控制器（只改变状态，不直接操作 DOM）
  │  ├─ ui/                     # 通用组件：面板、列表、卡片、复制按钮、提示
  │  ├─ pages/                  # 每个页面的入口脚本
  │  │  ├─ home.ts
  │  │  ├─ community.ts
  │  │  ├─ about.ts
  │  │  └─ join.ts
  │  └─ styles/
  │     ├─ tokens.css           # Design Token
  │     ├─ base.css
  │     └─ components.css
  │
  ├─ tests/
  │  ├─ unit/                   # 导入清洗、ID、落点、坐标、时间轴
  │  ├─ e2e/                    # 页面流程
  │  └─ fixtures/               # 测试用的小 xlsx 和数据
  │
  └─ docs/
     ├─ DEVELOPMENT.md          # 本文档
     ├─ DATA-UPDATE.md          # 运营手册：如何更新数据（面向非开发者）
     └─ DEPLOY.md               # 部署说明
  ```
</Code>

<Divider id="5PpnMRxWslx3FWoyRuw7Kg" />

<Heading id="I6a53tygHVoxQaqM7Mf3ft" level="2">
  5. 数据层
</Heading>

<Heading id="jO5SwYjxRKK96EhAtI35gn" level="3">
  5.1 数据结构（`src/shared/schema.ts`）
</Heading>

<Code id="7P65ukPaynNIS2SFHCqBrg" language="ts">
  ```ts
  export const Community = z.object({
    id:          z.string().regex(/^[a-z0-9-]{3,40}$/), // 永久 ID，改名也不变
    name:        z.string().min(1).max(60),
    city:        z.string().min(1),                    // 主城市（落点依据）
    otherCities: z.array(z.string()).default([]),
    founded:     z.number().int().min(1990).max(2100).nullable(), // 年份，未知为 null
    foundedRaw:  z.string().default(''),               // 原始写法，保留用于展示
    address:     z.string().default(''),
    intro:       z.string().max(500).default(''),
    size:        z.number().int().positive().nullable(), // 只在详情页展示，地图上不用
    sizeRaw:     z.string().default(''),
    leader:      z.string().default(''),
    contact:     z.string().default(''),               // 受隐私配置控制
    qqGroup:     z.string().default(''),
    wechatGroup: z.string().default(''),
    website:     z.string().url().or(z.literal('')).default(''),
    logo:        z.string().default(''),               // 相对路径 media/logos/xxx.webp
    photos:      z.array(z.string()).default([]),
    tile:        z.object({ q: z.number().int(), r: z.number().int() }),
    updatedAt:   z.string(),                           // ISO 时间
  });

  export const Dataset = z.object({
    version:     z.string(),        // 内容哈希
    generatedAt: z.string(),
    communities: z.array(Community),
  });
  ```
</Code>

<Paragraph id="06Rcf87TmylT1ZXPBpAcZ2">
  说明：
</Paragraph>

<BulletedList id="H1VWwYHPxYQyfm3tj3aICK">
  `size` 保留在数据里，但<Mark bold>地图上不使用</Mark>，只在详情页有值时显示。如果你不希望公开规模，在隐私配置里关掉即可。
</BulletedList>

<BulletedList id="9eungvOamwPQhs2FYMcpjx">
  `foundedRaw` 保留原始写法（比如「2026.1」），详情页可以显示得更精确。
</BulletedList>

<Heading id="zjiF8ep5yUNBHOTYUhvxLM" level="3">
  5.2 导入流程（`pnpm data:import <file.xlsx>`）
</Heading>

<Code id="3WI7YSCEOO3bslXtWw5uii">
  ```
  读取 xlsx
    → 表头映射（mapping.config.ts）
    → 逐行清洗（normalize）
    → 分配或查找永久 ID（registry.json）
    → 应用人工修正（overrides.json）
    → zod 校验（失败的行跳过，记入报告，不中断导入）
    → 分配地图格子（placements.json）
    → 处理图片（sharp → webp）
    → 按隐私白名单裁剪字段
    → 与上一版比较差异
    → 写入 public/data/communities.json、version.json
    → 输出导入报告 reports/import-<时间>.md
  ```
</Code>

<Paragraph id="wAIHJK8FAtyVmCfEmen4xF">
  <Mark bold>表头映射</Mark>（`config/mapping.config.ts`）：
</Paragraph>

<Code id="nUqMHLbMOtS4k6uOfc22vG" language="ts">
  ```ts
  export const columnMap = {
    name:        ['社团名称', '社团名', '名称'],
    city:        ['所在城市', '城市'],
    otherCities: ['其他城市', '覆盖城市'],
    founded:     ['成立时间', '成立年份'],
    // …… 每个字段可以写多个候选表头，按顺序匹配
  } satisfies Record<keyof RawRow, string[]>;
  ```
</Code>

<Paragraph id="1x0KaEWzlColrwYVH1ghmM">
  腾讯文档改了表头、调了列的顺序、加了新列，只需要改这个文件。表格里出现了<Mark bold>未识别的列</Mark>，导入报告会给出提示。
</Paragraph>

<Paragraph id="oZvQ1YtshCLns0M1NVjOkn">
  <Mark bold>清洗规则</Mark>（每条都有单元测试）：
</Paragraph>

<Table id="bvF6a9egz5uVf0b0IZFBOB" readonly rowHeader>
  <TableRow id="N2mPzn2XT7MOcfnnyr3Qk4">
    <TableCell id="gemTwctg7HV9unhn2pdeti">
      <Paragraph id="7H1h0c6OfCqLkYZhqEANyE">
        字段
      </Paragraph>
    </TableCell>

    <TableCell id="2MHXXcX9UNN0jPtctM3HMd">
      <Paragraph id="oPKNbObMQbRH55E9DAUREf">
        原始写法举例
      </Paragraph>
    </TableCell>

    <TableCell id="FwmEhK6of227MYM5MrNotk">
      <Paragraph id="5t2YZDls6FDct01yaWEhzm">
        清洗结果
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="OmhoGD7JdQmWtdAksspjjn">
    <TableCell id="ryMf6uFOcAQkwPisqRMyeL">
      <Paragraph id="qvrXPhXdlkULNlWVaafqhB">
        founded
      </Paragraph>
    </TableCell>

    <TableCell id="kf9GouarCuNiWZaHG1kGAp">
      <Paragraph id="1ux7tGdBMgOqDJzwYElupU">
        `2026.1`、`2025年7月`、`2022`
      </Paragraph>
    </TableCell>

    <TableCell id="u71VryxAF1dgyb09HBjhqh">
      <Paragraph id="47AKX2qMIDmr2eDLjx7xcv">
        `2026`、`2025`、`2022`
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="OCPRouOWXgyYkolvKJ6Xrp">
    <TableCell id="XOQDe22eGGjUbEZtd29Ugp">
      <Paragraph id="K4EBhzxMdtx9xp6ZDvKh6A">
        size
      </Paragraph>
    </TableCell>

    <TableCell id="rnrbNleGCKtXTWQna3AVor">
      <Paragraph id="9SdsP6h8tEOVwLfslKpCE9">
        `200+`、`80左右`、`约350人`
      </Paragraph>
    </TableCell>

    <TableCell id="JXXuitVl8IJjMDoXXDtVUj">
      <Paragraph id="S33A1eeEzHWfTzn8ARXiRd">
        `200`、`80`、`350`
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="GhMdrcShqvgM9mg0W6IUgz">
    <TableCell id="PVnUKDpyMptxICuiDFKah6">
      <Paragraph id="uaPm9i1HerCqDh781p1cAB">
        otherCities
      </Paragraph>
    </TableCell>

    <TableCell id="wcPCil7kGG6SlxTtS5ccFG">
      <Paragraph id="wBPEYIcpkDyDvAdSycSkMJ">
        `厦门 福州`、`厦门、福州`、`厦门,福州`
      </Paragraph>
    </TableCell>

    <TableCell id="axVMsfZ4lkSR9ajiaxzmn2">
      <Paragraph id="1gNQO7CSmUnDi72F4oSjZD">
        `['厦门','福州']`
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="cprXUMD4uiXD6DfLNUKz45">
    <TableCell id="OWRbDVDoJaloiRIfowHj52">
      <Paragraph id="kV7na3WDvIw7elXpgaYN8U">
        city
      </Paragraph>
    </TableCell>

    <TableCell id="G9fmdqbrGJg1KJAA9ejzYh">
      <Paragraph id="GxoSdHa4ta3uvVvbQv1FFt">
        `福建`（省份）
      </Paragraph>
    </TableCell>

    <TableCell id="7nObr7sbv2o0E1E4ytyyhp">
      <Paragraph id="Ppw2eedlwTUFcPBHaGP3QT">
        映射到省会或 overrides 里指定的城市，并在报告里提示
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="wImvdSUS3bePxlnfViDhOa">
    <TableCell id="YdlFnKatHe5DeibblnFm5R">
      <Paragraph id="q2CeLnIRq5BYYg1LW0R5tW">
        website
      </Paragraph>
    </TableCell>

    <TableCell id="foL8fJkOefgDHsTdGfbRfj">
      <Paragraph id="uchybD80qVb1YT6OFsv9h4">
        `www.xx.com`
      </Paragraph>
    </TableCell>

    <TableCell id="OYBqLaAYMUGII8nzJUIG1W">
      <Paragraph id="vvguIkhwKo5KtXj87StreX">
        自动补全为 `https://www.xx.com`
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="8s3UW3oJrMvf04zDgjMuuD">
    <TableCell id="zEXFibW1rDXUsXtueyCfqr">
      <Paragraph id="n34tlEnVja4ONf3wjlCGIS">
        所有文本
      </Paragraph>
    </TableCell>

    <TableCell id="bH1cTpBpzBylFBfdYVT5N4">
      <Paragraph id="zaOC5e7577NdjsbAVgaATO">
        首尾空格、全角空格、换行
      </Paragraph>
    </TableCell>

    <TableCell id="6ZjUpa52mKxyL5kL0yAIx3">
      <Paragraph id="D6O7pdsHcmZCfZdeRqgRdc">
        去除
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="YdIaNXLPHeWIk8ygk27FQ3">
  <Mark bold>差异报告</Mark>示例：
</Paragraph>

<Code id="jJzDnVXAvuP7R27grIZkz8">
  ```
  导入完成：共 102 行 → 有效 100、跳过 2
  新增 3：xx社、yy社、zz社
  修改 2：第九艺术研究社（intro, qqGroup）、天创社（logo）
  消失 1：aa社（上一版有，本次表格中没有）→ 默认保留并标记，需要人工确认
  跳过 2：第 57 行（缺少社团名称）、第 88 行（城市“火星”无法识别）
  ```
</Code>

<Paragraph id="DaJqVwrUt1zHXNzQcRyB8F">
  表格里<Mark bold>消失的社团默认不删除</Mark>，防止误删一行就让社团从网站上消失。要删除时，需要在 `overrides.json` 里明确标记。
</Paragraph>

<Heading id="rdlZPUqkQ9bprAChlTYzYs" level="3">
  5.3 永久 ID（`data/registry.json`）
</Heading>

<Code id="WkmFC7hVjnNJe8lYYwdnOa" language="json">
  ```json
  {
    "di-jiu-yi-shu": { "names": ["第九艺术研究社"] },
    "tian-chuang":   { "names": ["天创社"] }
  }
  ```
</Code>

<BulletedList id="zX6GbNaCvF5jaYu1QzADXp">
  新社团自动生成 ID：取名称拼音的缩写，冲突时加后缀。
</BulletedList>

<BulletedList id="LWnIT3AeAzjJBekRv8GbZ5">
  社团改名时，把新名字追加到 `names` 里，ID 不变，<Mark bold>详情页链接不会失效</Mark>。
</BulletedList>

<BulletedList id="85kWfxulOuXzf26hHyHtax">
  导入时如果发现名字高度相似（编辑距离很小），报告里会提示「可能是改名」，由人工确认，脚本不会自动合并。
</BulletedList>

<BulletedList id="8Jy42lO1P6JHG9j9E59xqW">
  长期建议：在腾讯文档里加一列「ID」（或者第二阶段直接由数据库分配），彻底避免按名字匹配。
</BulletedList>

<Heading id="wUgZADOchGMa9kcpu1DFxo" level="3">
  5.4 地图落点（`data/placements.json`）
</Heading>

<NumberedList id="jMXCGHx7RBzEL4yf17JDlS">
  根据 `city` 在 `cities.json` 里查出经纬度，再换算成格子坐标（见 6.2 的投影）。
</NumberedList>

<NumberedList id="yGvyYDrj76w29o6UzEBmIk">
  目标格子是<Mark bold>陆地、未被占用、不是高山</Mark>时直接使用；否则按<Mark bold>螺旋顺序</Mark>找最近的合适格子。
</NumberedList>

<NumberedList id="YIeFSFnVvG6QNdVdHG3cPy">
  同一城市有多个社团时，按 ID 字典序依次落点，结果是确定的。
</NumberedList>

<NumberedList id="G9kmHkvZMRTkWZ7AlWisRO">
  分配结果写入 `placements.json`，<Mark bold>以后永远不再改变</Mark>。新增社团不会影响老社团的位置。
</NumberedList>

<NumberedList id="e2BAY8Pt7AssJYoMAA0cQM">
  `overrides.json` 可以人工指定某个社团的格子，优先级最高。
</NumberedList>

<NumberedList id="AMnRWgX9ujGU56lSiBSfax">
  找不到城市时不中断导入：这个社团落到「待定位」状态，列表里照常显示，地图上不显示，报告里给出提醒。
</NumberedList>

<Heading id="rFbCIVlbbvo6dUQ38LpZ5h" level="3">
  5.5 隐私（`config/privacy.config.ts`）
</Heading>

<Paragraph id="y4inMhESpwwNDURNzpttTR">
  第一阶段是静态站，<Mark bold>只要写进 `communities.json` 的内容就等于公开</Mark>，所以过滤必须在构建时完成：
</Paragraph>

<Code id="Hwkcg5PkGCgs0YBNVg31Ks" language="ts">
  ```ts
  export const publicFields = [
    'id','name','city','otherCities','founded','foundedRaw','address','intro',
    'qqGroup','wechatGroup','website','logo','photos','tile','updatedAt',
    // 'leader', 'contact', 'size'  ← 取得负责人同意后再打开
  ] as const;
  ```
</Code>

<Paragraph id="whTodi9eBRgRMtf2qxfIl5">
  也支持<Mark bold>逐个社团</Mark>放开：在 `overrides.json` 里写 `"publicExtra": ["leader","contact"]`。
</Paragraph>

<BlockQuote id="yQ7zeKrSRux93yBGbeK5yB">
  <Paragraph id="Ne4pXV95zClcmEq5LQNrD2">
    现有数据里有负责人的个人微信号和 QQ 号。默认不公开，是出于《个人信息保护法》方面的考虑，最终策略由你决定。
  </Paragraph>
</BlockQuote>

<Heading id="KvdVgxVOWkbDrk4Gp55yIb" level="3">
  5.6 前端数据源接口（`src/data/DataSource.ts`）
</Heading>

<Code id="h1jEDJc72OuB6ffvnY4nk4" language="ts">
  ```ts
  export interface DataSource {
    load(): Promise<Dataset>;
    /** 订阅数据更新。第一阶段用轮询实现，第二阶段换成 SSE */
    subscribe(onChange: (next: Dataset) => void): () => void;
  }
  ```
</Code>

<BulletedList id="wplVIir8ahsGYrJfZNN5vb">
  第一阶段由 `StaticJsonSource` 实现：

  <BulletedList id="O4058aR620fNiebweVXzlA">
    加载 `/data/communities.json?v=<version>`。
  </BulletedList>

  <BulletedList id="CtsSyYEvSOV68FtNTK8lLo">
    每 5 分钟请求一次 `version.json`（这个文件很小）。版本号变了就重新拉取数据，地图上对新增的社团播放建城动画。
  </BulletedList>
</BulletedList>

<BulletedList id="xCS2EgwXILftGQXzWSwNrk">
  页面代码<Mark bold>只依赖这个接口</Mark>。第二阶段新增 `ApiSource` 替换掉它，页面代码不用改。
</BulletedList>

<BulletedList id="ZiUpSrH10XD7KWUahvPb1k">
  加载失败时依次尝试两个兜底：先用 localStorage 里上一次成功加载的数据；如果也没有，就显示错误提示和「重试」按钮。
</BulletedList>

<Heading id="Ey42ZiL4Dcr2GujIAi9iEx" level="3">
  5.7 运营更新流程（写入 `docs/DATA-UPDATE.md`）
</Heading>

<Code id="EOMQlMXgES81gbEa0jNVuQ">
  ```
  1. 腾讯文档 → 文件 → 导出为 → 本地 Excel
  2. 放到 data/raw/
  3. pnpm data:import data/raw/xxx.xlsx
  4. 查看 reports/ 里的报告，确认新增、修改、跳过的内容
  5. pnpm build && 部署（第一阶段：把 dist/ 上传到服务器）
  ```
</Code>

<Paragraph id="SN9Fhx0Ks8AOmbOq5m0FEm">
  腾讯文档里的<Mark bold>单元格内嵌图片</Mark>有可能无法被 exceljs 读取，因为腾讯文档和 WPS 使用了专有格式。准备了两种兜底方式：
</Paragraph>

<NumberedList id="MZ4SbABlIYdZZT65v3fZdU">
  在表格里填写图片文件名，图片单独放进 `data/raw/media/`。
</NumberedList>

<NumberedList id="nELHP6ghIdlI3fqclNiUdw">
  使用 xlsx 包里 `xl/media/` 目录下的原始图片，加上一张按行号的对照表。
</NumberedList>

<Paragraph id="jTTa8BYhx1crBkFQIZrwzY">
  具体用哪种，要等拿到一份真实的导出文件后在 M2 确认。
</Paragraph>

<Divider id="FDO7Jcpfq0ZvdEMbgv5u0i" />

<Heading id="gH5AIjJkJ6Bf4C4S29pv8F" level="2">
  6. 地形烘焙（高精度地图）
</Heading>

<Heading id="Cm8ENOXwoj087GVpDRYjtZ" level="3">
  6.1 目标
</Heading>

<Table id="9t70pxZYiBsHc2iIb95ORs" readonly rowHeader>
  <TableRow id="DBUIm6K296YBYinIr7I3BN">
    <TableCell id="LNYlRgTozLxZnsGAzCoQOg">
      <Paragraph id="IpvaGClfKAF5hQpDYraALI">
        指标
      </Paragraph>
    </TableCell>

    <TableCell id="Z8vXzvmfaZdDCl3ICZLFYn">
      <Paragraph id="JCoaljPrfIbtettlddguTj">
        原型
      </Paragraph>
    </TableCell>

    <TableCell id="ZtMbTMRILOGNZd92jqGoOt">
      <Paragraph id="v6mtNRTHjgU6e3ddyl4CUg">
        目标
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="7uJPJbGHRy4g5pBAOL1DGz">
    <TableCell id="WR3AoWZfe98IzTAPxtlOPw">
      <Paragraph id="HYXlwhafXQlHCsBqeBLPFD">
        网格
      </Paragraph>
    </TableCell>

    <TableCell id="L67t65zgGYbP55exlgRtch">
      <Paragraph id="K42pRkn2p3ORev9VUOvWop">
        36 × 26 = 936 格
      </Paragraph>
    </TableCell>

    <TableCell id="n1uZyQCz5xbZFYOnB9MjyC">
      <Paragraph id="UWu6zxbLbNDDMxLjC2i6ty">
        <Mark bold>约 140 × 100 = 14,000 格</Mark>
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="fk1FUGa0pBMsEBF0QXhSB0">
    <TableCell id="CcLVhsL964uOI4F4Yc1RoE">
      <Paragraph id="E5KryXCuZj9UMCtDJuOC1D">
        陆地格
      </Paragraph>
    </TableCell>

    <TableCell id="AL84nPMJnMBKQ4SuwXaH5Q">
      <Paragraph id="dirVZ7B7CD5hmaLo2kBkY4">
        约 470
      </Paragraph>
    </TableCell>

    <TableCell id="67sajzVy5Fi7dYdlcyUxNP">
      <Paragraph id="4yE5XBy09eQ7GQqYJkfZU0">
        约 6,500 ～ 7,500
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="NEqt84EpTKoDkzOtIsblAj">
    <TableCell id="CaClhF0blMjjHpW5V4oi98">
      <Paragraph id="yOoldgbPw147NaAFEPOolg">
        高度层级
      </Paragraph>
    </TableCell>

    <TableCell id="7qpW3BIOYafkK8TCEb2VrA">
      <Paragraph id="zwUEt1Bd2iPXEmwHG2IN3H">
        2 层（平地、丘陵）加上山体模型
      </Paragraph>
    </TableCell>

    <TableCell id="ASScZ7URk59HP9LLPjuqU2">
      <Paragraph id="B100lYEFyi3Oc48TXMkCmZ">
        <Mark bold>10 层台阶</Mark>，每层是一段体素高度
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="XbSRRjWEDIVlpkDnwK8q1s">
    <TableCell id="y3nQaKuY1IPPPJ1NH0WoA5">
      <Paragraph id="RS6HwojGreKnOSxQC1A5x4">
        地貌种类
      </Paragraph>
    </TableCell>

    <TableCell id="ypuOSGb7KklUqC0VDYxsNb">
      <Paragraph id="t2kE6y0KYqNAiE6fZIc3og">
        5 种
      </Paragraph>
    </TableCell>

    <TableCell id="y6m7nkLwosPO4fyS9OWm4j">
      <Paragraph id="jYLUZP8NhKp39YrluU3Zd3">
        14 种（见 6.4）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="rWcvsDBOP2bHNEH6QYTgeE">
    <TableCell id="ZbdYUouUcIXjMVDKgy22Kx">
      <Paragraph id="mNWyoR0QcwMjXx9Cu1r8o7">
        河流
      </Paragraph>
    </TableCell>

    <TableCell id="X0WaMnAlBjyV988PMjNc7o">
      <Paragraph id="UlTfGgb9UMa4buy9Ji7Ej4">
        随机生成
      </Paragraph>
    </TableCell>

    <TableCell id="66hGYKZX6iSsQjThpw6Rcl">
      <Paragraph id="rHzI4E87FAKqnr5U2YulAn">
        长江、黄河、珠江、黑龙江、雅鲁藏布江、塔里木河等约 12 条真实河流
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="SLeqopv2xBmXr9jI4W53a3">
    <TableCell id="0p1Aq4mqXYjGkt0FuwqgsH">
      <Paragraph id="j4Wmhbudi0IlKWopvoNCKl">
        地形来源
      </Paragraph>
    </TableCell>

    <TableCell id="ijCrih1PwQZC6cwdTOGIE5">
      <Paragraph id="46xMWXkgzwhLaI2dPdTnvZ">
        随机噪声
      </Paragraph>
    </TableCell>

    <TableCell id="6ZBcoyV133ahVrNU5oJDHM">
      <Paragraph id="rMam06EKQLZ0Qi9A36GOAA">
        真实高程数据加上地理分区，只用少量噪声增加自然感
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Heading id="XjlJu2qc343594FM20OehW" level="3">
  6.2 投影
</Heading>

<BulletedList id="uqKbI1AaKVIX7WzCk6ZGRI">
  范围：经度 72°E ～ 136°E，纬度 17°N ～ 54°N，<Mark bold>南海单独处理</Mark>（见 6.6）。
</BulletedList>

<BulletedList id="OUESZGrFNJhI3ITfq5taAq">
  使用等距圆柱投影，纬度方向乘一个修正系数（`cos(35°)`），让中部地区的形状不变形。
</BulletedList>

<BulletedList id="PqWiAlRpAqp9C7T7ewJfpv">
  六边形采用尖顶排列，使用轴向坐标 (q, r)。坐标换算放在 `src/shared/hex.ts`，前端和脚本共用。
</BulletedList>

<Heading id="pQhfH9CYKWkcPEHdFZHm80" level="3">
  6.3 高程
</Heading>

<BulletedList id="g0fqWFEkuE6Ls8EalWJvG8">
  数据：NOAA ETOPO 2022（60 角秒分辨率，属于公有领域）。由 `fetch-geo.ts` 下载后裁剪到上述范围。
</BulletedList>

<BulletedList id="9df1YEAGjKxfosspbQKxgZ">
  每个格子取范围内高程的<Mark bold>平均值</Mark>；地形起伏大的格子还会记录<Mark bold>最大值</Mark>，用来决定是否放山体。
</BulletedList>

<BulletedList id="UP4ZG0aEWDBZkxL8tbuymb">
  按分段函数量化到 0 ～ 9 级：
</BulletedList>

<Table id="vLK1sHvgsq2N3r2tgQ5iZd" readonly rowHeader>
  <TableRow id="lFLfb7uo9pUS0IyIYL1oeN">
    <TableCell id="jdMWgwToe2wrrPpUFyGbqD">
      <Paragraph id="2nAWVq71waz7SwpTYuo9Zw">
        级别
      </Paragraph>
    </TableCell>

    <TableCell id="2KP4OOojqoimMGgGfbzktY">
      <Paragraph id="AUzk4NEGIS7f0cs6ZcUnXx">
        海拔（米）
      </Paragraph>
    </TableCell>

    <TableCell id="VJ1jJUr0e2w6sfC6V7NN7x">
      <Paragraph id="M1Sy3QVoUCOeQ5ijA1vr1e">
        典型区域
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="g8OwHUiboJQOV3qSyFhH0U">
    <TableCell id="unkFZUEcZUSOWjrgGKmRCE">
      <Paragraph id="BFYAqppGe7lj68cqkULLdO">
        0
      </Paragraph>
    </TableCell>

    <TableCell id="j3HPPnoTuORaLfKSXwp0aG">
      <Paragraph id="RdvumVy6z8F5JxYFiC8kXj">
        海洋或湖泊
      </Paragraph>
    </TableCell>

    <TableCell id="KQjATno6NLj3iEB39swTmq">
      <Paragraph id="BCMIeMGucfTQkdlstflbNm">
        ——
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="NMlZH1k8mr4pMl8maZz9fa">
    <TableCell id="doCOAmSHoCWFhhCeIAxwEb">
      <Paragraph id="Z5pdljAA4Gl3BkSLHoHKEJ">
        1
      </Paragraph>
    </TableCell>

    <TableCell id="X3pgb7vfeCazwDf8FyTv9p">
      <Paragraph id="7RHeg1m05S1wsm7g3SlpiO">
        0 – 100
      </Paragraph>
    </TableCell>

    <TableCell id="vRTPoqPQl0F2hBsdtRRqnY">
      <Paragraph id="jKVaSzz1nN9cRfjXVAToPk">
        华北平原、长江三角洲
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="GyRtuCTULYrHALQb8qrV1a">
    <TableCell id="NqsXNqiuZj94DimNPU0cQV">
      <Paragraph id="raCaZcDnx9J8lFQl3VHotd">
        2
      </Paragraph>
    </TableCell>

    <TableCell id="Iz8azKwj7nGjPc7sXS5kw0">
      <Paragraph id="0BNha3D5WeLhwkGRJw43TW">
        100 – 300
      </Paragraph>
    </TableCell>

    <TableCell id="w9TcMkbm5ZP6xJCR6aNhy2">
      <Paragraph id="gNKd8YfvGL2gmpvrBWxsVo">
        江南丘陵边缘
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="usHbm6GbuGGA0SA6aU8bT8">
    <TableCell id="FLELkf7dZ5n56pVl3BdFiU">
      <Paragraph id="5cvW9nmH25EeMzhO9Gm1DJ">
        3
      </Paragraph>
    </TableCell>

    <TableCell id="AAlHFFhLRpav2OZov2G6MM">
      <Paragraph id="HAYhODziPyvXjf6qW5glOp">
        300 – 700
      </Paragraph>
    </TableCell>

    <TableCell id="YYzxYUqmdfXBrGfRhCrUvQ">
      <Paragraph id="ywNkh1J3Gk6Ex97L2ADetC">
        四川盆地底部（约 500 米）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="jHTYsJ4iSSO0SbA9hgha88">
    <TableCell id="GVAoZZZa9Cn5Hkndlr8W5Z">
      <Paragraph id="9e7SkbewNw9RD7XcaUcMpC">
        4
      </Paragraph>
    </TableCell>

    <TableCell id="dhKAB3f2ld4tyrpsGEbOZ7">
      <Paragraph id="fGub340K7nRmhzY9SBPacq">
        700 – 1200
      </Paragraph>
    </TableCell>

    <TableCell id="TSilwnNtYugu6luF59j3Lg">
      <Paragraph id="35eW9uQuzlRrhEZbnlMtzZ">
        黄土高原、云贵高原东部
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="XU9EWbhsLZQFi5bZsdjrBr">
    <TableCell id="f0aUOWPtYNfiAy5Ib8xI3q">
      <Paragraph id="83k55kij24Rd1j90cLKFrl">
        5
      </Paragraph>
    </TableCell>

    <TableCell id="79GjnVumRDGTP0dqk6sJIz">
      <Paragraph id="saW9SlMfBkCMH6qfe8Bq1e">
        1200 – 2000
      </Paragraph>
    </TableCell>

    <TableCell id="AF362gRYP3wT1hn4dbyHqU">
      <Paragraph id="1LOQBXAWy90TDkknFygTNV">
        内蒙古高原、云贵高原
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="VZJJFTsqsKC7sfftZnX7XU">
    <TableCell id="3NFOeEeUkLPmGMjjPKvjG5">
      <Paragraph id="iMqSzdulRbJYK6sPGqhjtP">
        6
      </Paragraph>
    </TableCell>

    <TableCell id="DOLcH1SbTImDu746ZO7QkR">
      <Paragraph id="LiBNYCBSO1RCd8bIKGgmA9">
        2000 – 3000
      </Paragraph>
    </TableCell>

    <TableCell id="zxBTRS10krSc58IACZU37f">
      <Paragraph id="BbkZNmyS8UhQFWLHpIGhA2">
        祁连山麓
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="jliRtOgJNb5e9uwwZCINZW">
    <TableCell id="re00YS28worvdOyd61YyCc">
      <Paragraph id="5XmhRwoL5x7g3Gwoawr1OT">
        7
      </Paragraph>
    </TableCell>

    <TableCell id="T8PsisVktUKPJKNIUm01nx">
      <Paragraph id="yE4yn7Yo2n1q5q47656tsj">
        3000 – 4200
      </Paragraph>
    </TableCell>

    <TableCell id="6IgWiQ9Zqgdkc2qdQmcpCw">
      <Paragraph id="Z1aUDwoPs7m9w0gRJ1zOmy">
        青藏高原边缘
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="H93eHKuPNCIv0vDzlhvWW5">
    <TableCell id="lPvw5uLZDeZgjNgJPlBSTj">
      <Paragraph id="hME2vWFzDvj26CMtDTVY0A">
        8
      </Paragraph>
    </TableCell>

    <TableCell id="ugyAfdmyErXBuSF8FybMdt">
      <Paragraph id="bTjhzs3vqnATbubDv2QeZ7">
        4200 – 5200
      </Paragraph>
    </TableCell>

    <TableCell id="FEJ3ACkuUmeD683TutRuwN">
      <Paragraph id="TP1T3m8L7dbm4JwB3BRAf0">
        青藏高原主体
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="5aNjApRTLxiWYy598h5y7B">
    <TableCell id="PLHk0RM8rF3mbD2AovMeec">
      <Paragraph id="AYR6DpwxxRzrNSWkbmW0zT">
        9
      </Paragraph>
    </TableCell>

    <TableCell id="fzCkcnDUB3cSKL1wDVFMjg">
      <Paragraph id="6HSNHPjumveZOcraeq2926">
        > 5200 或者是山峰
      </Paragraph>
    </TableCell>

    <TableCell id="9j88KqkmifYmbzR371JBrQ">
      <Paragraph id="nO5zWFTyEW2VFkXbHAfmp8">
        喜马拉雅山、昆仑山、天山主峰
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<BulletedList id="9SlBV6RPFEmxlYvD5eZk6K">
  分段不是等距的，是为了<Mark bold>同时看清四川盆地和青藏高原的层次</Mark>，完全按海拔线性划分的话，东部会全部挤成一层。
</BulletedList>

<BulletedList id="SeObbH2PMtpP4MpFAZnhiH">
  3D 场景中，每级高度设为 0.12 个单位（可以配置）。整体保持西高东低，但不会夸张到出现悬崖墙。
</BulletedList>

<Heading id="XPa1EMFFdlvsQXA9EjGlWI" level="3">
  6.4 地貌
</Heading>

<Paragraph id="aUqPZshK4AE1P0V0pNTlMf">
  采用「高程加分区规则」的方式，<Mark bold>不依赖土地覆盖栅格数据</Mark>，这样可控、可以调整，也没有授权问题：
</Paragraph>

<Paragraph id="bQQ3j2zDRY29aeN7R3ORPS">
  `data/geo/zones.geojson` 手绘大约 15 个分区多边形（精度要求不高），每个分区设定默认地貌和各种植被的比例：
</Paragraph>

<Table id="Gvh7SRNh1tQkdC0Y7p8H98" readonly rowHeader>
  <TableRow id="oerIHsVZzHLstADfioQeDq">
    <TableCell id="fvJkcUWcTEoSja9hKWoJCB">
      <Paragraph id="tAC9mkROBOWtXi1ScxlP19">
        分区
      </Paragraph>
    </TableCell>

    <TableCell id="vp2Nx3KCdat859p2DZSVyA">
      <Paragraph id="11YQsSyT7xVqRVDg4UPynF">
        主要地貌
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="zXn1aWvfD1jUX7SYd7t1Vf">
    <TableCell id="eMy4Jyod6TQVhywgZ5BclD">
      <Paragraph id="jd6H4FGf1G8Hihs0QlzrQO">
        东北平原和山地
      </Paragraph>
    </TableCell>

    <TableCell id="84DRsls0DzNbrQV3nWKJb3">
      <Paragraph id="TsIAXm98Dr71mUP1v9Hm4y">
        平原、针叶林、混交林
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="EMPeBfT4CL3Wddvkp7U1Fz">
    <TableCell id="tlPHY7WZSHkrr5wS3Xys0n">
      <Paragraph id="SJroHi2M8TK24mzu1df50c">
        内蒙古高原
      </Paragraph>
    </TableCell>

    <TableCell id="00FPLvDYZe2ji4lAbJSCVc">
      <Paragraph id="mGELvAqvqyUP3cDBKogeFw">
        草原（东部），戈壁（西部）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="NIFTaBKgS2yxI6PrWtkD9g">
    <TableCell id="s8gG2tKe3LABodAYAbz8BE">
      <Paragraph id="0YuCdGEKS9h6uG74317Nky">
        新疆北部
      </Paragraph>
    </TableCell>

    <TableCell id="vNgbayPJB0cLsvovVQf6DD">
      <Paragraph id="8DH9X7GqhTdzbXe6oLP6dj">
        草原、荒漠，天山为雪山
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="gCY9UqWDvhdmJb76Nz9tWZ">
    <TableCell id="MVYn0Qriy2mcPKM2L0fBBo">
      <Paragraph id="n4FLYsHg6Jh13BPoDsc2Km">
        塔里木盆地
      </Paragraph>
    </TableCell>

    <TableCell id="Ic5YsU51uxYc5tZ4s5Zmjk">
      <Paragraph id="AZefMNkpggujX2rtNGjvxH">
        沙漠（沙丘），边缘是绿洲
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="jvIUcNbDYjtrnzvAvZWvbc">
    <TableCell id="0QNCuPmM04Y0QnOvcjBIon">
      <Paragraph id="yo3nlF3jHHpaJ5asQSkkMy">
        青藏高原
      </Paragraph>
    </TableCell>

    <TableCell id="FPEWrdyUB6hYtdDlmomqBH">
      <Paragraph id="ISQpwqze7x45SjvuiSSvaw">
        高原草甸、冻土，高山积雪
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="MS1GMV1BeRivTHL5iRl3RI">
    <TableCell id="zYcvxJ78h2RVm7xl4D3r5i">
      <Paragraph id="KKATL7wVfiHc9ELCsKQdBv">
        黄土高原
      </Paragraph>
    </TableCell>

    <TableCell id="yCfs4LKaA97N78nFfc3VFv">
      <Paragraph id="MhPOEyD0ymJ0AkdGyUoAWa">
        黄土丘陵（带沟壑纹理）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="keFVm0w63wQcIllJopZ9zt">
    <TableCell id="RVyEGpbQbpNGNT8LFQOZkR">
      <Paragraph id="dZm3JkJSlOk3G84iWSuLJm">
        华北平原
      </Paragraph>
    </TableCell>

    <TableCell id="BcSKoXI05eOGkqQr4iSoOK">
      <Paragraph id="oL4nQkwxZKILpQMoyqjjPS">
        农田
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="2ByVXNIpD6G3d4ZRzSvwTf">
    <TableCell id="feXaFskJTqSy8osJKovAqn">
      <Paragraph id="LO0kmB3Y0O2b2cbSOSMkZ3">
        四川盆地
      </Paragraph>
    </TableCell>

    <TableCell id="POopVaPjFVxjyAHeXZxqM0">
      <Paragraph id="rJSWEEngQTrB2DhUjY9PTY">
        农田、竹林，四周是山地森林
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="tTReqFPSKLmngnHPhZemev">
    <TableCell id="OZEif8tIMmAkxrLvXA1m0a">
      <Paragraph id="RbHKmoLzvFcURdPT7wMd4N">
        长江中下游
      </Paragraph>
    </TableCell>

    <TableCell id="1qgJHat9xyikuYVLtP7zAF">
      <Paragraph id="wUUIwaBXWfjZAM3LwiqUPk">
        水田、湖泊（洞庭湖、鄱阳湖、太湖）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="MdbThPISpsJsRAsB0WzlXG">
    <TableCell id="44mttZgucSNFGGrT2Yxf8p">
      <Paragraph id="oAtZjv7J7SEwCU9K5CJbUN">
        江南和东南丘陵
      </Paragraph>
    </TableCell>

    <TableCell id="gSLSUkJVH38Me9EPahwJuP">
      <Paragraph id="JLKKJhAkdzXKxeONyIePaj">
        阔叶林、茶田丘陵
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="UM7mKsxxpCcFzxo4hwPy4U">
    <TableCell id="bQtGu4z5XdmIJUTN537RGD">
      <Paragraph id="oCZwv16NfQJa0JzM7faHZ2">
        云贵高原
      </Paragraph>
    </TableCell>

    <TableCell id="YaexASTvdLVSSSRoBU62vk">
      <Paragraph id="9CNUh7v2urtwV28EtkmRFX">
        喀斯特峰林（专用模型）、梯田
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="U49i07UQaaKwXPpqMWCRoM">
    <TableCell id="pcyAS1ttvUeDu1LNgbtGRz">
      <Paragraph id="Im8eB5Bcpcu6gth12CPh3r">
        华南
      </Paragraph>
    </TableCell>

    <TableCell id="wIROpDvGKPopQeZwsgcxyk">
      <Paragraph id="HMgECVjlr9HNFFWHSlNA5z">
        亚热带林、农田
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="baEp6YTRC1pkYhUQABedwk">
    <TableCell id="U2lNhWAv5k9F1WacyjCDQp">
      <Paragraph id="8NG8Wf18LsyhM3ztFs70MC">
        海南和滇南
      </Paragraph>
    </TableCell>

    <TableCell id="Dmt8uij8g5OkeDi7RvgMvk">
      <Paragraph id="yjF666AyKsHwIMClDtyAjT">
        热带雨林、椰林
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="EZfYPGqA6X3z9zsFjxj82A">
    <TableCell id="g9pgINfsoSl4wI2iqSipVt">
      <Paragraph id="1lzKiiwlc3JoEl761hqNrR">
        台湾
      </Paragraph>
    </TableCell>

    <TableCell id="Go5f4u6owOJ8GcbWN03xlh">
      <Paragraph id="HPGYlpSakXsS9Vd7v5x5qS">
        中央山脉，东侧是森林，西侧是平原
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="3r5FkIl1QAFeOOVann5Dhf">
    <TableCell id="pyDXpxdm1OMxDfCoA2lDbF">
      <Paragraph id="sByFKdChSck7z6Q47hJotD">
        近海和远海
      </Paragraph>
    </TableCell>

    <TableCell id="kHTci8EzLljpAWUE4UAaNM">
      <Paragraph id="5TRFUVXm7ik2RbieAki8dp">
        浅水、深水
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="HoWEy12OCMvPmp4EGDkpuO">
  <Mark bold>地貌代码</Mark>（`u8`）：`OCEAN, SHALLOW, LAKE, PLAIN, FARMLAND, GRASSLAND, STEPPE, DESERT, GOBI, LOESS, TUNDRA, SNOW, KARST, WETLAND`。
</Paragraph>

<Paragraph id="xi5Psp4RWYWqHLZrFrmDSe">
  植被和装饰属于<Mark bold>附属特征</Mark>（`FOREST_CONIFER, FOREST_BROADLEAF, BAMBOO, JUNGLE, PALM, TERRACE, OASIS`），由分区里设定的比例加上确定的噪声决定。
</Paragraph>

<Heading id="utRsgAcdeJwTl3AAdTJpXS" level="3">
  6.5 河流
</Heading>

<BulletedList id="bZqdQVSzn25YyiriVqCbJ1">
  数据：Natural Earth `rivers_lake_centerlines` 10m 版本（公有领域），只保留约 12 条主要河流。
</BulletedList>

<BulletedList id="8GjS447eTgGPt1WTM1oGwh">
  把河道折线吸附到六边形的边上：沿折线按顺序找最近的格顶点，再用 A\* 算法在格顶点图上连接，并且约束路径必须向高程更低的方向走。
</BulletedList>

<BulletedList id="LvX8UHkScTWnQdN9q2RhAE">
  输出：每个格子一个 6 位的掩码，记录哪几条边有河。
</BulletedList>

<BulletedList id="L9SYldq5TkioycDDFTHQ3H">
  河流的宽度分 3 级（上游、中游、下游），渲染时宽度不同。
</BulletedList>

<Heading id="Royfwj2hIa4KWLx07nRXC6" level="3">
  6.6 南海诸岛（示意）
</Heading>

<BulletedList id="RMZxfb5apVlDcFx7AZzRe8">
  不按真实比例和位置绘制。在地图东南海面上，放一组<Mark bold>示意性的珊瑚礁小岛群</Mark>，大约 20 ～ 30 个小岛格，由浅水、沙洲和少量椰树组成。
</BulletedList>

<BulletedList id="BHp8efzCUV7Wyn13lF9VnW">
  岛群位置用固定坐标配置在 `bake-terrain.ts` 里，确保在主视角下可见，并且不遮挡华南沿海的社团。
</BulletedList>

<BulletedList id="YTRJe3M5wx68iA1dcohOLO">
  不画任何界线和标注。
</BulletedList>

<Heading id="hPaaCz9b0JuxSS9vuoYr2m" level="3">
  6.7 轮廓处理（设计决策）
</Heading>

<BulletedList id="5dJbifeUtne8etuwWynXsp">
  <Mark bold>海岸线</Mark>：尽量准确，这是人们辨认「像中国」的主要依据。台湾、海南岛要完整绘制。
</BulletedList>

<BulletedList id="5YyIhlEjsduePDRcGPF1QU">
  <Mark bold>陆地边界</Mark>：不画出硬边。中国以外的周边陆地同样生成地形，但<Mark bold>逐渐淡入羊皮纸和云雾</Mark>（也就是未探索区域），所以地图上<Mark bold>不会出现国境轮廓线</Mark>。这既满足「不显示国境线」的要求，也避免在边界细节上出现争议。
</BulletedList>

<BulletedList id="gj4A0MfX3p3naKakg0mUJ9">
  这些周边地形只是装饰，不能交互，悬停时不显示信息。
</BulletedList>

<Heading id="NFZmnok4J76XstO3CLnc0j" level="3">
  6.8 输出格式（`public/terrain/terrain.bin`）
</Heading>

<Code id="3jrqRwgTl9p8YKqyyRdsmB">
  ```
  Header (32 bytes)
    magic "CVMT" | version u16 | cols u16 | rows u16 | originQ i16 | originR i16
    hexSize f32 | levelHeight f32 | reserved
  Tiles (cols × rows × 6 bytes)，按行存储
    byte0  level        u8   0–9
    byte1  biome        u8
    byte2  feature      u8
    byte3  riverMask    u8   bit0–5 对应六条边
    byte4  flags        u8   bit0 陆地 | bit1 海岸 | bit2 可放社团 | bit3 装饰区（中国以外） | bit4 南海示意
    byte5  fog          u8   0 可见 | 1 淡化 | 2 未探索
  ```
</Code>

<BulletedList id="MC5S95J40TKonAzjoXLnWa">
  原始大小约 84 KB，gzip 压缩后约 20 KB。
</BulletedList>

<BulletedList id="js6COL1rXyQ9LRB8Z48STB">
  同时输出 `terrain.meta.json`：包含投影参数、城市坐标到格子坐标的换算参数、烘焙时间和数据源版本。
</BulletedList>

<BulletedList id="0vGhN2dKC1gP8ZjnQfSoxN">
  烘焙是<Mark bold>确定性的</Mark>：输入相同，输出的字节就完全相同。CI 会检查这个文件的哈希，有意外变动就报警。
</BulletedList>

<Divider id="LQArzqvrOhg4ufcY7OidoH" />

<Heading id="d0lT2uktAqlQVXoR5yntVa" level="2">
  7. 3D 渲染架构
</Heading>

<Heading id="BJUa6L8QcOXXDruwaM3azN" level="3">
  7.1 模块职责
</Heading>

<Table id="oXsohmTq3oRX5kBNP9xddt" readonly rowHeader>
  <TableRow id="y8AmVV8GBXGC8la7CndWbJ">
    <TableCell id="iQj7SlbrLcjgYnn83CnFwv">
      <Paragraph id="SOXxF59E0wpFDg9DVW82g2">
        模块
      </Paragraph>
    </TableCell>

    <TableCell id="ccxOe9F132kohPvqksbHmh">
      <Paragraph id="WV0uZCBjagSNhgf3mwr492">
        职责
      </Paragraph>
    </TableCell>

    <TableCell id="cBpsvSAir62ISQBw6MucFa">
      <Paragraph id="21DIM1OLXYmQvxCdysUFcC">
        依赖
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="TfnCDkpJPcRcZAfSGUgEy8">
    <TableCell id="p7LkKFVdyM2CnjZEmz8cNE">
      <Paragraph id="kNwAwKj3vHHIVmhyr8IYzS">
        `core/Renderer`
      </Paragraph>
    </TableCell>

    <TableCell id="qkfnrwTS0CvnuyK8wOwiTc">
      <Paragraph id="Og1y4NuVuO7Lz4SxqdHzgP">
        渲染器、色调映射、画面后处理、画质档位切换
      </Paragraph>
    </TableCell>

    <TableCell id="9pCQyw5hoRBW7d5dNCREtK">
      <Paragraph id="zqKOyN9ykN5iNcS60fHZjF">
        three
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="9qphBWhgxtqMHHqmJmnqSy">
    <TableCell id="va8iS5X5UHJ2bjdymSvMOA">
      <Paragraph id="d6wC8t4TLOQNXD08laHhvG">
        `core/CameraRig`
      </Paragraph>
    </TableCell>

    <TableCell id="Z89k3oymYkzhxK7hnS8Iym">
      <Paragraph id="OA1halr9ivTy1EbAPuJde6">
        相机，基于 OrbitControls 改造：限制俯仰角、限制平移范围、平滑飞行
      </Paragraph>
    </TableCell>

    <TableCell id="2zuvx9JFekblsp5nhpnTBD">
      <Paragraph id="cr7Af9J20L5HOxuns12H0H">
        Renderer
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Ac0dHXAe8zq7cHOFiR3yHZ">
    <TableCell id="tywl80Bs9ZGk3ebNHOGugf">
      <Paragraph id="nm8Ext7BJV2Og4pg62jTxT">
        `terrain/TerrainModel`
      </Paragraph>
    </TableCell>

    <TableCell id="oJhx8vT6PE8gNrZXzZBsMD">
      <Paragraph id="QbQS17DtpOg5xW1Yri95q1">
        解析 terrain.bin，提供按坐标查询格子的接口
      </Paragraph>
    </TableCell>

    <TableCell id="I1B4ihQlc3uOBQHJeAmviN">
      <Paragraph id="7HsofHeNDyhAnpt0caQQJf">
        shared/hex
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="mtWs5Nn1Lqkc5WoesUGwLm">
    <TableCell id="MEC07hYX3Bs3r1CS8diNig">
      <Paragraph id="snY7i60RSTiHerxenEieuJ">
        `terrain/ChunkManager`
      </Paragraph>
    </TableCell>

    <TableCell id="jwWX9VBjdrtO4dJ90d7PlK">
      <Paragraph id="MdPUzL80LL6qU1AebrXrks">
        把地图切成 16 × 16 格一块，按视锥体和距离决定加载、卸载和细节级别
      </Paragraph>
    </TableCell>

    <TableCell id="gMZMVydLs4UXddCf0uE2Zl">
      <Paragraph id="2AmHTCKg03l6IEowXFYWCe">
        TerrainModel
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="sze65JFJLamDj5L8lXccm8">
    <TableCell id="r7dMjFu0cJNHCL24O7Kbzs">
      <Paragraph id="QDadihPBXlS489e2F0AGl5">
        `terrain/ChunkBuilder`
      </Paragraph>
    </TableCell>

    <TableCell id="zBK9K1FbSFMPaRTtHAl31A">
      <Paragraph id="P7z1tPVBzgVZ0XASrzWUol">
        为每块生成地块网格和装饰物实例，<Mark bold>在 Web Worker 里运行</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="tffx4yPC9uGnMHEUlmjLym">
      <Paragraph id="RBBCV3XbnXQJSOHykkaXP6">
        TerrainModel
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Yk02CBiuZfqW3ftyKVm2uU">
    <TableCell id="EI2AnYQlrrIZuPPqZTGt5L">
      <Paragraph id="MuXbOcpzNxjCPRQOt6XlIK">
        `terrain/decorators/*`
      </Paragraph>
    </TableCell>

    <TableCell id="Xw9lprLYiUeURO4pLQ1AEG">
      <Paragraph id="4OY7OUh2I7lvklfxo15nF6">
        每种地貌一个装饰生成器（树、山、沙丘、梯田……），都是纯函数
      </Paragraph>
    </TableCell>

    <TableCell id="0rfWsD7uyTU2OWSOFXU2kp">
      <Paragraph id="LPHWoTKOJnyxGxLeaaBGiV">
        ——
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="miBJ2pLETZFpYennFY8yQL">
    <TableCell id="DZLVrhhomUO0BtFmLrbt1J">
      <Paragraph id="qJ4gUT63r603G0v0DRVmLq">
        `water/WaterSurface`
      </Paragraph>
    </TableCell>

    <TableCell id="lMo5hMLzZbHFtdjQqrOpTT">
      <Paragraph id="Vp7aBGgVGjDYYaaikGG2ml">
        水面着色器、岸边浪花
      </Paragraph>
    </TableCell>

    <TableCell id="ZSxAkY4lwCBkpvLzlNbasQ">
      <Paragraph id="WnSsXJm1FxdvN6jKXMTmMn">
        TerrainModel
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="xgg66a8x00PslQxBPA6Y2i">
    <TableCell id="aWnbLD7u8b82O5iEkvktaK">
      <Paragraph id="QenPtQE7GGL4SmuEiiyWRo">
        `sites/SiteLayer`
      </Paragraph>
    </TableCell>

    <TableCell id="jWDU6AirnEXG1xev7HPPbU">
      <Paragraph id="3SaKjo5NSYmfKuw3LHWxTk">
        社团据点的实例化渲染和建城动画
      </Paragraph>
    </TableCell>

    <TableCell id="aVuVxoVnq4HzMF81KYe3by">
      <Paragraph id="Te0qSbDyCOua8yyBfzfwlE">
        store
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="PwNaBI4PFIXERxbCsy2uoB">
    <TableCell id="qHF9Nxu1wxO7zjoTk2hbTI">
      <Paragraph id="mWxbNYupi7nrQ71XuEpdEb">
        `overlays/BannerLayer`
      </Paragraph>
    </TableCell>

    <TableCell id="TJjFWiEAs2Fh2fle9Ag1pn">
      <Paragraph id="t8YKc7IvGxO65kRh8WJAXy">
        社团名旗帜（HTML），负责投影、避免重叠和按距离淡出
      </Paragraph>
    </TableCell>

    <TableCell id="kWRoO5wK4gNKWCuj71MVKH">
      <Paragraph id="AfJzlxAyC86n9Hq3Gmz7vB">
        CameraRig、store
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="2P7iqPSm3jlDcGkalzSN9J">
    <TableCell id="5IaM8YQM2sCJZFvP32Xrvh">
      <Paragraph id="Ep5CPHPBTuxQG9A1iNAjpX">
        `overlays/Picking`
      </Paragraph>
    </TableCell>

    <TableCell id="vf3oCMcZUX4UlkrmSJD3GP">
      <Paragraph id="FXH6waWpIG4ORpL08CNcBY">
        用射线检测找出鼠标所在的格子，负责悬停和选中高亮
      </Paragraph>
    </TableCell>

    <TableCell id="ZZygWmd7cfISBgy53OF0QZ">
      <Paragraph id="bSbLrJ9cn6tZAJYrwLSe3P">
        TerrainModel
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="2d45ElU3mWpFaqhXYh4QxQ">
    <TableCell id="TsA5qnvh9GDs5KEOt1IvAy">
      <Paragraph id="Me59se8lkuh6FEqnFHZW97">
        `minimap/Minimap`
      </Paragraph>
    </TableCell>

    <TableCell id="bc173VWcvqyKQSDO3HNdOF">
      <Paragraph id="n9jUgd9hpiNi2cwY9zlstv">
        2D Canvas 小地图，显示视口框，点击可以跳转
      </Paragraph>
    </TableCell>

    <TableCell id="s3ZguWNujBrkT9ENSrJRbX">
      <Paragraph id="fvksdQjOetp4cKKN2PERCo">
        TerrainModel、CameraRig
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="9PQaDXRTU2gyvpJIZSWA2m">
    <TableCell id="UWUZ4OqONEKkl8No0lJJrM">
      <Paragraph id="LgZrbk13D9HA2eGBtvp64S">
        `timeline/TimelineController`
      </Paragraph>
    </TableCell>

    <TableCell id="Ig90UbPWH2QUWls2c7dybr">
      <Paragraph id="dzarvWOucrzJXYguJ7Lk7X">
        时间轴状态机，只修改 store，不直接操作场景
      </Paragraph>
    </TableCell>

    <TableCell id="7qFTaKCbj7fDlrU6hVeTUt">
      <Paragraph id="6Sgteo9b8O50dRA8SuTr1b">
        store
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="ldp5yFPKqibBtbR2kSzlZM">
  <Mark bold>原则</Mark>：模块之间只通过 `store`（状态）和明确的接口通信，渲染层只负责「状态 → 画面」。这样时间轴、列表筛选、详情跳转这些功能都不用直接操作 three.js 对象。
</Paragraph>

<Heading id="jy1tBYiMlxV0fkVFATK5RA" level="3">
  7.2 全局状态（`src/data/store.ts`）
</Heading>

<Code id="eWB1onzzIy7Xjv1orIS1k7" language="ts">
  ```ts
  interface AppState {
    dataset: Dataset | null;
    selectedId: string | null;
    hoveredTile: { q: number; r: number } | null;
    filter: { keyword: string; cities: string[] };
    timeline: { open: boolean; year: number | null; playing: boolean };
    quality: 'high' | 'medium' | 'low';
  }
  ```
</Code>

<BulletedList id="hirjZVk3OosaW5hiW9a8tx">
  用一个轻量的发布订阅实现，大约 50 行代码，不引入状态管理库。
</BulletedList>

<BulletedList id="BShKt6RNbkgjhYWHSBXdJc">
  <Mark bold>哪些社团可见</Mark>由 `filter` 和 `timeline.year` 共同计算出来，地图和列表使用同一个结果。
</BulletedList>

<Heading id="b6TqaO2WxrGlkvUQhsHxxy" level="3">
  7.3 地块与装饰
</Heading>

<BulletedList id="E4LIEyV7Pqn3Q5CQHWgXiw">
  <Mark bold>地块</Mark>：每块生成<Mark bold>一个合并后的网格</Mark>：

  <BulletedList id="LgJMsyDJVvwEEXfcyEGecY">
    顶面是六边形，边缘有倒角。
  </BulletedList>

  <BulletedList id="oZIFXRKp1Ao02clAbUuF1E">
    侧壁按相邻格子的高差生成，侧面带岩层纹理（用顶点颜色实现）。
  </BulletedList>

  <BulletedList id="ZHCEZ0j0PeWhAR6amuJZuk">
    颜色由地貌决定，并带确定性的微小色差。
  </BulletedList>
</BulletedList>

<BulletedList id="NTfqaIv4RXNVyKfAOvww2T">
  <Mark bold>装饰物</Mark>：按种类用 InstancedMesh 渲染，每块每种最多一次绘制调用。
</BulletedList>

<BulletedList id="4TW7X2bSVuSAWXQ7ydmjky">
  <Mark bold>随机种子</Mark>：`hash(q, r, 种类)`。每次打开页面，每棵树的位置都完全一样。
</BulletedList>

<BulletedList id="hbS8jjZJ7XHbSl1BRlujda">
  <Mark bold>细节级别（LOD）</Mark>：

  <Table id="PkZ65QbBdubqTHOmMWXnsh" readonly rowHeader>
    <TableRow id="rXT9PTEPSfjnHF2VHSPjaP">
      <TableCell id="y59fviklqyUmQBVz9vn9zx">
        <Paragraph id="UWXqb00DuTWKmqkK9GArqq">
          距离
        </Paragraph>
      </TableCell>

      <TableCell id="osG3MeAQ5ema7UKNnVMmCU">
        <Paragraph id="xSj3CfWtZo5hPqojUdC2kG">
          表现
        </Paragraph>
      </TableCell>
    </TableRow>

    <TableRow id="psQHVjOVdlWMZlLRRZBg9K">
      <TableCell id="TaNYnFhEYVPvDHIoyheUek">
        <Paragraph id="7uIOcrk3AyELUiJ1cJOJBb">
          近
        </Paragraph>
      </TableCell>

      <TableCell id="RLT577CrirTXztj8DUWWgm">
        <Paragraph id="SXyF1L2hZ9cTcQjGfWKMEc">
          完整装饰
        </Paragraph>
      </TableCell>
    </TableRow>

    <TableRow id="LRuSK56b8LBplU85cgjkBr">
      <TableCell id="Pv8pr1XoDaSR7ophjHk7eh">
        <Paragraph id="csirNpYq3Xu0Yfm4yfGERI">
          中
        </Paragraph>
      </TableCell>

      <TableCell id="YyjbRFFwMlysTzR0F2EE4m">
        <Paragraph id="ktGT2FUuhLo5F1QxVODbO1">
          装饰数量减半
        </Paragraph>
      </TableCell>
    </TableRow>

    <TableRow id="OFFy9SmyBTLrlrky8Y9Bft">
      <TableCell id="3bqvaf5jc2Rd40lcNtl1eE">
        <Paragraph id="tX6tRoytlNGerJ47i2HQQS">
          远
        </Paragraph>
      </TableCell>

      <TableCell id="l23qfZTp3tcrfmskUOt60B">
        <Paragraph id="3PvNvkKBwnZ8MGEn8FwRPS">
          只显示地块和山体，树换成简化的色块
        </Paragraph>
      </TableCell>
    </TableRow>
  </Table>
</BulletedList>

<BulletedList id="Y4si3PgGdDqoQJPc0CYFX8">
  <Mark bold>Web Worker</Mark>：分块的网格在 Worker 中生成，通过 Transferable 把缓冲区传回主线程，避免页面卡顿。
</BulletedList>

<Heading id="tDNJpNpFjfhqEOVHpZYXWi" level="3">
  7.4 迷雾
</Heading>

<BulletedList id="JLuxkH3L5kHLaRHWVGOdBj">
  中国区域全部是「可见」状态，保持全彩。
</BulletedList>

<BulletedList id="REQYqJS4g1O7vpvg2ycoby">
  周边装饰区从边界开始，3 ～ 5 格内由「淡化」（羊皮纸色调）过渡到「未探索」（羊皮纸加云雾）。
</BulletedList>

<BulletedList id="Gs98BCRsF0A0I90abEYZqy">
  地图底下铺一张羊皮纸平面，上面有手绘网格纹理，并且和地块网格对齐。
</BulletedList>

<Heading id="CytcDchai51hJ1PYld0AsO" level="3">
  7.5 社团据点与旗帜
</Heading>

<BulletedList id="EwQXuUBAioHGH1i5997i6f">
  <Mark bold>据点模型</Mark>：统一的小型建筑群，包括塔楼、旗杆和几栋房子，<Mark bold>所有社团大小一致</Mark>。
</BulletedList>

<BulletedList id="z2ip1BOI0tp2OiceCxAdrV">
  <Mark bold>旗帜</Mark>：HTML 元素，内容是 Logo 缩略图（没有 Logo 时显示社团名的首字）加上社团名。
</BulletedList>

<BulletedList id="mrRxhQB0Qia30Zf7S17flg">
  <Mark bold>避免重叠</Mark>：每帧按屏幕位置做碰撞检测，被挡住的旗帜淡出；悬停或选中的旗帜永远在最上层。
</BulletedList>

<BulletedList id="8BHsZW56pi2pK59QK69iC8">
  <Mark bold>按距离显示</Mark>：

  <BulletedList id="vonYQ6eVsZqLWHD3dNyO9c">
    相机较远时只显示据点图标。
  </BulletedList>

  <BulletedList id="xWwbimPw033gDAp6Vy0Dhk">
    拉近后显示完整旗帜。
  </BulletedList>

  <BulletedList id="LzFc0IPA4sZURojrBr7bGt">
    城市名在远处显示（例如「杭州 · 3」，3 是这座城市的<Mark bold>社团数</Mark>，不是人口）。
  </BulletedList>
</BulletedList>

<Heading id="yjaytg51cnIJ69zI7YRxx1" level="3">
  7.6 画质档位
</Heading>

<Table id="Xzls6Mih6fF6D3ZFXgGUhv" readonly rowHeader>
  <TableRow id="AjNso7sWpmZopQOwlKA5oS">
    <TableCell id="0AuWBVoASxRgi755yBr0yW">
      <Paragraph id="MdVs73LfHbqY3fnHdNZwVa">
        档位
      </Paragraph>
    </TableCell>

    <TableCell id="Ay7J3tiLlsnL7lvBlVaUG5">
      <Paragraph id="Pl8OYt2RYO7LCQBwsLdOVt">
        阴影
      </Paragraph>
    </TableCell>

    <TableCell id="MowPIjxJ9PZzyEuxHejrzQ">
      <Paragraph id="URCjbR495sOOF9elSftTNW">
        后处理
      </Paragraph>
    </TableCell>

    <TableCell id="427VoYAN6ndFDsz6tGLtRG">
      <Paragraph id="hyuKGuHU6Xch7xQ5yAmPn9">
        装饰密度
      </Paragraph>
    </TableCell>

    <TableCell id="eRQUUT3ulXJhYADEAASDht">
      <Paragraph id="I6xA61QIx0oN7xzak2pjA2">
        像素比
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="a4LQ0hSpbm3ymrzPHwYUdV">
    <TableCell id="bsIVKnjZYs2TLt7j1zbWXG">
      <Paragraph id="LhsHhBkHFnTwzsebCl5hZo">
        high
      </Paragraph>
    </TableCell>

    <TableCell id="JSlvkqKdbrlEEblpvO8R6R">
      <Paragraph id="av2wDNps3rMDboRuUKde1R">
        级联阴影 3 级，2048 分辨率
      </Paragraph>
    </TableCell>

    <TableCell id="l5vcxxE7OZuYjoHXo2lOBM">
      <Paragraph id="FilVXPy7di1F2eHw8OpuDZ">
        环境光遮蔽 + 色彩分级
      </Paragraph>
    </TableCell>

    <TableCell id="uFMChWWlKxJ1MF4J7LrnvM">
      <Paragraph id="AzhTTlCxbvHCnhdBUzSwEa">
        100%
      </Paragraph>
    </TableCell>

    <TableCell id="uinhvbJPPkMSLVUH0rYybU">
      <Paragraph id="9xWvSPSrSKMz8c4tQ6J9g0">
        ≤ 2
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="y1z2vWhYTCnW9DyzVHO9Ao">
    <TableCell id="7WjVmvzeC6vjghTfsO7f30">
      <Paragraph id="vjhJtbey8VyJIXXzeprQC6">
        medium
      </Paragraph>
    </TableCell>

    <TableCell id="c8tSMVY4eOzMbSTo5kTgYF">
      <Paragraph id="5J0rXAEYu5DrugaVylO0i6">
        单张 2048 分辨率
      </Paragraph>
    </TableCell>

    <TableCell id="vOus9l6nMQZVHJhC5ZrNOd">
      <Paragraph id="0JosBOsyVsd0CfWaga9Pec">
        只做色彩分级
      </Paragraph>
    </TableCell>

    <TableCell id="RILxHR0qzwgctBMRRq94zq">
      <Paragraph id="yMEEjino346jktYia8EqHz">
        70%
      </Paragraph>
    </TableCell>

    <TableCell id="AQD9uiEemWI54ADX2bjpZs">
      <Paragraph id="4DYbNuIsDKiLgiPKmfLf12">
        ≤ 1.5
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="YfayfQ9hc7bzVCKLTonaYM">
    <TableCell id="ZakEkHi5S0ZAotQ52ELXHb">
      <Paragraph id="j899WcXlwsKywKAb0fpMTS">
        low
      </Paragraph>
    </TableCell>

    <TableCell id="7PQAGq76UcF9B7bElvDNTq">
      <Paragraph id="21vfh0AruzwshlStMltVW8">
        关闭（改用预先烘焙的顶点阴影）
      </Paragraph>
    </TableCell>

    <TableCell id="HJANj9Ydxtq5glwzUYPqdB">
      <Paragraph id="YcBI2shm3jPzpoYUkdr8xF">
        无
      </Paragraph>
    </TableCell>

    <TableCell id="u9pip38apfBhEyupCwg6Fk">
      <Paragraph id="R32ECjYUyT0pXVowQl5hFx">
        40%
      </Paragraph>
    </TableCell>

    <TableCell id="OinfFeGZCqU4ubuuwP4Kxb">
      <Paragraph id="sWOLzZj1zHPZV0FjxKwKnO">
        1
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="S1JHIq90I2oV6GR481QQjz">
  启动时根据显卡信息和屏幕尺寸选择初始档位。运行中如果连续 3 秒帧率低于 40，自动降一档。用户也可以在设置里手动选择。
</Paragraph>

<Divider id="GsiwK9MjfDsFHevcl9WN3l" />

<Heading id="feqyTibEl61Wty3nOQjAhy" level="2">
  8. 页面规格
</Heading>

<Heading id="Q13h6Z8JmS7vSWG3ljFddk" level="3">
  8.1 公共部分
</Heading>

<BulletedList id="AGdbGte95WDYko4jNgOYfP">
  <Mark bold>顶栏</Mark>：站点 Logo 和名称｜地图｜关于｜加入我们｜搜索（输入后跳转到首页，并带上筛选条件）。
</BulletedList>

<BulletedList id="J1wPSy5P53Qecnfuc3ROY1">
  <Mark bold>页脚</Mark>：放在首页以外的其他页面，内容包括数据更新时间、联系方式、备案号（有的话）。
</BulletedList>

<BulletedList id="05YHCV9YB2HzuUHDKayARA">
  <Mark bold>路由</Mark>：用 Vite 的多页面模式。详情页地址是 `community.html?id=<id>`，如果 ID 失效，跳到首页并给出提示。
</BulletedList>

<Heading id="CFl8fLMkhop3WrT3XwslBb" level="3">
  8.2 首页（桌面，屏幕宽度 ≥ 768px 且支持 WebGL）
</Heading>

<Table id="ACHeyE7LNk43gI4okH38Ww" readonly rowHeader>
  <TableRow id="FgMqve7srra4NtRhrbfujJ">
    <TableCell id="YTvl3AdZu36QokremwSpYz">
      <Paragraph id="xLpsJzHk2ZawL8bBKJhraj">
        区域
      </Paragraph>
    </TableCell>

    <TableCell id="TPdXpv3B0UVpTr5fmbVUtI">
      <Paragraph id="rc9JGO9pSEDtzZ51zUCOAT">
        内容
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="WUqqhLkYkz03yJry3V1dQG">
    <TableCell id="jti9eAeC1UxF37zho2X7Wl">
      <Paragraph id="YwmT3DJznaaXu2t5aLfgrB">
        全屏
      </Paragraph>
    </TableCell>

    <TableCell id="KqTM2HeCC8rEgyIYAEEpA3">
      <Paragraph id="YdWdtISs0fFn1XfuIr2l39">
        3D 地图
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="YkpW4VV8ZZ9ssmHARxENJu">
    <TableCell id="NRzFDdb2Q0xVSmWIyobqcK">
      <Paragraph id="krZU6bVcfKEDUbhurdlaOv">
        顶栏下方的信息条
      </Paragraph>
    </TableCell>

    <TableCell id="fAqNbsOEXASJjGixNsnZ3c">
      <Paragraph id="QZkl4bWHi5ZXrKFjiwORfp">
        社团总数、覆盖城市数、数据更新时间（<Mark bold>不显示人口</Mark>）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="nBR8shtabpGoCxvSYMIvcx">
    <TableCell id="cGAXNCsGVYCjq6hVr2dINL">
      <Paragraph id="P1nbmWmBm5PWCzrrw9xQhP">
        右侧
      </Paragraph>
    </TableCell>

    <TableCell id="WDHQFBkUTeevr8whksIA3g">
      <Paragraph id="9oy5jAldyRVWnb9Cg0jKDN">
        社团列表侧栏，可以收起：搜索框、城市筛选标签、社团列表
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="hxkKsHRJlUXUIJ1qSTJOkR">
    <TableCell id="dtjD6fHdJks91z7Vr8FGLb">
      <Paragraph id="e6qvuaJoBeYVf18etxjsdj">
        右侧（选中社团时）
      </Paragraph>
    </TableCell>

    <TableCell id="ESAyQTTXnzH5pyWhv4auYf">
      <Paragraph id="AEZE4z6WdNAnazZITes1MO">
        预览面板：Logo、名称、城市、成立年份、简介、群号（一键复制）、「查看详情 →」
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="9Pr9eXk9htr3dxFv1zZPXF">
    <TableCell id="f2LUIJ9Jcamp5GjzaefN5k">
      <Paragraph id="fLhQsSE20TZcdBoQAEojqK">
        左下
      </Paragraph>
    </TableCell>

    <TableCell id="tx0poqJAGQJbkaU1heuuYt">
      <Paragraph id="Lj47iYqRpx0CxT5BAaiZN6">
        悬停格子的信息：地貌名称和所在区域（比如「四川盆地 · 农田」），如果格子上有社团，同时显示社团名
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="r9jAEi4w8idbBcP5GWV1b1">
    <TableCell id="7xJaukd5I50aL3P2ZsjIFE">
      <Paragraph id="FzDwrkw5MCn3paZtktu9Sb">
        左下按钮
      </Paragraph>
    </TableCell>

    <TableCell id="puCO3e7ZxE2Dc7IA6mB2oA">
      <Paragraph id="nAmCFlH541xdpHQalNxouh">
        📜 时间轴
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="9DfIpMdEajMX0R8oVJoSwL">
    <TableCell id="Q2pgePXoBzKeaTvkGb1Lnk">
      <Paragraph id="zTULIv4EPwPZvZlHlyE8ks">
        右下
      </Paragraph>
    </TableCell>

    <TableCell id="7GmgsODT8gCiZTBToYNhwt">
      <Paragraph id="Gi80UIlPSvADAbhMXuFAmg">
        小地图
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="eWOBX9wCoOZ28u5A5f7R1f">
    <TableCell id="IMr113LtOETc30WEd5mfW7">
      <Paragraph id="u3nvgEH7OPmdgrdRWS4LxW">
        首次访问
      </Paragraph>
    </TableCell>

    <TableCell id="J2aMjrYTeaKl1hJCFnZJcM">
      <Paragraph id="BH3PR3DKlbEz6NTFKZYiW7">
        操作提示（拖动、旋转、缩放），可以关闭，关闭后不再显示（记在 localStorage）
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="llxQs36GKA762IOKvefGsC">
  <Mark bold>交互</Mark>：
</Paragraph>

<BulletedList id="MuZnGTtQRnkRV0VkBfztIs">
  <Mark bold>悬停</Mark>在社团据点上：格子高亮、旗帜放大、显示小提示。
</BulletedList>

<BulletedList id="mzagyynDuEDAPtgvfgD8hF">
  <Mark bold>点击</Mark>社团：相机在 0.8 秒内飞过去，同时打开预览面板，地址栏变成 `#c=<id>`，方便分享和刷新后恢复。
</BulletedList>

<BulletedList id="lNzxkVQHXS7anXewjiR4cx">
  <Mark bold>在列表里点击</Mark>某个社团：效果和在地图上点击相同。
</BulletedList>

<BulletedList id="NLW3hSalT9T1xpOHC9DHSR">
  <Mark bold>键盘</Mark>：

  <BulletedList id="SDUBz3LNkgy07dFcKOnccz">
    `/` 聚焦搜索框。
  </BulletedList>

  <BulletedList id="xDRAAbW2TzxUR0j2cJaXMx">
    `Esc` 关闭面板。
  </BulletedList>

  <BulletedList id="fJiEBa9QuJNeAC7kOvRqrP">
    方向键平移地图。
  </BulletedList>

  <BulletedList id="G5XVR8wuldRoZbK17AB1z6">
    `+` / `-` 缩放。
  </BulletedList>

  <BulletedList id="9slsPSEJ2JVn6TtQ4BpoW0">
    列表支持 Tab 键导航和回车打开。
  </BulletedList>
</BulletedList>

<Heading id="nGJ0qU8spjJDQpq6yMAbeW" level="3">
  8.3 时间轴
</Heading>

<Paragraph id="yVvT6K7GJR77Ko76m9Cmvx">
  <Mark bold>入口</Mark>：首页左下角的「📜 时间轴」按钮。点击后，底部弹出年份条（文明六「时代」风格）。
</Paragraph>

<Code id="3zR3IR9TuAUzN9Wf0oFOBy">
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ ▶ 播放   2016 ─ ● ─ 2019 ─ 2020 ─ 2022 ─ 2024 ─ 2025 ─ 2026 ─ 待考  ✕ │
  │ 2024 年成立：xx社、yy社                                            │
  └──────────────────────────────────────────────────────────────────┘
  ```
</Code>

<Table id="DZhHZx4U7cmlG80ygWaPa2" readonly rowHeader>
  <TableRow id="6hubkB1PidtEwrLNlPIwZj">
    <TableCell id="yg4VdFgapDNsYf87ShLFEH">
      <Paragraph id="29yIakYotBgFVqGmMkhbvz">
        项目
      </Paragraph>
    </TableCell>

    <TableCell id="MGrKmhXEnqX2U9tRBg1npY">
      <Paragraph id="CLQ8hyzPDt2QYvFkeZj8a7">
        规格
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="OuvWfsT7NM2LmFiE5UuFjo">
    <TableCell id="uC4gy9wK5mTPj1PUM2JfrQ">
      <Paragraph id="E0AGWYJSQX75MfQWjfGyTz">
        年份范围
      </Paragraph>
    </TableCell>

    <TableCell id="WvxwHuhjXTunEpGGkrc9EQ">
      <Paragraph id="WXdMd971GvAofO9h3KqaLq">
        从最早的成立年份到当前年份。<Mark bold>没有社团的年份会被压缩显示</Mark>，避免一长串空白年份
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="zp0bFANubaBwlk2MmijXB8">
    <TableCell id="hnYKIVkpgggGDO7zCz6mAh">
      <Paragraph id="kNMmJWRPM2isQr27WOaQYw">
        年份节点
      </Paragraph>
    </TableCell>

    <TableCell id="o10Inlth2whOk5Zh40fR5E">
      <Paragraph id="yxCq5Rluha0sr5keVraXGk">
        下方的小数字是<Mark bold>当年新成立的社团数</Mark>，不是人口
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="hbZbhGjbQGCNj4uerLvziX">
    <TableCell id="koS8nyzvVTR26bswFp4tUs">
      <Paragraph id="wvNjz9qZwTjeTq1ZX65UFq">
        播放
      </Paragraph>
    </TableCell>

    <TableCell id="5u08o4a2rztIio7R7i8eSP">
      <Paragraph id="fyNiH7XQ2qoEccAyooa0tc">
        每 1.5 秒推进一年；社团按成立年份依次「建城」：据点从地下升起，旗帜展开，相机平移到当年新社团的中心位置
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="iVpvBokuzE02LmVAKqQMhj">
    <TableCell id="Mxjrt2Y9pEHKU6sRnE6Rto">
      <Paragraph id="1i3gD7s75WxaxheJv19FfA">
        拖动或点击年份
      </Paragraph>
    </TableCell>

    <TableCell id="743Bovd5nJvU2NKUm5lZzc">
      <Paragraph id="plvU53EW4UALwUrNaLNQIl">
        直接跳到那一年，显示截至该年的所有社团，不播放动画
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Y4hdVDR7RaRGFfn3hnUBBR">
    <TableCell id="bCeCDTLGpRK14jTshSVZz1">
      <Paragraph id="OoD8Qz1BqeRk2hEG3EIdJd">
        年份待考
      </Paragraph>
    </TableCell>

    <TableCell id="pCE4vHPtOhRdBAi7MVraOB">
      <Paragraph id="gqnz1e8bwnoWV1GcaQYh5J">
        成立年份未知的社团放在最后一个节点
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="elMoF9AXLhG7MBZpsPvFEC">
    <TableCell id="kyy8MdFureYAC4dUfntNvy">
      <Paragraph id="294JUSPX0bkFwIvaz7Jb6y">
        当年列表
      </Paragraph>
    </TableCell>

    <TableCell id="dGZ4EnjCGkeou1KsNStpaE">
      <Paragraph id="IZnO8LkjR37McTterR7BLl">
        年份条上方显示当年成立的社团名，点击后在地图上定位
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="9El7iZQrRYUfFXPx8OAgF1">
    <TableCell id="Y5HmhziL4dRtCXsFzJtqmK">
      <Paragraph id="QAF0A2dKCdPW4w5dkMuPuP">
        关闭
      </Paragraph>
    </TableCell>

    <TableCell id="Tg7ozFlhs4mEsaYRTi8Aut">
      <Paragraph id="qXoQxcigqWJ67KOsaqikjh">
        恢复显示全部社团，相机回到打开时间轴前的位置
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="TApzzKj13goKjBqXRNpUpV">
    <TableCell id="8BgA6RjuLv01fhaQX0T0nK">
      <Paragraph id="FrIYwyKK292jazLeKSmAhz">
        与筛选的关系
      </Paragraph>
    </TableCell>

    <TableCell id="4ZPDjqsKEZHMWMqmojgipW">
      <Paragraph id="09CSkxo3h73Amdmr7hOzN4">
        时间轴打开期间，列表侧栏同步只显示截至当前年份的社团
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="omr5B9puKV1Njs3oeeLWPg">
    <TableCell id="cBcbKjd1URI3bq7eVRCEnI">
      <Paragraph id="K5I1k7ZqEBDs2tjhT4Hzrh">
        减少动画
      </Paragraph>
    </TableCell>

    <TableCell id="dsJdx11qisBARJ8VKB60AR">
      <Paragraph id="mOKTc0cHayZw0VNcPPMLQB">
        系统开启「减少动态效果」时，建城改为直接显示，相机不做飞行
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="7Lh0ZAq3FCFtmuFLr2IUpH">
    <TableCell id="hADnhZkLzjhdHgd7ZwIdU1">
      <Paragraph id="Cb13vQNA6rnm74RpGdMjXD">
        键盘
      </Paragraph>
    </TableCell>

    <TableCell id="BfVosY6GDc76HYRqlUbEgp">
      <Paragraph id="iUaDQofH5Hc2ho038b1Oh7">
        空格播放或暂停，←/→ 切换年份，Esc 关闭
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="d9Xqq2uik9jvjoNZ8RQGlC">
  <Mark bold>状态机</Mark>：
</Paragraph>

<Code id="D1etE27wbABkaFqnGbwkV7">
  ```
  closed → open(paused, year=max)
         → playing
         → paused
         → closed
  ```
</Code>

<Paragraph id="7LhI1QaMEVF1v5iMtynroa">
  `TimelineController` 只修改 `store.timeline`，由渲染层根据状态完成动画。
</Paragraph>

<Heading id="mdPyifZv1mKmcRAFyhGUM9" level="3">
  8.4 手机端（屏幕宽度 \< 768px，或不支持 WebGL）
</Heading>

<BulletedList id="J7ks19Z9eY8VJ1RjhnHMiu">
  <Mark bold>不下载 three.js</Mark>。首页入口脚本先做设备检测，再<Mark bold>动态加载</Mark>地图模块，所以手机只加载列表相关的代码。
</BulletedList>

<BulletedList id="JDufNqFZ8pLcG4T0KrPlOl">
  <Mark bold>首页</Mark>：

  <BulletedList id="FOhj0Cs8uma4SEBpKaUIxm">
    搜索框和城市筛选标签（可以横向滑动）。
  </BulletedList>

  <BulletedList id="F1SrKzIxvobSAI1IRd0m6v">
    社团卡片列表：Logo、名称、城市、成立年份、一行简介。点击进入详情页。
  </BulletedList>

  <BulletedList id="dOkQ9ciu5DoJN8KJKB4qQY">
    排序：默认按城市分组，也可以切换为按成立时间排序。
  </BulletedList>
</BulletedList>

<BulletedList id="3KuikCjvxb04iTGM1hBdMX">
  <Mark bold>时间轴</Mark>：一个「按年份」切换开关，打开后列表变成纵向时间线（年份做分组标题），不做动画。
</BulletedList>

<BulletedList id="z6gIKmUoBCikrBarDzkkip">
  窗口从桌面宽度缩小到手机宽度时，<Mark bold>不在运行中切换</Mark>，刷新页面后按新宽度生效，避免释放 WebGL 资源带来的复杂度。
</BulletedList>

<Heading id="aBlhDz8bL8UF6E3YUAbuCw" level="3">
  8.5 社团详情页（`community.html?id=`）
</Heading>

<Paragraph id="Iv3lAAAFR7vpqWWMHKl9Ei">
  文明六「百科（Civilopedia）」风格：
</Paragraph>

<BulletedList id="BE956mfXZEn1T2gmaqFZff">
  <Mark bold>页头</Mark>：Logo（没有时用首字徽章）、社团名、城市（包括其他城市）、成立年份。
</BulletedList>

<BulletedList id="xG2xrvIpIFQPIlJNZW1Wxr">
  <Mark bold>正文</Mark>：

  <BulletedList id="T5w8w9gLXfwLAYLv0ZNmKS">
    简介。
  </BulletedList>

  <BulletedList id="lXtLpJCyj7dRZm56tvkasX">
    活动地址。
  </BulletedList>

  <BulletedList id="BSu1vVSco2GeYhGIyQgDbM">
    规模：只有隐私配置允许公开并且有值时才显示。
  </BulletedList>

  <BulletedList id="iK3SiMOUVRuvI5Vi4XlXlf">
    照片墙：有照片时才显示，点击放大。
  </BulletedList>
</BulletedList>

<BulletedList id="WGG57HZyFQAKa88XYySICK">
  <Mark bold>加入方式卡片</Mark>：QQ 群、微信群、官网；负责人和联系方式要按隐私配置决定是否显示。每一项都带「复制」或「打开」按钮。
</BulletedList>

<BulletedList id="z2en9gtcSwymmmsKoJJgPB">
  <Mark bold>位置</Mark>：一张静态的小地图图片，由 Canvas 绘制，不加载 3D；点击后回到首页并定位到这个社团（`/#c=<id>`）。
</BulletedList>

<BulletedList id="GoOcViqZUXg5eLxHFp8WZw">
  <Mark bold>底部</Mark>：同城的其他社团、上一个和下一个社团（按列表顺序）。
</BulletedList>

<BulletedList id="Z8RkUzJsAA3op7u8r3Zyc9">
  <Mark bold>空字段</Mark>：所有空字段整块隐藏。只有简介缺失时，显示「简介待补充」，并链接到「加入我们」。
</BulletedList>

<BulletedList id="EuumK98mD7XsMgkPqGytpL">
  <Mark bold>页面信息</Mark>：动态设置 `<title>` 和 `og:*` 标签（对搜索引擎的完整支持放在第二阶段的服务端渲染中解决）。
</BulletedList>

<Heading id="cG5QaRiF6WGZqzWPQRceQn" level="3">
  8.6 关于页
</Heading>

<Paragraph id="ZzqlpHksuTbTjDKppbCQ5K">
  纯静态排版。内容从 `site.config.ts` 读取，或者直接写成 Markdown，在构建时转成 HTML：
</Paragraph>

<BulletedList id="wuV2PdJSuAOy5YjOBgEM9n">
  项目初衷
</BulletedList>

<BulletedList id="Xv5RoFDQNYmHdV8vcRdzny">
  数据的采集方式和更新频率
</BulletedList>

<BulletedList id="4Rfya7h7ldgMhfd4B3fjnu">
  维护者的联系方式
</BulletedList>

<BulletedList id="ywnuJY3BWkBNSbetIyByr7">
  致谢，以及使用的开源数据（ETOPO、Natural Earth）的署名
</BulletedList>

<Heading id="XzinD5NGy1Zo8xOc4yd7q0" level="3">
  8.7 加入我们页（第一阶段形态）
</Heading>

<BulletedList id="oqHelkYeoY6J6yIa5NaeAp">
  两张卡片：<Mark bold>「我的社团想入驻」和「我要更新社团资料」</Mark>。
</BulletedList>

<BulletedList id="A6MIpN4f86djh9dKDxLxaP">
  每张卡片包括：

  <BulletedList id="OuNDIzIrVMZeoXu2i7nXSw">
    需要准备的信息清单（和数据字段一一对应）。
  </BulletedList>

  <BulletedList id="r55z3WCMI9dZA7R3CumcFL">
    提交入口：<Mark bold>腾讯文档收集表的链接</Mark>（`site.config.ts` 中配置）。
  </BulletedList>

  <BulletedList id="RUSz6Dc7UWhtPq8W8DcShJ">
    联系方式和二维码。
  </BulletedList>
</BulletedList>

<BulletedList id="2uGw4qRu33hilwgrkataSw">
  页面结构按第二阶段的站内表单来预留：字段清单直接来自 `schema.ts`。第二阶段只需要把「跳转链接」换成表单组件。
</BulletedList>

<Divider id="OYsLrq35R7Oc44j8zzx06t" />

<Heading id="YFhNxYwhNlnjuy8wnnMpIp" level="2">
  9. 视觉与交互规范
</Heading>

<Heading id="9BvSD622pMJX33lR8HYGOo" level="3">
  9.1 Design Token（`src/styles/tokens.css`）
</Heading>

<Code id="WhSGbs1i2iwNREqLrxkE9Y" language="css">
  ```css
  :root {
    /* 界面（文明六风格） */
    --ui-navy-900: #0e2233;
    --ui-navy-700: #173349;
    --ui-navy-500: #1d4059;
    --ui-gold-500: #b8944c;
    --ui-gold-300: #f0d690;
    --ui-ink:      #efe3c4;   /* 深色面板上的正文，对 --ui-navy-900 的对比度约 13:1 */
    --ui-muted:    #a9b4b8;   /* 次要文字，对 --ui-navy-900 的对比度约 7.6:1 */

    /* 纸张（详情页、关于页等阅读页面） */
    --paper-100: #f6eedb;
    --paper-300: #e6d6b0;
    --paper-500: #d8c59b;
    --paper-ink: #2f2412;     /* 对 --paper-100 的对比度约 13:1 */

    /* 社团旗帜 */
    --banner-500: #b3302a;
    --banner-700: #8f231d;

    /* 语义 */
    --success: #3f8f4a;
    --danger:  #b3302a;
    --focus:   #ffffff;

    /* 字体 */
    --font-display: "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
    --font-body:    "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    --fs-12: .75rem; --fs-14: .875rem; --fs-16: 1rem; --fs-18: 1.125rem;
    --fs-24: 1.5rem; --fs-32: 2rem;   --fs-40: 2.5rem;

    /* 间距（以 4px 为基础） */
    --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
    --sp-6: 24px; --sp-8: 32px; --sp-12: 48px; --sp-16: 64px;

    /* 圆角、阴影、动效 */
    --radius-s: 3px; --radius-m: 6px; --radius-pill: 999px;
    --shadow-panel: 0 0 0 3px rgb(14 34 51 / .6), 0 10px 24px rgb(0 0 0 / .35);
    --dur-fast: 150ms; --dur-normal: 300ms; --ease: cubic-bezier(.2,.7,.2,1);
  }
  ```
</Code>

<BulletedList id="Swfw9jQuwXxtJMBetptNes">
  地图面板使用深海军蓝加金色描边；阅读类页面使用纸张色调。两类页面<Mark bold>共用同一套字体和间距 Token</Mark>。
</BulletedList>

<BulletedList id="n7tbrJttI3iulVl4ncL5SZ">
  字体：标题用衬线体，正文用无衬线体。中文字体做子集化后放在本地（只包含实际用到的字），或者直接使用系统字体，<Mark bold>不依赖 Google Fonts</Mark>。
</BulletedList>

<Heading id="dS7QLYgmJQd4VkyYMdjw7o" level="3">
  9.2 组件清单
</Heading>

<Paragraph id="fCpWQwtT0uYTa5ebjBgz01">
  `Button`（主要、次要、图标三种）、`Panel`、`Card`、`Tag`、`SearchInput`、`CopyField`（复制后提示「已复制」）、`Banner`（地图旗帜）、`Toast`、`Modal`、`Timeline`、`EmptyState`、`ErrorState`、`Skeleton`
</Paragraph>

<Paragraph id="jYC4NPtQFnLWMimczhwEZF">
  每个组件都要写明默认、悬停、按下、聚焦、禁用五种状态。
</Paragraph>

<Heading id="duypmUhj5lbXbsdkJc15Sf" level="3">
  9.3 无障碍（WCAG AA）
</Heading>

<BulletedList id="q5o1dqcYav6S6Tk4nbfKJh">
  文字对比度 ≥ 4.5:1，大号文字 ≥ 3:1。以上 Token 组合都已满足。
</BulletedList>

<BulletedList id="mPlklzNATnXxwy7tP6jvM8">
  所有交互元素都有可见的焦点框；触控区域 ≥ 44 × 44 px。
</BulletedList>

<BulletedList id="AlkfRxEAvhFH3UDnJrAnfy">
  <Mark bold>3D 地图不是唯一的信息入口</Mark>：地图上的每个社团都能在列表侧栏中通过键盘访问。地图画布设置 `aria-hidden`，附带文字说明「可以使用右侧列表浏览全部社团」。
</BulletedList>

<BulletedList id="FgDx6SrKSPTlyrgxcDBAab">
  遵守 `prefers-reduced-motion`：关闭相机飞行、建城动画、水面波纹。
</BulletedList>

<BulletedList id="LJxhmFhq2DaNrzp9nfTc6H">
  页面支持放大到 200% 时不出现内容丢失。
</BulletedList>

<Divider id="zmLKuaEZGJHzKGnl02UX0I" />

<Heading id="KAHJF3o65ltvDp1UlXEEVn" level="2">
  10. 性能预算
</Heading>

<Table id="xzpbBszNRN0hLDZr0CkoFf" readonly rowHeader>
  <TableRow id="nudGKn3qmJ9pAuC5AQribo">
    <TableCell id="JN8LaewhD1YW6ulfFixpEo">
      <Paragraph id="dfp639emiDlQ9LR9gLuBSi">
        指标
      </Paragraph>
    </TableCell>

    <TableCell id="aDIi3IudWfVhvaD3uUsv1F">
      <Paragraph id="nKGSxEGR7MFkvzvaRsWATG">
        目标
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="JEGlLZHsSdOPbaKBSE340M">
    <TableCell id="4qMyB8xR8fxmJ5jPqbSah4">
      <Paragraph id="Ns8JZyMNe9YBNDtSlDT5Gz">
        桌面首页 JS（gzip）
      </Paragraph>
    </TableCell>

    <TableCell id="D0gofxYAivGDFJ0HnaWghg">
      <Paragraph id="LfRwXOI3LbqWzNbAOdnWKD">
        地图模块 ≤ 250 KB，其中 three.js 约 150 KB；首屏其余代码 ≤ 40 KB
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="oTgVxWJlIryVNU2XSCJQmG">
    <TableCell id="jKdk0njCDEJi2J6miIPPdT">
      <Paragraph id="NV9OlULRKmeYBHr6IthAU5">
        手机首页 JS（gzip）
      </Paragraph>
    </TableCell>

    <TableCell id="VkqsAyb7x6QlgboU0rs4PV">
      <Paragraph id="5JS4RA9om2IeBEQsIHURws">
        ≤ 40 KB（不包含 three.js）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="fMjGYy4nWS62rzrlwt6cSz">
    <TableCell id="6j3klvhEoPguUASURnjf5V">
      <Paragraph id="zjpqukcwFq8drGHSSj9Gza">
        terrain.bin（gzip）
      </Paragraph>
    </TableCell>

    <TableCell id="y8orGcJ1nJAL5H9bJ1YScg">
      <Paragraph id="jX3qFQOg0SSqlJOJg14P3x">
        ≤ 40 KB
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="H8kD1bZkEqHuwc3XzWSw5A">
    <TableCell id="7URNcjTNH8nFoHXEgwksa0">
      <Paragraph id="Oo6OutgSONHD6lFliFFPGH">
        communities.json（gzip，100 个社团）
      </Paragraph>
    </TableCell>

    <TableCell id="oDdJ46bdtNcYbOs3ZcOUS0">
      <Paragraph id="OfOLY3B1tg43cMqI1PRwH0">
        ≤ 30 KB
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="aWmowf8SLhsLaGzJebhe39">
    <TableCell id="ZGm8PusXX40e1RvU056AJp">
      <Paragraph id="d1uwljjbffLRzX7WuKl8Tu">
        桌面首屏可交互
      </Paragraph>
    </TableCell>

    <TableCell id="mDxZvxAj0OvLxxY9GfYoD4">
      <Paragraph id="EVMUp6D3128ZCp3l2FDV3G">
        ≤ 3 秒（中端笔记本、有线网络）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Qk2RmMeyIVSRkDidTTBCPT">
    <TableCell id="ne6J9vWRcS7BWgFyaV27ci">
      <Paragraph id="ZmBT1L8Fbmvs7YoeNoLeZW">
        帧率
      </Paragraph>
    </TableCell>

    <TableCell id="gRhY0Qskxugwcs7uZiOLyK">
      <Paragraph id="XN7as69KjYJIYBf6ZrMAcv">
        medium 档 ≥ 55 fps（集成显卡笔记本，1080p）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="ItoIGmxTwr2WQQ7isqhlIZ">
    <TableCell id="Tr36wG15I91a2ciyuJNBWz">
      <Paragraph id="UsNeyCXkmrCHOakO34hKfD">
        绘制调用
      </Paragraph>
    </TableCell>

    <TableCell id="MpnNf79QfwCEX15qlRgeRv">
      <Paragraph id="oLx98j09GEsMuD07pMmzbN">
        视野内 ≤ 250 次
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="bqO6FL7t4S1QaObbI2LXDt">
    <TableCell id="QqU3FAkzFSCZvJy9EehthA">
      <Paragraph id="JKNYYvRWy5SgouaVlRnr3S">
        内存
      </Paragraph>
    </TableCell>

    <TableCell id="klFiKz42WC0jvNnHzvsPTt">
      <Paragraph id="9U4H6LQaaOV00paRBFTHwW">
        GPU 显存 ≤ 300 MB
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="OCQfrKF547oipIFLD1ABv4">
    <TableCell id="yUCwdnJ1eOEyimr3FQbw7A">
      <Paragraph id="yL54odY7L7mapHR3w0GNwX">
        手机首页 LCP
      </Paragraph>
    </TableCell>

    <TableCell id="TYnC9z63XjuAv3pQM7Z09U">
      <Paragraph id="o3mmN5Hdug6GhSdZSQg7CI">
        ≤ 2 秒（4G 网络）
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<BulletedList id="6RfhfYdWTfY0bpvBO1SUjF">
  用 `stats-gl` 和自己写的性能面板（按 `?debug` 开启）监控帧率和绘制调用次数。
</BulletedList>

<BulletedList id="pU4vUJLfh9ZYCXGwUQI814">
  超出包体积预算时 CI 报错（使用 `size-limit`）。
</BulletedList>

<Divider id="vMfSifVj1ik16hbxbKrXOw" />

<Heading id="shrBvq00XHF0VTugxGMSMS" level="2">
  11. 工程规范与测试
</Heading>

<Heading id="UDecBmQNBYsbuuSuXM8Gq2" level="3">
  11.1 代码规范
</Heading>

<BulletedList id="xTvnECSNgsaWXAtu7r3RU9">
  TypeScript `strict`，禁止使用 `any`（确实需要时必须写注释说明）。
</BulletedList>

<BulletedList id="E3YLl1qu9VNjDm6hhiwETq">
  把 `shared/`、`map/terrain/decorators/`、导入脚本的清洗函数写成<Mark bold>纯函数</Mark>，方便测试。
</BulletedList>

<BulletedList id="TQaizC95svlD13YybEhX0e">
  three.js 对象有明确的生命周期：每个模块都要实现 `dispose()`，分块卸载时释放几何体和材质。
</BulletedList>

<BulletedList id="QS3u9lavAe51zJj05u1LFe">
  <Mark bold>不硬编码</Mark>：颜色放在 Token 或 `palette.ts`；地貌参数放在 `zones.geojson` 的属性里；站点信息放在 `site.config.ts`。
</BulletedList>

<BulletedList id="sRVK2tMGyQ3Jc9UjWqYaiB">
  Git：`main` 分支永远可以部署；新功能在 `feat/*` 分支开发；提交信息使用 Conventional Commits 格式。
</BulletedList>

<Heading id="CDBHVGPawTqvN3epffvzsY" level="3">
  11.2 测试
</Heading>

<Table id="IHvXY9q22By0HFStTZDeyG" readonly rowHeader>
  <TableRow id="iStOo77jPHLxUTiTwqM6Bs">
    <TableCell id="gFw9C1y8vicHgobLAvlRKk">
      <Paragraph id="E2TnrDYB3iDOGjGpccVR2U">
        类型
      </Paragraph>
    </TableCell>

    <TableCell id="HJBtn5dJ2MqSXDbaQdi6fA">
      <Paragraph id="5sBmLeZXwuXdDi9HN8h3FT">
        覆盖内容
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="OhG7tPxvp7na7G4wZrefZG">
    <TableCell id="fTsa7IAcOqBRDYvxf4JlSk">
      <Paragraph id="TAuWLQqpt4CbxyLzx8Synt">
        单元测试（Vitest）
      </Paragraph>
    </TableCell>

    <TableCell id="nlJO0COKcPMRFBRszgRrue">
      <Paragraph id="MDv00VDu59fysDRqptoBAs">
        清洗规则（每条规则都有正反例）、表头映射、ID 生成和改名识别、落点螺旋算法、六边形坐标换算、时间轴状态机、差异计算
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="4c0sjpCqZTaGTffEWRdOT3">
    <TableCell id="zCau9TxUbRQ0OfZkgQQN6S">
      <Paragraph id="J3tiRTvlpuepSOz5hyp2dK">
        数据测试
      </Paragraph>
    </TableCell>

    <TableCell id="eViuyvSK9PNtpfP4Rs0kCM">
      <Paragraph id="zrN4qCb8CtLsDwfWFjPbEE">
        `pnpm data:check`：校验生成的 JSON；检查格子是否重复；检查 Logo 文件是否存在；检查隐私白名单外的字段有没有混进去
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="0UPLLogpyAybGHjK7aJ1JK">
    <TableCell id="4FgrsYyeuwe1o8b0wYWZAv">
      <Paragraph id="bBLz2134NkmhGYtShd4ubJ">
        烘焙测试
      </Paragraph>
    </TableCell>

    <TableCell id="fbHOfh1F7Z3LnYFYp7i4TO">
      <Paragraph id="Fn288oc6CcDZcwBhBcoNGV">
        固定输入 → 检查输出的哈希；抽查几个已知位置（上海是海岸平原、拉萨的高度级别 ≥ 8、成都在盆地中）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="SshrCoClXI6fusUXgsCBSe">
    <TableCell id="E7P4bzzPAP2UPMlNgx0CVK">
      <Paragraph id="X3lZ86movCRtNDLgnO13AM">
        端到端测试（Playwright）
      </Paragraph>
    </TableCell>

    <TableCell id="x28mNkP3S1Dq56bONiGROU">
      <Paragraph id="SNtxrpZMvVPYiacD3L7SJk">
        首页加载 → 搜索 → 点击社团 → 打开预览 → 进入详情页；时间轴播放、拖动、关闭；手机视口下显示列表；WebGL 不可用时的降级
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Ef4kaV3RACcOq7cMhNledu">
    <TableCell id="MUx2xu8dv5NnIvPeDf1OtN">
      <Paragraph id="8hWa3BfjqQcj1fabLP4cwc">
        截图对比
      </Paragraph>
    </TableCell>

    <TableCell id="YHLVKh0Kls3xivxxLTO8Hw">
      <Paragraph id="T7ydBnl1CvI7W0acuBBodX">
        首页固定机位、详情页、手机首页，差异超过阈值时提醒
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="yZX0rJoD8V7IFDPgDjJ382">
    <TableCell id="9wHB577qJeQwcYvFqw4y2S">
      <Paragraph id="1oDXusvBJZhFCessM5lZph">
        无障碍
      </Paragraph>
    </TableCell>

    <TableCell id="eXA7qqZLmREwwyk2q2enef">
      <Paragraph id="SihE1Y4nvFhriWE6z3VU8O">
        axe-core 自动检查所有页面
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Heading id="V2QO9YU88VdzaXa3ZVE2cO" level="3">
  11.3 CI（GitHub Actions 或者你使用的其他平台）
</Heading>

<Code id="Pdav8HNCbQwCeyOuMIC2Ev">
  ```
  lint → typecheck → unit → data:check → build → size-limit → e2e（包括截图对比）
  ```
</Code>

<Heading id="DF8lZsenLQBvsSbBWHjKo6" level="3">
  11.4 常用命令
</Heading>

<Table id="2wLK3xXivsWupQwR2f1olV" readonly rowHeader>
  <TableRow id="AE0nP7vA5kZLKqGYBzF3qo">
    <TableCell id="zt7qHReNvb7xj15wRr8Eu8">
      <Paragraph id="jpKyDnEzsqrrQKXp2pjFhe">
        命令
      </Paragraph>
    </TableCell>

    <TableCell id="a59Jv2Cvg4xzXhCjycWtsq">
      <Paragraph id="tPkgsZzwc9ejuT6ifABceS">
        作用
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="rbn4IKxZAAEXWxfQrWUFsx">
    <TableCell id="zj3fPZse44wektLZ8wWINF">
      <Paragraph id="SIDwy30aFQsUEaiikgG8w0">
        `pnpm dev`
      </Paragraph>
    </TableCell>

    <TableCell id="HntaJbNnf7kqPsAcM79Y21">
      <Paragraph id="JoXq67IM8InfsVPp1IOYu4">
        本地开发
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="Xk6AzwmWINiZ7Jkkjqy44H">
    <TableCell id="YmjL850IHLSo1RyRQRDzAs">
      <Paragraph id="D6ouigQllRFA9dbsQTxnKh">
        `pnpm data:import <xlsx>`
      </Paragraph>
    </TableCell>

    <TableCell id="hTmE9d5IbgQVIGt3N97wiG">
      <Paragraph id="XuQ85RcLfRdSkgUAYaeyD4">
        导入数据
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="bfuZpiAcTl6WeLgRDnlxft">
    <TableCell id="Myk4sNMFnD5MLXZpr1TyOG">
      <Paragraph id="O7rBQSthu5pHF8NW1ejLZE">
        `pnpm data:check`
      </Paragraph>
    </TableCell>

    <TableCell id="qvXnhZbCeBgI4kl92xlHvy">
      <Paragraph id="fxFCj8LUgatQhljiHufY6N">
        校验数据
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="O7LShvDnpyvw7qvUTDk2w2">
    <TableCell id="rrr3qtUjGpk4CiIF7AjShi">
      <Paragraph id="mq8EGT50RA4apicPZUm1Nh">
        `pnpm geo:fetch`
      </Paragraph>
    </TableCell>

    <TableCell id="9AXtT7ma3oUdoOkJfI2OHw">
      <Paragraph id="Vs3EaTjEAnF1fVC10yA0Yz">
        下载地理原始数据（只需要一次）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="iyyKQc8YExO3n6zkRyzRwH">
    <TableCell id="arlmLlrNE2TFiGPAd7hqHS">
      <Paragraph id="69tyM6bR3WCUuCWCP3fh91">
        `pnpm geo:bake`
      </Paragraph>
    </TableCell>

    <TableCell id="JDUQDFqiECjuKpXox9BgqQ">
      <Paragraph id="zFXfLLL1bpQqSWc4Gnzhwo">
        烘焙地形
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="b2PEkgqIIdF0xvNsoboXLB">
    <TableCell id="YFujl3BSKTHQTWjN4TOKyx">
      <Paragraph id="pXGBdqYcArtY0qYg6dVwT9">
        `pnpm build`
      </Paragraph>
    </TableCell>

    <TableCell id="51SHW6BX6ibP9rI0y6yhrr">
      <Paragraph id="o6XLKE7CagSOJM4kXTXnpI">
        构建，输出到 `dist/`
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="ltolLoQyTA4ffEuY0xfBJW">
    <TableCell id="dVFGlqT4TsLBHzNdkC5eQv">
      <Paragraph id="Z7T2g4Dc37OAjhLb9fU1co">
        `pnpm test` / `pnpm e2e`
      </Paragraph>
    </TableCell>

    <TableCell id="iAfOhrDNJK5mlDorMpt6VE">
      <Paragraph id="Kd4glrlfm5iD0w56nR6R7w">
        运行测试
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Divider id="rxhtseJpdD629ZetmVWQcn" />

<Heading id="WPvPYe9VaFgLc1obCeqRzv" level="2">
  12. 第二阶段预留（自建服务器）
</Heading>

<Paragraph id="RsQ7xr41vgCHf1REsqdGP1">
  第一阶段在这些地方为第二阶段留好了接口：
</Paragraph>

<Table id="YCxtfRXBbxa7x4lSCRLNVQ" readonly rowHeader>
  <TableRow id="0yx3KOgIJvPXx94YiVAZVK">
    <TableCell id="6kl3lRqzOvgszudO08ulQG">
      <Paragraph id="XEeP2a3ctgrW5d9SMhBnWC">
        预留点
      </Paragraph>
    </TableCell>

    <TableCell id="wYsJt9EQGVcCSk8OamKW4H">
      <Paragraph id="E256CYPzcnu3NhFInLImE4">
        第一阶段
      </Paragraph>
    </TableCell>

    <TableCell id="7W2g6PEGcUKIfdXUUlXst6">
      <Paragraph id="ODDnQy4NVppRfBbznI4lLB">
        第二阶段
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="4dWJJH5y4VGkIMY30VeCag">
    <TableCell id="2i4KLCSVGKZHzWVs7585AF">
      <Paragraph id="6QT5UenGd4m81V9S4lh3G0">
        `DataSource` 接口
      </Paragraph>
    </TableCell>

    <TableCell id="3xU46dzNS2rl6KPlb72dKd">
      <Paragraph id="V0sMF7YQvFSXTgP8pfSdLS">
        `StaticJsonSource`（轮询 version.json）
      </Paragraph>
    </TableCell>

    <TableCell id="gE6Fpdp5O0NembzrhuG4bk">
      <Paragraph id="29A4mpsYHAIDZqtBq1xhOB">
        `ApiSource`：用 `GET /api/communities` 获取数据，用 SSE 的 `/api/stream` 接收推送
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="8f6twA9mH2y6x6qBFl2xz0">
    <TableCell id="oasxNWn2ValP8r4XmlGrQN">
      <Paragraph id="btH4KoXMZjfXrZT2sHKLYI">
        `shared/schema.ts`
      </Paragraph>
    </TableCell>

    <TableCell id="NOHYAG8MFjyUPlWYF57Stb">
      <Paragraph id="iN5f7ReclNBCXkeynmRckF">
        前端和导入脚本使用
      </Paragraph>
    </TableCell>

    <TableCell id="JZBdSinSrltbWPp913ds01">
      <Paragraph id="u7J3DUu7y4PB9hB04dIll3">
        服务端直接引用，作为接口的校验和数据库表结构的依据
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="gQtRQ3TMwtAIKhJ9Q1J2oJ">
    <TableCell id="9AJg9z2OPwAjTiIuWXQCDv">
      <Paragraph id="1dU4TM7b1Yt9kVo491VlZ8">
        导入脚本的清洗和映射函数
      </Paragraph>
    </TableCell>

    <TableCell id="SrOlEAc8MJYxnjDFR2eDVV">
      <Paragraph id="TR6z2nQk5lENphofu35xhB">
        命令行运行
      </Paragraph>
    </TableCell>

    <TableCell id="i1RSRabgGrBNQLFAS1A24F">
      <Paragraph id="qnBNycnA2uzqswOHqqb3Ws">
        服务端的腾讯文档同步任务和 Excel 上传直接复用
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="XHYavoymKKWNwEcPZYD7CS">
    <TableCell id="v3pHIwH6KxXSENcVoBpH4c">
      <Paragraph id="XnB5uNWZNbjf2dbEPMdNSB">
        `registry.json` / `placements.json`
      </Paragraph>
    </TableCell>

    <TableCell id="0wVzPUJErbfv1Gy0sZuBDO">
      <Paragraph id="sS8WxCyWz9ZJWXi9KHmrJu">
        以 JSON 文件的形式提交到仓库
      </Paragraph>
    </TableCell>

    <TableCell id="bXmpkyUaJN4tqBwuL7IJZY">
      <Paragraph id="lFXZ9saCvu5L9uicnYpiKg">
        迁移为数据库表（写好一次性迁移脚本）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="i1KVcSwpAyLRrspjNfKfcE">
    <TableCell id="xoxF5md3CyJclDzqYftj6p">
      <Paragraph id="u0C0gqXU7etSAJVpY95RTM">
        隐私白名单
      </Paragraph>
    </TableCell>

    <TableCell id="PzryduuIb4B547G1YAE4Ja">
      <Paragraph id="accIF4Eg1vgqZ4rA2RKrju">
        构建时过滤
      </Paragraph>
    </TableCell>

    <TableCell id="2ohgZnBwZKzwJo0ITHH0nM">
      <Paragraph id="5F5J3rpvUW3jfoob5kv5AD">
        接口层过滤，外加后台开关
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="YZUAeEHX08toPWX7ET4lrd">
    <TableCell id="Ew5JMeo56uH8OjRPlOXATm">
      <Paragraph id="z2rYQIl7hv2yivRPkIKTNU">
        加入我们页
      </Paragraph>
    </TableCell>

    <TableCell id="z6Ta80Mxrpd5OtFLuA2Rqw">
      <Paragraph id="AuFzP5xzyBTKi7uQWWX1qV">
        跳转到收集表
      </Paragraph>
    </TableCell>

    <TableCell id="gFrcDX3TDszv1OgV8Eae1R">
      <Paragraph id="DM4FQVqYHMg5msQED7KyTU">
        站内表单，提交到 `POST /api/submissions`，进入待审核
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="DIpy9wqKRxKIP5xtHmt269">
    <TableCell id="TPp5wa1GzRTmCURpUogqVg">
      <Paragraph id="D28FZhY2nABEz6I67uxTfc">
        详情页的搜索引擎支持
      </Paragraph>
    </TableCell>

    <TableCell id="SjeI43jg13cGB6pQqyeh0P">
      <Paragraph id="XkSUkkcKcyIJ2vrNCphdG2">
        前端渲染
      </Paragraph>
    </TableCell>

    <TableCell id="7CZCWmX8WbyAWAaEPleWZI">
      <Paragraph id="Sy5kSFIe3EMocEydUjkQUR">
        服务端渲染或预渲染
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="IaMi3yeHXGeqChp5jnlBCk">
  第二阶段需要另写一份文档，覆盖：
</Paragraph>

<BulletedList id="cWpItO8D15Y1yJXjgXmZPA">
  服务端架构：Fastify + SQLite/PostgreSQL
</BulletedList>

<BulletedList id="n6Ice43hZwhUCBpUw4Pqij">
  管理后台
</BulletedList>

<BulletedList id="2HtEG3PknSHF6qiM1wsqJh">
  腾讯文档开放平台同步
</BulletedList>

<BulletedList id="f1riP8b1x5b1y3gea4QrGi">
  防刷和审核
</BulletedList>

<BulletedList id="FKb0KRl9mrnZKeQAODFhlT">
  Docker 部署
</BulletedList>

<BulletedList id="1MyHyCvYzu0jNamaRk1Eub">
  备份
</BulletedList>

<Divider id="yphmpdQAnSngwlU5Yfqpcf" />

<Heading id="qqfHXxp17Awn2rzosjFAWZ" level="2">
  13. 里程碑与验收标准
</Heading>

<Table id="LiE5DtWxvIhFg2AoGT7Gqe" readonly rowHeader>
  <TableRow id="2YAdYzhGqarhd8rXwlrLHC">
    <TableCell id="7YyTndCUZJnfiHW08goRgM">
      <Paragraph id="6MpypPocF5or7JEmxAhfVg">
        里程碑
      </Paragraph>
    </TableCell>

    <TableCell id="0oBFJA878XpxQixEB1eXKU">
      <Paragraph id="THjEr3kDykKQu3D4eIfL6Y">
        内容
      </Paragraph>
    </TableCell>

    <TableCell id="uUTwsGJobiXGIqKdJFytbu">
      <Paragraph id="ycD0GoASMFKswoROr91tvC">
        验收标准
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="LR5cYpDIGmPnR6DMmieAlL">
    <TableCell id="sonoFcstqoAjrC6op8whNO">
      <Paragraph id="npzHZhv1s1My9tXDlQEgkj">
        <Mark bold>M0 工程骨架</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="mBcGUwiSfOa14STTKIzZaT">
      <Paragraph id="VkCUb5tMqLDRofTYPYKttu">
        仓库、构建、CI、Token、4 个页面空壳、公共导航
      </Paragraph>
    </TableCell>

    <TableCell id="vUOQRJx0NUDUPF2YYeW3cG">
      <Paragraph id="uvj8DfHJpz2jdVAz0GkIiB">
        `pnpm dev`、`pnpm build` 可以运行；CI 通过；4 个页面都能访问
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="n7xIlbyTTOQWpm0RgyyLsg">
    <TableCell id="AI00BKRgcN3m8RxUHLbNi3">
      <Paragraph id="q7imqr5JbKRH1IOel72ud6">
        <Mark bold>M1 高精度样片</Mark> ⭐
      </Paragraph>
    </TableCell>

    <TableCell id="2SQOFlVOn9RuVtbGNOPddE">
      <Paragraph id="62OEQgyPCjZGHGCnBtyFp9">
        地形烘焙流程跑通；<Mark bold>只渲染局部区域</Mark>（长三角 + 四川盆地），包括高度台阶、地貌、河流、水面
      </Paragraph>
    </TableCell>

    <TableCell id="DyxDy0AlW1UnSgLgrevZjl">
      <Paragraph id="H2qDYZZ26cv9PdQzxtdhkH">
        截图交给你确认<Mark bold>精度和风格</Mark>，确认后才进入 M3
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="zMDjcdqVtJPQYpugId4Gb6">
    <TableCell id="D9VD00Avqr3fpEwWAEn4zT">
      <Paragraph id="6EfKdmR3hhocREZQBXzZIn">
        <Mark bold>M2 数据管线</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="xV1dz64xNImQTUdsoVpBZ4">
      <Paragraph id="G9up09suCamceYE9IxLYQs">
        导入、清洗、ID、落点、隐私过滤、图片处理、报告
      </Paragraph>
    </TableCell>

    <TableCell id="qH2GPQx0wZJ3YOAQYX2EnN">
      <Paragraph id="KReuY65hjCzRtAScudQ5vy">
        用你现有的真实 xlsx 导入成功；报告内容正确；单元测试覆盖率 ≥ 90%（清洗模块）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="hhCS7SttYxjwUDvzyZtqla">
    <TableCell id="3cNPJaQDHNnSaIbTCbxDRl">
      <Paragraph id="NYGQqwoD9kqGJ8KEqEDFI1">
        <Mark bold>M3 全国地形</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="sUQIM5oCfPdi2OtujDsYfV">
      <Paragraph id="jltrGijUni4635VAM8YMce">
        全图烘焙、分块加载、细节级别、画质档位、南海示意、周边淡出
      </Paragraph>
    </TableCell>

    <TableCell id="1ue4gtoNLJf8Q1YXPPoJfx">
      <Paragraph id="Mg1RoH2SofYRJbTm5qYBsa">
        全图截图确认；medium 档帧率达标
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="evGe7h7XoVNiuuJ88xznh4">
    <TableCell id="GvXSAiG2tRGiRf9aiwQtXq">
      <Paragraph id="HLazM3DL6LH5XCHL2hRQSy">
        <Mark bold>M4 首页交互</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="NKFMZgBGAMXPdyyOuosMTG">
      <Paragraph id="YG3cONlBsCiU9IFYk72qjW">
        据点、旗帜、悬停、选中、预览面板、列表侧栏、搜索筛选、小地图、`#c=` 分享链接
      </Paragraph>
    </TableCell>

    <TableCell id="mbUnyCpAy2p78ZTXwpMdRi">
      <Paragraph id="k9LFm1j3n17OyleSl9BOib">
        端到端主流程通过；键盘可以完成所有操作
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="F3VGRHKWQOmnYQAKZurMcC">
    <TableCell id="gWLE9OwRIPdZlyRqJ0JRog">
      <Paragraph id="4Stuhm2rIDJ4lGDVWWp9fx">
        <Mark bold>M5 时间轴</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="V6Qq7fwk1bFOqAFGL2ilWW">
      <Paragraph id="Spuzv5Htwtgy5RlAzmVNg2">
        年份条、播放、拖动、「待考」、减少动画模式
      </Paragraph>
    </TableCell>

    <TableCell id="61okwIQuZhBgoCOMGFn0wJ">
      <Paragraph id="pxPRiroLidboND2J6nxSs6">
        演示录屏；状态机单元测试通过
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="1In6gLb7wNvQS56ChFpv6p">
    <TableCell id="Qb8JCoZBVFl7bAibkHvwqz">
      <Paragraph id="vj74psgqUVFfLIPswqmSce">
        <Mark bold>M6 其他页面</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="CPPn1Gyreh5PRza1UHXmI2">
      <Paragraph id="cKglaS1mTRGGVjrMKuYRwX">
        详情页、关于页、加入我们页
      </Paragraph>
    </TableCell>

    <TableCell id="XNGfzz6ZKBziDdGFCdoOUF">
      <Paragraph id="ayuuhZAtCqg56fe3OR2shn">
        空字段处理正确；复制功能可用；无障碍自动检查无严重问题
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="mKc0x0jIqJovnOYMo3qmIc">
    <TableCell id="aygztXtQ32Ep7zDkBoWFOb">
      <Paragraph id="oKV6WP6upsW7jRFdvXmBn4">
        <Mark bold>M7 手机端与降级</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="rS18fmAPtJpf15KW3aNtmG">
      <Paragraph id="b74xnx6YrQB9dRswiHLkyM">
        手机列表视图、按年份的时间线、WebGL 降级
      </Paragraph>
    </TableCell>

    <TableCell id="OzHYfA9iZO8z7hfBDfHrSX">
      <Paragraph id="aMdJwQF2itPeqfGdCSc1be">
        手机不加载 three.js（从网络请求记录中确认）；手机 LCP 达标
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="wUngPXaNrEOzlx2hBJO4Qd">
    <TableCell id="0GYiXIVLLn0jk95sCR8h74">
      <Paragraph id="3ye7qAf5DPlkqImd0uUqHf">
        <Mark bold>M8 验收</Mark>
      </Paragraph>
    </TableCell>

    <TableCell id="Ad6O8YbARusr7aQrRKBzWU">
      <Paragraph id="moQeDpxB5EfDeuZfCal89q">
        性能调优、截图对比基线、运营手册、部署说明
      </Paragraph>
    </TableCell>

    <TableCell id="M8fwpELJrJ3Hh2fRTj6zyX">
      <Paragraph id="VyK514uNFfmrxOjpD3mgIH">
        性能预算全部达标；`DATA-UPDATE.md` 由非开发人员照着操作一遍能成功
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Divider id="ZmcN9i5HUx6do6hHhRTbqR" />

<Heading id="npkClz1So274tdcbxEo9NY" level="2">
  14. 风险与待决事项
</Heading>

<Table id="sbGzQtAgR1MjMuzIkLbjIg" readonly rowHeader>
  <TableRow id="fMbWeXAd2tsWDVhFqHCBNH">
    <TableCell id="v2YG0ZO3UB9cJGwJqK3QnH">
      <Paragraph id="4O1P017eEkzY4cpfSeQLG3">
        #
      </Paragraph>
    </TableCell>

    <TableCell id="n1cZO2PKYBa7HIb69nHx3V">
      <Paragraph id="5PgHSg6qEN10EqpmeHtO8A">
        事项
      </Paragraph>
    </TableCell>

    <TableCell id="gIN4P6VM9Tc2Ji7qXgaHA6">
      <Paragraph id="Apy52WmzY85L0g0OCHAcOj">
        影响
      </Paragraph>
    </TableCell>

    <TableCell id="jh3M2WInJ66MAQYMKLBk6a">
      <Paragraph id="rXFee1MKtYj92LrwDu8hgd">
        应对
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="TgTvgIoFHTpKiZpjNeA1FD">
    <TableCell id="EnfPN9XyNhiQ0Yldscjq4C">
      <Paragraph id="cwdKE2lLJOmjjXuO9jZbKD">
        R1
      </Paragraph>
    </TableCell>

    <TableCell id="7yX34vIwgOAnI1IfRlBkZF">
      <Paragraph id="kY0dG4wtnVsNQDThsBI6ig">
        在中国大陆公开发布涉及国家轮廓的地图，可能受《地图管理条例》约束（审图号）
      </Paragraph>
    </TableCell>

    <TableCell id="Hu8zlnPrqqxdu4Zj1g4oEj">
      <Paragraph id="m7dyOqsWte9bxFaILAhMMW">
        上线合规
      </Paragraph>
    </TableCell>

    <TableCell id="nkULdPOpX0jMoBxpafGtpH">
      <Paragraph id="sAz75lTpo4q4V3Kb4aUQrL">
        采用风格化处理：不画国界线，陆地边界淡入云雾，南海用示意岛群。<Mark bold>是否需要审图，建议上线前咨询当地测绘主管部门</Mark>，技术方案无法替代合规判断
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="YTIzl9VhICXOzQofxjCIdA">
    <TableCell id="rIlEtRo2NkQ5DyB9PCUHXH">
      <Paragraph id="frh8bzMqRi5XHtWZboE1El">
        R2
      </Paragraph>
    </TableCell>

    <TableCell id="Dl4d9QbcMsq3iMKXM1Dmss">
      <Paragraph id="DAUmOmGBbwPhyzu7J0d678">
        腾讯文档导出的 xlsx 中，内嵌图片可能读取不了
      </Paragraph>
    </TableCell>

    <TableCell id="2bJtEabVs3RDXWRj9usyal">
      <Paragraph id="QZc2OkoCbMFncAAdN8nMjf">
        Logo 导入
      </Paragraph>
    </TableCell>

    <TableCell id="Mk8HKJDhaM3nC9ppWNzNxD">
      <Paragraph id="0eER9y6zVsIBMUbxd4DRO3">
        按 5.7 的两种兜底方式处理，在 M2 用真实文件验证
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="xanoxlvVU0bV9oQm6h9c1T">
    <TableCell id="AhqC7ehhpabFouhDguvG1Z">
      <Paragraph id="e5Ik7WA7OFZM1vJtfTsJzC">
        R3
      </Paragraph>
    </TableCell>

    <TableCell id="q6YD3u5U483K2z7VGjXzfe">
      <Paragraph id="UjfE9lXDD79MfVBznwNhwx">
        负责人的个人联系方式能否公开
      </Paragraph>
    </TableCell>

    <TableCell id="Da0q0bTINAMVDedzeFHLTt">
      <Paragraph id="vuky2soQmdewT8eD3LD6G4">
        隐私合规
      </Paragraph>
    </TableCell>

    <TableCell id="YfU7mFbnVaYiQFpaMYe8pT">
      <Paragraph id="ewn002qhzZfLpE7iAL0bq2">
        默认不公开，由你确认策略（5.5）
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="L9PkfqW5Rjj8QCnoQK0gTO">
    <TableCell id="3Yn0HKMROcpviOFgX5xiNE">
      <Paragraph id="pMwXMpsIuNt7kT4fg4TNG3">
        R4
      </Paragraph>
    </TableCell>

    <TableCell id="k4kY5yNpMJVEw97DNKjXei">
      <Paragraph id="LsZn4gMdBwlMwPiexQbR2n">
        14,000 格在低端集成显卡上可能卡顿
      </Paragraph>
    </TableCell>

    <TableCell id="H4PKJtU4tMOzczKlwq7NRi">
      <Paragraph id="I36RF0K4Tf2djU9IfkQiAr">
        体验
      </Paragraph>
    </TableCell>

    <TableCell id="h1uwxijw3L4LADLjESdj2c">
      <Paragraph id="bZ4OHZRU11eNBLUCIjAjP3">
        分块加载、细节级别、自动降低画质；M3 做实机测试
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="VxNMtMjPsjoJYcurroux14">
    <TableCell id="I87fieCOR59IzHY0LyaSqa">
      <Paragraph id="VYBEboIJpOzyXnv4S6lWrN">
        R5
      </Paragraph>
    </TableCell>

    <TableCell id="q0lppskCIEWxBrMktHLWFt">
      <Paragraph id="awq6NP98HHlOCRzdDh1v8o">
        社团只填了省份或填了不规范的城市名
      </Paragraph>
    </TableCell>

    <TableCell id="kNBRT43PpogUqtelVngznn">
      <Paragraph id="lcM5wyjH8nQHz2B0rIibwF">
        落点
      </Paragraph>
    </TableCell>

    <TableCell id="2NcGk0hgzMlGJbC8VAJ6KP">
      <Paragraph id="pXicgFHxB44DL5lMtgSMvA">
        城市别名表加上 overrides 人工修正，导入报告里提醒
      </Paragraph>
    </TableCell>
  </TableRow>

  <TableRow id="NnoF3JAtTfhvMUcHUh6sLN">
    <TableCell id="DFsTxoyBp03E9PnlsPpCnD">
      <Paragraph id="fRpHgVTW0kmQnxHRMriFFx">
        R6
      </Paragraph>
    </TableCell>

    <TableCell id="QK7XsjcvuUlfgoB8HpsGB0">
      <Paragraph id="0I1OP6OdwEmlwIUvzStFF9">
        社团改名导致 ID 断裂
      </Paragraph>
    </TableCell>

    <TableCell id="NctccKHrjDn7TTRUtLQcMN">
      <Paragraph id="avTu2Vq09qRmBZItRIG1ln">
        链接失效
      </Paragraph>
    </TableCell>

    <TableCell id="ie6hvJHDRVliF2H65G0AIV">
      <Paragraph id="QvNlUnhZw5cVd5vokjX8PI">
        registry 别名机制，建议在腾讯文档里加一列 ID
      </Paragraph>
    </TableCell>
  </TableRow>
</Table>

<Paragraph id="DhAJeXCj9MGaLA8cuZ4Iba">
  <Mark bold>需要你确认的事项</Mark>
</Paragraph>

<NumberedList id="6m0Tq9nDUVfcW9vpt9gsJL">
  地图文案中的站点名称（目前暂定「中国独立游戏社团地图」）。
</NumberedList>

<NumberedList id="VBJI04x81pMiq7fXt5zWg4">
  隐私策略：负责人的个人联系方式、社团规模是否默认不公开。
</NumberedList>

<NumberedList id="Ax1voJc0eJVQYppGH8AgMW">
  「加入我们」第一阶段使用的收集表链接和联系方式。
</NumberedList>

<NumberedList id="cbU5hCeW4pOsDHPTTFfFnk">
  第一阶段的静态文件部署到哪里（可以先放在你的服务器上用 Nginx 托管，第二阶段在同一台机器上扩展）。
</NumberedList>

<Divider id="o59VHQSFdLe3UG9Tk5kFZ6" />

<Paragraph id="Gv4EIOqfRhrVGByKvS72P1">
  <Mark italic>文档结束。确认后从 M0 + M1（高精度样片）开始开发。</Mark>
</Paragraph>
KS_DOC_REVIEWS	TNvjgVbfHNes57zfdpt1SW	124725	https://www.workbuddy.cn/space/d/TNvjgVbfHNes57zfdpt1SW
