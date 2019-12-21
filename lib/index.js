const packageJson = require('../package.json')

const {getDevices} = require('./dyson-link')
const {isRobot, createRobot} = require('./robot')

// Lazy-initialized.
let homebridgeApi, Service, Characteristic

// Called by homebridge.
module.exports = (homebridge) => {
  homebridgeApi = homebridge
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic

  // Register the accessory.
  homebridge.registerAccessory(packageJson.name, "DysonRobot", DysonRobot)
}

class DysonRobot {
  constructor(log, config, api) {
    this.log = log

    this._infoService = new Service.AccessoryInformation
    this._infoService
        .setCharacteristic(Characteristic.Manufacturer, "Dyson")

    this._dockService = new Service.Switch(config.name)
    this._dockService.getCharacteristic(Characteristic.On)
        .on('set', (v, callback) => callback('Can not change dock state'))
        .on('get', (callback) => {
          if (this.robot)
            callback(null, this.robot.state === 'run')
          else
            callback(null, false)
        })

    this._init(config).catch((err) => this.log(err))
  }

  getServices() {
    return [this._infoService, this._dockService]
  }

  async _init(config) {
    const devices = (await getDevices(config.email, config.password, config.country)).filter(isRobot)
    if (devices.length === 0)
      throw new Error('Unable to find a robot')
    if (devices.length > 1)
      throw new Error('Found more than one robot, which is currently not supported')

    this.robot = await createRobot(config.ip, devices[0])
    this.robot.on('state', (state) => {
      this._dockService
          .getCharacteristic(Characteristic.On).updateValue(state === 'run')
    })
  }
}
