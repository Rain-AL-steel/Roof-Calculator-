/**
 * @typedef {Object} ConfigOption
 * @property {string} id
 * @property {string|number} value
 * @property {number} sort
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} CatalogItem
 * @property {string} id
 * @property {string} name
 * @property {string} defaultUnit
 * @property {number|null} defaultPrice
 * @property {number} sort
 * @property {boolean} enabled
 */

/**
 * @typedef {CatalogItem & {common:boolean}} AccessoryItem
 */

/**
 * @typedef {CatalogItem & {spec:string}} SteelMaterialItem
 */

/**
 * @typedef {Object} AppConfig
 * @property {number} version
 * @property {Object} basics
 * @property {number} basics.fixedWidth
 * @property {ConfigOption[]} basics.segmentLengths
 * @property {number} basics.defaultSegmentLength
 * @property {number|null} basics.mainTileDefaultPrice
 * @property {ConfigOption[]} basics.colorOptions
 * @property {string} basics.companyName
 * @property {string} basics.address
 * @property {string} basics.phone
 * @property {string} basics.defaultLogo
 * @property {ConfigOption[]} unitOptions
 * @property {AccessoryItem[]} accessories
 * @property {Object} steel
 * @property {string} steel.tubeMaterialName
 * @property {string} steel.tubeDefaultUnit
 * @property {string} steel.boltMaterialName
 * @property {string} steel.boltDefaultUnit
 * @property {SteelMaterialItem[]} steel.materials
 * @property {ConfigOption[]} steel.tubeSpecs
 * @property {ConfigOption[]} steel.thicknessOptions
 * @property {ConfigOption[]} steel.boltSpecs
 * @property {CatalogItem[]} otherTiles
 * @property {Object} reportTemplate
 */

export {};
