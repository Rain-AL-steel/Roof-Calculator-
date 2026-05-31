# PostgreSQL / Prisma 数据库模型设计

本文档基于当前 `localStorage` 数据结构，为后续后端化提供 PostgreSQL + Prisma 的数据库模型草案。当前提交只新增模型设计，不修改前端、不引入后端服务。

## 文件

- Prisma schema: `prisma/schema.prisma`
- 数据库: PostgreSQL
- ORM: Prisma Client
- 连接变量: `DATABASE_URL`

## 表用途说明

| 表 | 用途 |
|---|---|
| `users` | 后端用户账号表，替代当前 `erp_auth_v1` 的单机密码记录。 |
| `roles` | 角色字典，例如 `admin`、`operator`、`viewer`。 |
| `user_roles` | 用户和角色的多对多关联。 |
| `orders` | 订单主表，保存订单号、客户、日期、地址、金额汇总、面积汇总、建成年月。 |
| `order_main_rows` | 主瓦明细，对应当前 `items.mainRows`。 |
| `order_line_items` | 配件、钢铁、其他瓦明细，对应当前 `items.accessories`、`items.steels`、`items.otherTiles`。 |
| `products` | 产品目录，保存配件、钢铁材料、其他瓦/特殊瓦。 |
| `product_options` | 可选项配置，保存单位、颜色、节长、方管规格、厚度、螺丝规格。 |
| `system_configs` | 系统配置，保存公司信息、报表模板、地图设置、备份元信息等。 |
| `map_location_caches` | 地图定位缓存，按地址和城市缓存高德解析结果。 |
| `audit_logs` | 操作日志，记录创建、修改、删除、导入、导出、登录等行为。 |

## 关键设计说明

- 所有表都有 `id`、`createdAt`、`updatedAt`。
- `orders.orderNo` 为唯一字段，由后端服务生成；数据库负责唯一约束，具体编号规则留给业务确认。
- 订单金额使用 `Decimal(14, 2)`，面积、数量、长度使用 `Decimal(14, 4)`。
- 订单明细保留 `nameSnapshot`、`unitSnapshot`，即使产品目录后来改名，历史订单打印仍保持原始名称和单位。
- 地图坐标不直接塞进订单主表，而是通过 `orders.mapLocationCacheId` 关联 `map_location_caches`，便于同一地址复用定位结果。
- 高德 Key 和安全密钥可暂存在 `system_configs`，但生产环境建议加密保存或放服务器环境变量。
- 默认 Logo 如果继续使用 base64 Data URL，可暂存在 `system_configs`；后端化后建议迁移为文件路径或对象存储地址。

## localStorage 到数据库映射关系

| localStorage key | 当前数据 | 数据库映射 |
|---|---|---|
| `erp_auth_v1` | 单个本机密码哈希记录 | 迁移为 `users` 中的初始管理员账号。 |
| `erp_orders_v1` | 订单数组 | `orders`、`order_main_rows`、`order_line_items`、`map_location_caches`。 |
| `erp_backup_meta_v1` | `lastSavedAt`、`lastExportedAt`、`lastImportedAt` | 可存入 `system_configs`；导入导出动作写入 `audit_logs`。 |
| `resinTileOrderTool.config.v1.basics` | 宽度、节长、颜色、公司名、电话、Logo | 基础配置进 `system_configs`；节长、颜色进 `product_options`。 |
| `resinTileOrderTool.config.v1.mapSettings` | 高德 Key、安全密钥、城市、样式 | `system_configs`，其中 Key/密钥建议加密或改用环境变量。 |
| `resinTileOrderTool.config.v1.unitOptions` | 单位列表 | `product_options`，`group = UNIT`。 |
| `resinTileOrderTool.config.v1.accessories` | 配件目录 | `products`，`category = ACCESSORY`。 |
| `resinTileOrderTool.config.v1.steel.materials` | 钢铁材料目录 | `products`，`category = STEEL`。 |
| `resinTileOrderTool.config.v1.steel.tubeSpecs` | 方管规格 | `product_options`，`group = TUBE_SPEC`。 |
| `resinTileOrderTool.config.v1.steel.thicknessOptions` | 厚度 | `product_options`，`group = THICKNESS`。 |
| `resinTileOrderTool.config.v1.steel.boltSpecs` | 螺丝规格 | `product_options`，`group = BOLT_SPEC`。 |
| `resinTileOrderTool.config.v1.otherTiles` | 其他瓦目录 | `products`，`category = OTHER_TILE`。 |
| `resinTileOrderTool.config.v1.reportTemplate` | 打印标题、提示、签字栏等 | `system_configs`。 |

## 暂时无法确定，需要确认

- 订单编号规则：继续 `ORD-YYYYMMDD-HHmmss`，还是改成每日流水号。
- 用户角色：是否只需要管理员、操作员、查看员。
- 订单状态：当前没有状态字段，是否需要增加已保存、已作废、已完成、已发货等状态。
- 客户资料：当前只有 `customerName` 文本，是否需要独立客户表。
- 高德 Key 保存方式：数据库加密、服务器环境变量，还是二者结合。
- Logo 存储方式：继续 base64、服务器文件目录，还是对象存储。
- 操作日志保留周期：永久保存，还是按月份/年份归档。
