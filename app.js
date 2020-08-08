App({
  onLaunch: function () {

  },

  resetDeviceInfo() {
    this.globalData.deviceId = null
    this.globalData.deviceName = null
  },

  globalData: {
    userInfo: null,
    deviceId: null,  // 值不为空，说明设备已连接上
    deviceName: null, // 设备名称
  },

  //====================================================================//
  // UI 模态框弹出
  //====================================================================//
  showModalTitle(title) {
    wx.showModal({
      title: title,
      showCancel: false,
      complete: (res) => {

      }
    })
  },

  showModalMessage(message) {
    wx.showModal({
      content: message,
      showCancel: false,
      complete: (res) => {

      }
    })
  },

  showModalTitleAndMessage(title, message) {
    wx.showModal({
      title: title,
      content: message,
      showCancel: false,
      complete: (res) => {

      }
    })
  },

})
