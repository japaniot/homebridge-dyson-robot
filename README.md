# homebridge-dyson-robot

Homebridge plugin for Dyson 360 Eye and Dyson 360 Heurist.

## Usage

Currently this plugin only support one robot registered in Dyson Link.

```js
"accessories": [
  {
    "accessory": "DysonRobot",
    "name": "Dyson 360 Heurist",
    "email": "zcbenz@gmail.com",
    "country": "JP",
    "password": "password",
    "ip": "172.16.80.45"
  }
]
```

* `email`: The account of your Dyson Link app.
* `password`: The password of your account.
* `country`: Country code of your area.
* `ip`: The IP address of the robot.
