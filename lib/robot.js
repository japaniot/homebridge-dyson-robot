const mqtt = require('mqtt')
const events = require('events')

module.exports = {isRobot, createRobot}

const EYE_TYPE = 'N223'
const HEURIST_TYPE = '276'

async function isRobot(device) {
  return device.ProductType === EYE_TYPE || device.ProductType === HEURIST_TYPE
}

async function createRobot(ip, device) {
  if (!isRobot(device))
    throw new Error(`Passed device type ${device.ProductType} is not a robot`)

  return new Promise((resolve, reject) => {
    const mqttClientOptions = {
      username: device.Serial,
      password: device.Password,
      protocolVersion: 3,
      protocolId: 'MQIsdp',
    }
    const mqttClient = mqtt.connect(`mqtt://${ip}`, mqttClientOptions)
    // When errors happens before first state was received, consider it fatal.
    mqttClient.once('error', (err) => {
      mqttClient.end(true)
      reject(err)
    })
    mqttClient.once('connect', () => {
      const robot = new Robot(device, mqttClient)
      robot.once('state', () => {
        // Remove fatal error handler.
        mqttClient.removeAllListeners('error')
        // Let Robot handle the error itself.
        mqttClient.on('error', robot._handleError.bind(robot))
        // Only resolve after connection succeeded and state was received.
        resolve(robot)
      })
    })
  })
}

class Robot extends events.EventEmitter {
  constructor(device, mqttClient) {
    super()
    this.name = device.Name
    this.version = device.Version
    this.serial = device.Serial

    this.paused = false
    this.state = null

    this._mqttClient = mqttClient
    this._id = `${device.ProductType}/${device.Serial}`

    mqttClient.subscribe(`${this._id}/status`)
    mqttClient.on('message', this._handleMessage.bind(this))
    mqttClient.on('connect', this._handleReconnection.bind(this))
    this._requestState()
  }

  _handleMessage(topic, message) {
    try {
      const data = JSON.parse(String(message))
      if (data.msg === 'CURRENT-STATE')
        this._handleState(data.state)
      else if (data.msg === 'STATE-CHANGE')
        this._handleState(data.newstate)
    } catch (err) {
      this.emit('error', err)
    }
  }

  _handleState(str) {
    this.emit('raw-state', str)

    let state
    if (str === 'MACHINE_OFF' ||
        str.endsWith('_CHARGED') ||
        str.endsWith('_CHARGING') ||
        str.endsWith('_ON_DOCK')) {
      state = 'dock'
    } else if (str.endsWith('_ABORTED') ||
               str.endsWith('_PAUSED')) {
      // Aborting or pausing does not change the dock state.
      state = this.state
    } else {
      // When recovering from paused state while robot is on dock, only consider
      // state as "run" when actually running as user may choose to end cleaning
      // immediately.
      if (this.paused && this.state === 'dock') {
        if (str.endsWith('_RUNNING'))
          state = 'run'
        else
          state = 'dock'
      } else {
        state = 'run'
      }
    }

    // Update current state at last.
    if (state !== this.state) {
      this.state = state
      this.emit('state', state)
    }
    this.paused = str.endsWith('_ABORTED')
  }

  _handleError(err) {
    this.reconnect()
    this.emit('error', err)
  }

  _handleReconnection() {
    this._requestState()
  }

  _requestState() {
    this._mqttClient.publish(`${this._id}/command`, JSON.stringify({
      msg: 'REQUEST-CURRENT-STATE',
      time: (new Date()).toISOString()
    }))
  }
}
