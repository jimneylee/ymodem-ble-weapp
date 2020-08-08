//index.js
const ble_profile = require('../../config/ble_profile.js');
const util = require('../../utils/util.js')

//获取应用实例
const app = getApp()

Page({
  data: {
    deviceName:"设备名称"
  },
  
  //====================================================================//
  // 生命周期
  //====================================================================//

  onLoad: function () {

    wx.setNavigationBarTitle({
      title: 'YModem 固件升级'
    })
  },

  onReady: function (e) {
    const deviceId = wx.getStorageSync('device_uuid')
    console.log("home onReady device_uuid:", deviceId)

    if (deviceId) {
      // 尝试自动进入搜索页面连接设备
      wx.navigateTo({
        url: '../search/index',
      })
    }
  },

  onShow: function () {
    console.log("home onShow deviceName: ", app.globalData.deviceName)
    console.log("home onShow deviceId: ", app.globalData.deviceId)

    // 及时刷新蓝牙名称，如：设置页面修改
    if (app.globalData.deviceName) {
      this.setData({
        deviceName: app.globalData.deviceName
      })
    }
  },

  onHide: function () {
    if (app.globalData.deviceId) {
      this.switchBLECharacteristicNotify(false)
    }
  },

  //====================================================================//
  // 蓝牙操作
  //====================================================================//

  onBLEConnectionStateChange() {
    const that = this
    wx.onBLEConnectionStateChange(function (res) {
      // 该方法回调中可以用于处理连接意外断开等异常情况
      console.log(`device ${res.deviceId} state has changed, connected: ${res.connected}`)

      if (res.deviceId == app.globalData.deviceId
          && res.connected == false) {
        // reset UI 和 数据
      }
    })
  },

  //====================================================================//
  // UI 按钮事件操作
  //====================================================================//

  bindSearchAction() {
    wx.navigateTo({
      url: '../search/index',
    })
  },

  bindYModemUpdateAction() {
    wx.navigateTo({
      url: '../controllerfw/index'
    })
  },

  bindDisconnectAction() {
    if (app.globalData.deviceId) {
      const that = this
      wx.showModal({
        title: '提示',
        content: '确定断开设备连接吗',
        success(res) {
          if (res.confirm) {
            that.disconnectDevice()
          } else if (res.cancel) {
            console.log('用户点击取消')
          }
        }
      })
    }
  },

  disconnectDevice() {
    const that = this

    wx.removeStorage({
      key: 'device_uuid',
      success: function (res) { },
    })
    wx.closeBLEConnection({
      deviceId: app.globalData.deviceId
    })
    wx.closeBluetoothAdapter()
    that.setData({
      disconnectBtnHidden: true
    })
    app.globalData.deviceName = null
    app.globalData.deviceId = null

    // ui 延时重置
    setTimeout(() => {
      that.updateBatteryUI(0)
      that.setData({
        deviceName: "Name",
      })
    }, 200)
  },

  //====================================================================//
  // 设备读写数据操作
  //====================================================================//

  //====================================================================//
  // UI 同步更新
  //====================================================================//

})
