const ble_profile = require('../../config/ble_profile.js');
const util = require('../../utils/util.js')

//获取应用实例
const app = getApp()

function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

Page({
  data: {
    devices: [],
    connected: false,
    canWrite: true,
    chs: [],
  },

  //====================================================================//
  // 生命周期
  //====================================================================//

  onLoad: function (options) {
    wx.setNavigationBarTitle({
      title: '搜索设备'
    })

    this._lastDeviceId = wx.getStorageSync('device_uuid')
    this.openBluetoothAdapter()
  },

  onReady: function () {

  },

  onShow: function () {

  },

  onHide: function () {
    this.stopBluetoothDevicesDiscovery()
  },

  onUnload: function () {
    this.stopBluetoothDevicesDiscovery()
  },

  //====================================================================//
  // UI 蓝牙搜索开关按钮操作
  //====================================================================//

  // 初始化蓝牙模块
  openBluetoothAdapter() {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)

        // 蓝牙模块可用，直接开始扫描
        this.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        console.log('openBluetoothAdapter fail', res)

        // 当前蓝牙适配器不可用
        if (res.errCode === 10001) {

          wx.showModal({
            title: '蓝牙不可用',
            content: '请到设置中开启蓝牙',
            showCancel: false
          })

          // 监听蓝牙适配器状态变化事件
          wx.onBluetoothAdapterStateChange(function (res) {
            console.log('onBluetoothAdapterStateChange', res)

            // 监听到蓝牙模块可用，再开始扫描
            if (res.available) {
              this.startBluetoothDevicesDiscovery()
            }
          })
        } else {
          // TODO: 考虑处理其他错误类型
        }
      }
    })
  },

  // 关闭蓝牙模块
  // 断开所有已建立的连接并释放系统资源
  // 与 wx.openBluetoothAdapter 成对调用
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },

  // 获取蓝牙适配器状态
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success(res) {
        console.log('getBluetoothAdapterState success ', res)
      },
      fail(res) {
        console.log('getBluetoothAdapterState fail ', res)
      }
    })
  },
  
  //====================================================================//
  // 蓝牙 api 操作
  //====================================================================//

  // 开始搜索蓝牙设备
  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return
    }
    this._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      services: [ble_profile.UUID_SERVICE_PIRMARY],
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res)
        this.onBluetoothDeviceFound()
      },
    })
  },

  // 停止蓝牙搜索设备
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery()
  },

  // 找到蓝牙设备回调
  onBluetoothDeviceFound() {
    const that = this
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }

        const foundDevices = this.data.devices
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device
        } else {
          data[`devices[${idx}]`] = device
        }

        this.setData(data)

        // 按 rssi 排序
        // const cmp = (a, b) => b.RSSI - a.RSSI
        // const finalDevices = this.data.devices
        // finalDevices.sort(cmp)
        // this.setData({
        //   devices: finalDevices
        // })

        // 若该设备为之前连接过，则自动连接
        if (that._lastDeviceId == device.deviceId) {
          that.autoCreateBLEConnection(device.deviceId, device.name)
        }
      })
    })
  },

  // 创建蓝牙自动连接
  autoCreateBLEConnection(deviceId, deviceName) {
    const name = deviceName

    wx.showLoading({
      title: '正在连接中...',
    })
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        this.setData({
          connected: true,
          name,
          deviceId,
        })

        // 连接配对成功，开始获取设备可用服务
        this.getBLEDeviceServices(deviceId)
      }
    })

    // 尝试连接设备，及时停止设备扫描
    this.stopBluetoothDevicesDiscovery()
  },

  //创建连接
  createBLEConnection(e) {
    const ds = e.currentTarget.dataset
    const deviceId = ds.deviceId
    const name = ds.name

    wx.showLoading({
      title: '正在连接中...',
    })

    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        this.setData({
          connected: true,
          name,
          deviceId,
        })

        // 连接配对成功，开始获取设备可用服务
        this.getBLEDeviceServices(deviceId)
      }
    })

    // 尝试连接设备，及时停止设备扫描
    this.stopBluetoothDevicesDiscovery()
  },

  // 关闭蓝牙连接
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      connected: false,
      chs: [],
      canWrite: true,
    })
  },

  // 遍历已连接设备的所有服务
  // TODO: 考虑 await 异步回调
  getBLEDeviceServices(deviceId) {
    wx.showLoading({
      title: '开始刷新服务...',
    })

    const that = this
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {

          console.log("getBLEDeviceServices:", res.services[i].uuid)

          // 设备服务遍历完成，延时请求数据访问权限
          if (i == res.services.length - 1) {
            wx.hideLoading()
            wx.showToast({
              title: '服务刷新完毕',
            })

            app.globalData.deviceId = that.data.deviceId

            // 延时操作，否则会报 10003 错误问题
            setTimeout(() => {
              wx.navigateBack({
                delta: 1
              })
            }, 1000)
          }
        }
      }
    })
  },

})
