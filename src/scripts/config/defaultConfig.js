export const CONFIG_VERSION = 1;
export const CONFIG_STORAGE_KEY = "resinTileOrderTool.config.v1";

function option(id, value, sort) {
  return { id: id, value: value, sort: sort, enabled: true };
}

function catalog(id, name, unit, sort, extra) {
  return Object.assign({
    id: id,
    name: name,
    defaultUnit: unit,
    defaultPrice: null,
    sort: sort,
    enabled: true
  }, extra || {});
}

export const defaultConfig = {
  version: CONFIG_VERSION,
  basics: {
    fixedWidth: 1.05,
    segmentLengths: [
      option("segment-218", 0.218, 10),
      option("segment-219", 0.219, 20)
    ],
    defaultSegmentLength: 0.219,
    deliveryMethods: [
      option("delivery-self-pickup", "自提", 10),
      option("delivery-included", "包配送", 20),
      option("delivery-tricycle", "三轮车配送", 30),
      option("delivery-huolala", "货拉拉配送", 40)
    ],
    galvanizingProcesses: [
      option("galvanizing-double", "双镀锌", 10),
      option("galvanizing-single", "单镀锌", 20)
    ],
    mainTileDefaultPrice: null,
    colorOptions: [
      option("color-zaohong", "枣红色", 10),
      option("color-zhuanhong", "砖红色", 20),
      option("color-gray", "灰色", 30)
    ],
    companyName: "红波树脂瓦",
    address: "惠安县台商投资区洛阳大道509号红波树脂瓦（邮政局对面）",
    phone: "0595-27555859 / 15060629003",
    defaultLogo: ""
  },
  mapSettings: {
    enabled: false,
    amapKey: "",
    securityJsCode: "",
    geocodeCity: "泉州市",
    mapStyle: "amap://styles/whitesmoke"
  },
  unitOptions: [
    option("unit-piece", "片", 10),
    option("unit-meter", "米", 20),
    option("unit-set", "套", 30),
    option("unit-strip", "条", 40),
    option("unit-board", "板", 50),
    option("unit-block", "块", 60),
    option("unit-pack", "包", 70),
    option("unit-box", "盒", 80),
    option("unit-stick", "支", 90),
    option("unit-item", "件", 100),
    option("unit-one", "个", 110),
    option("unit-square", "平方", 120),
    option("unit-roll", "卷", 130)
  ],
  accessories: [
    catalog("acc-zhengjiwa", "正脊瓦", "件", 10, { common: true }),
    catalog("acc-zhongjiwa", "中脊瓦", "件", 20, { common: true }),
    catalog("acc-xiejiwa", "斜脊瓦", "件", 30, { common: true }),
    catalog("acc-santongwa", "三通瓦", "件", 40, { common: true }),
    catalog("acc-sitongwa", "四通瓦", "件", 50, { common: true }),
    catalog("acc-zhengjidutou", "正脊堵头", "件", 60, { common: true }),
    catalog("acc-zhongjidutou", "中脊堵头", "件", 70, { common: true }),
    catalog("acc-xiejidutou", "斜脊堵头", "件", 80, { common: true }),
    catalog("acc-dishuiyan", "滴水檐", "件", 90, { common: true }),
    catalog("acc-fengyanban", "封檐板", "件", 100, { common: true }),
    catalog("acc-shanqiangfanshui", "山墙泛水", "件", 110, { common: true }),
    catalog("acc-liqiangfanshui", "立墙泛水板", "件", 120, { common: true }),
    catalog("acc-daoliuban", "导流板", "件", 130, { common: true }),
    catalog("acc-fangshuidai", "防水带", "件", 140, { common: true }),
    catalog("acc-maandian", "马鞍垫", "件", 150, { common: true }),
    catalog("acc-duxinzheban", "镀锌折板", "件", 160, { common: true }),
    catalog("acc-fangshuipeijian", "防水配件", "套", 170, { common: true }),
    catalog("acc-zigongluosi", "树脂瓦专用自攻螺丝", "件", 180, { common: true }),
    catalog("acc-qiaojiao", "翘角", "件", 190, { common: true }),
    catalog("acc-feiyan", "飞檐", "件", 200, { common: true }),
    catalog("acc-zuocefengbian", "左侧封边瓦", "件", 210, { common: true }),
    catalog("acc-youcefengbian", "右侧封边瓦", "件", 220, { common: true }),
    catalog("acc-gaodikuafanshui", "高低跨泛水瓦", "件", 230, { common: true }),
    catalog("acc-diban", "底板", "块", 240, { common: true }),
    catalog("acc-baoding", "宝顶", "件", 250, { common: false }),
    catalog("acc-huluding", "葫芦顶", "件", 260, { common: false }),
    catalog("acc-zhengwen", "正吻", "件", 270, { common: false }),
    catalog("acc-shoutou", "兽头", "件", 280, { common: false }),
    catalog("acc-shuanglong", "双龙戏珠", "件", 290, { common: false }),
    catalog("acc-tiangouwa", "天沟瓦", "件", 300, { common: false }),
    catalog("acc-yangjiaowa", "阳角瓦", "件", 310, { common: false }),
    catalog("acc-yinjiaowa", "阴角瓦", "件", 320, { common: false })
  ],
  steel: {
    tubeMaterialName: "镀锌方管",
    tubeDefaultUnit: "支",
    boltMaterialName: "膨胀螺丝",
    boltDefaultUnit: "盒",
    materials: [
      catalog("steel-lintiao", "镀锌檩条", "条", 10, { spec: "" }),
      catalog("steel-jiaoma", "角码", "个", 20, { spec: "" }),
      catalog("steel-lianjietieban", "连接铁板", "件", 30, { spec: "" }),
      catalog("steel-fangshuiyaban", "镀锌防水压板", "件", 40, { spec: "" }),
      catalog("steel-hantiao", "焊条", "包", 50, { spec: "" }),
      catalog("steel-gangguan", "镀锌钢管", "支", 60, { spec: "" }),
      catalog("steel-diban", "底板", "块", 70, { spec: "" })
    ],
    tubeSpecs: [
      option("tube-100-100", "100×100", 10),
      option("tube-80-80", "80×80", 20),
      option("tube-60-120", "60×120", 30),
      option("tube-50-100", "50×100", 40),
      option("tube-40-80", "40×80", 50),
      option("tube-40-60", "40×60", 60),
      option("tube-30-30", "30×30", 70)
    ],
    thicknessOptions: [
      option("thick-15", "1.5", 10),
      option("thick-16", "1.6", 20),
      option("thick-17", "1.7", 30),
      option("thick-18", "1.8", 40),
      option("thick-20", "2.0", 50),
      option("thick-22", "2.2", 60),
      option("thick-25", "2.5", 70)
    ],
    boltSpecs: [
      option("bolt-12-80", "12×80", 10),
      option("bolt-10-80", "10×80", 20)
    ]
  },
  otherTiles: [
    catalog("other-touming", "透明瓦", "片", 10),
    catalog("other-pc", "PC瓦", "片", 20),
    catalog("other-caiguang", "采光瓦", "片", 30),
    catalog("other-frp", "FRP瓦", "片", 40)
  ],
  reportTemplate: {
    mainTitle: "树脂瓦结算明细单",
    accessoryTitle: "配件出货清单",
    steelTitle: "钢铁材料出货清单",
    roofMaterialTitle: "屋面材料出货清单",
    otherTileTitle: "其他瓦出货清单",
    warmTip: "请您在收货时当场核对清点；如有异议请立即提出，签字离场后视为验收合格。",
    addressLabel: "地址",
    phoneLabel: "电话",
    signatureLabel: "客户/代理人签字：________________________",
    receiptDateLabel: "收货日期：202_____年____月____日",
    steelProcessText: "镀锌工艺：双镀锌"
  }
};
