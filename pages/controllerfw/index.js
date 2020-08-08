// pages/controllerfw/index.js

const ble_profile = require('../../config/ble_profile.js');
const util = require('../../utils/util.js')

// notify 状态值
const STATE_C   = 0x43
const STATE_ACK = 0x06
const STATE_NAK = 0x15
const STATE_CAN = 0x18

// wirte 数据功能码
const BYTE_SEPARATOR = 0X00
const BYTE_FILL      = 0X00
const CODE_START    = "start"  // 7374617274
const CODE_FINISH   = "finish" // 6f766572

const C0DE_SOH  = 0X01
const C0DE_STX  = 0x02
const C0DE_EOT  = 0x04

const CONTENT_SOH_LENGTH  = 128
const CONTENT_STX_LENGTH  = 256
const HEADER_LENGTH  = 3
const CRC16_LENGTH   = 2
const BLOCK_SIZE = 16

const AWControllerOADState_StartUpdate  = 0x00 // 开始更新，发送 start，等待 C
const AWControllerOADState_FileInfo     = 0x01 // 发送文件信息，等待 ACK C
const AWControllerOADState_FileContent  = 0x02 // 发送文件内容，等待 ACK
const AWControllerOADState_EOT          = 0x03 // 发送 EOT，等待 ACK C
const AWControllerOADState_EndPackage   = 0x04 // 发送 结束包，等待 ACK
const AWControllerOADState_FinishUpdate = 0x05 // 发送 finish，无须等待，自动结束

//获取应用实例
const app = getApp()

Page({

  data: {
    progressText:"进度：",
    updateProgress:0
  },

  //====================================================================//
  // 生命周期
  //====================================================================//

  onLoad: function (options) {
    wx.setNavigationBarTitle({
      title: '控制器固件升级'
    })
  },

  onShow: function () {
    if (app.globalData.deviceId) {
      this._deviceId = app.globalData.deviceId
      this.onBLECharacteristicValueChange()

      // 进入固件升级页面，屏幕常亮
      wx.setKeepScreenOn({
        keepScreenOn: true
      })
    }
  },

  onHide: function () {
    if (app.globalData.deviceId) {
      // 进入固件升级页面，屏幕常亮
      wx.setKeepScreenOn({
        keepScreenOn: false
      })
    }
  },

  onUnload: function () {
  
  },

  //====================================================================//
  // UI 按钮操作
  //====================================================================//

  bindFirmwareUpdate() {
    this.requestDownloadFirmwareFile()
  },

  updateProgressInfo(info) {
    this.setData({
      progressText: "进度：" + info,
    })
  },

  requestDownloadFirmwareFile() {
    this.updateProgressInfo("开始从网络后台下载固件")

    // 配置固件 url 地址
    var url = null

    console.log("firmware url: ", url)

    if (url == null) {
      this.updateProgressInfo("请先配置固件 url 地址")
      return
    }

    const that = this
    wx.downloadFile({
      url: url,
      success(res) {
        if (res.statusCode == 200) {
          that.updateProgressInfo("从网络后台下载固件成功")
          that.loadFirmwarePackageData(res.tempFilePath)
        } else {
          that.updateProgressInfo("从网络后台下载固件失败")
          app.showModalTitle('固件下载失败，后台下载服务出错')
        }
      },
      fail(res) {
        console.log("download bin file fail:", res.msg)
        that.updateProgressInfo("从网络后台下载固件失败")
        app.showModalTitle('下固件下载失败，请检查网络是否正常')
      }
    })
  },

  setUpdateInfo() {
    this._hasReceivedACK = false;
    this._totalFileLength = this._imageFileData.byteLength
    var totalNum = parseInt(this._totalFileLength / CONTENT_STX_LENGTH)
    if (this._totalFileLength % CONTENT_STX_LENGTH > 0) {
      totalNum = totalNum + 1
    }
    this._totalPackageNum = totalNum
    this._lastPackageIndex = totalNum - 1
  },

  loadFirmwarePackageData(filePath) {
    this.updateProgressInfo("加载固件包数据")
    
    this._fileName = "firmware.bin"

    const fs = wx.getFileSystemManager()
    const that = this

    console.log("file path: ", filePath)
    fs.readFile({
      filePath: filePath,
      success(res) {
        console.log("read bin", util.ab2hex(res.data.length))
        that.updateProgressInfo("加载固件包数据成功")

        that._imageFileData = res.data

        // 重设升级标志位
        that.setUpdateInfo()

        if (that._totalFileLength > 0) {
          // 发送 update 开始升级流程
          that.updateProgressInfo("蓝牙发送 update，启动升级流程")
          that.requestSendStartUpdate()
        } else {
          that.updateProgressInfo("加载固件包数据失败")
          app.showModalTitle('固件文件有问题，无法升级');
        }
      },
      fail(res) {
        console.log("read bin fail: ", res)
        that.updateProgressInfo("加载固件包数据失败")
      }
    })
  },

  //====================================================================//
  // 蓝牙操作
  //====================================================================//

  onBLECharacteristicValueChange() {

    console.log("setting onBLECharacteristicValueChange")

    // 判断是否有设备连接上
    if (!app.globalData.deviceId) {
      return
    }

    const deviceId = app.globalData.deviceId
    wx.notifyBLECharacteristicValueChange({
      deviceId: deviceId,
      serviceId: ble_profile.UUID_SERVICE_SETTING,
      characteristicId: ble_profile.UUID_CHAR_CONTROLLER_OAD_STATE,
      state: true,
    })

    // 操作之前先监听，保证第一时间获取数据
    // TODO: 已连接上，不要重复多次调用
    const that = this
    wx.onBLECharacteristicValueChange((characteristic) => {

      // console.log("onBLECharacteristicValueChange uuid:", characteristic.characteristicId)
      // console.log("onBLECharacteristicValueChange value:", util.ab2hex(characteristic.value))

      let charId = characteristic.characteristicId
      let charValue = characteristic.value

      if (charValue.byteLength == 0) {
        return
      }

      var uint8array = new Uint8Array(charValue)
      // console.log("onBLECharacteristicValueChange uint8array[0]:", uint8array[0])

      if (charId == ble_profile.UUID_CHAR_CONTROLLER_OAD_STATE) {
        let val0 = uint8array[0]
        const stateValue = val0
        console.log("val0: ", val0)

        if (stateValue == STATE_C) {
          // 发送 update 回 C
          if (that._currentState == AWControllerOADState_StartUpdate) {
            that._currentState = AWControllerOADState_FileInfo

            console.log("received C then send file info")

            // 发送文件名
            that.requestSendFileInfo()
            that.updateProgressInfo("蓝牙发送 固件名称长度信息包")
          } else if (that._currentState == AWControllerOADState_FileInfo) {
            // 之前接受过 ACK，表示文件信息发送成功
            if (that._hasReceivedACK) {
              console.log("received ACK and C, then send file first package")
              that._hasReceivedACK = false;
              that._currentState = AWControllerOADState_FileContent

              // 开始发送包内容
              that._currentPackageIndex = 0x00;
              that.requestUploadSubPackageData(that._currentPackageIndex);
              that.updateProgressInfo("蓝牙发送 数据包" + that._currentPackageIndex + "/" + that._totalPackageNum)
            } else {
              // 没有收到 ACK，却收到 C
              console.log("received C, resend file info data")
              //that.requestSendFileInfo()
              that.updateProgressInfo("蓝牙再次发送 固件名称长度信息包")
            }
          } else if (that._currentState == AWControllerOADState_EOT) {
            if (that._hasReceivedACK) {
              that._hasReceivedACK = false;

              that._currentState = AWControllerOADState_EndPackage;
              that.requestSendEndPackage();
              that.updateProgressInfo("蓝牙发送 固件结束空包")
            } else {
              // 考虑重传 EOT
              that.requestSendEOT();
              that.updateProgressInfo("蓝牙再次发送 EOT")
            }
          } else if (this._currentState == AWControllerOADState_EndPackage) {
            console.log("received C, resend End package");
            that.requestSendEndPackage();
            that.updateProgressInfo("蓝牙再次发送 固件结束空包")
          } else {
            // 控制器接受超时，返回的 C，考虑重传机制处理
            if (that._currentState == AWControllerOADState_FileContent) {
              console.log("received C, resend package data at index: %u", that._currentPackageIndex);
              that.requestUploadSubPackageData(that._currentPackageIndex);
              that.updateProgressInfo("蓝牙再次发送 数据包" + that._currentPackageIndex + "/" + that._totalPackageNum)
            }
          }
        } else if (stateValue == STATE_ACK) {
          if (that._currentState == AWControllerOADState_FileInfo) {
            console.log("received ACK, and wait C");
            that._hasReceivedACK = true;
            that.updateProgressInfo("蓝牙发送完固件信息，接受到 ACK，等待 C")
          } else if (that._currentState == AWControllerOADState_FileContent) {
            // 发送一整包内容后，收到 ACK，继续发送下一包数据
            that._currentPackageIndex++;

            console.log("received ACK, and send next package index: ", that._currentPackageIndex);
            var progress = parseInt(that._currentPackageIndex * 1.0 / that._totalPackageNum * 100)
            if (progress > 100) {
              progress = 100;
            }
            console.log("uploadProgress: ", progress)
            that.setData({
              updateProgress: progress
            })

            // 判断文件包已全部发送完毕
            if (that._currentPackageIndex <= that._lastPackageIndex) {
              that.requestUploadSubPackageData(that._currentPackageIndex);
              that.updateProgressInfo("蓝牙发送 数据包" + that._currentPackageIndex + "/" + that._totalPackageNum)
            } else {
              that._currentState = AWControllerOADState_EOT;
              that.requestSendEOT();
              that.updateProgressInfo("蓝牙发送 EOT")
            }
          } else if (that._currentState == AWControllerOADState_EOT) {
            that._hasReceivedACK = true;
            that.updateProgressInfo("蓝牙发送完EOT 接受 ACK")
          } else if (that._currentState == AWControllerOADState_EndPackage) {
            that._currentState = AWControllerOADState_FinishUpdate;
            that.requestSendOver();
            that.updateProgressInfo("蓝牙发送 over")
            // 通知页面更新成功
            wx.showModal({
              title: '提示',
              content: '固件升级成功',
              complete: (res) => {
                wx.navigateBack({
                  delta: 1
                })
              }
            })
            // app.showModalTitle('固件升级成功')
          }
        } else if (stateValue == STATE_NAK) {
          console.log("received NAK");
          that.updateProgressInfo("蓝牙接受 NAK")
        } else if (stateValue == STATE_CAN) {
          console.log("received CAN");
          that.updateProgressInfo("蓝牙接受 CAN")
        }
      }
    })
  },

  // 发送开始标志，开始升级
  requestSendStartUpdate() {
    this._currentState = AWControllerOADState_StartUpdate

    let buffer = new ArrayBuffer(8)
    let dataView = new DataView(buffer)

    // "start" <-> 7374617274
    dataView.setUint8(0, 0x73)
    dataView.setUint8(1, 0x74)
    dataView.setUint8(2, 0x61)
    dataView.setUint8(3, 0x72)
    dataView.setUint8(4, 0x74)

    this.writeBLEData(buffer)
  },

  // 发送 EOT
  requestSendEOT() {
    console.log("requestSendEOT")
    let buffer = new ArrayBuffer(1)
    let dataView = new DataView(buffer)
    dataView.setUint8(0, C0DE_EOT)
    this.writeBLEData(buffer)
  },

  // 发送完成标志，结束升级
  requestSendOver() {
    console.log("requestSendOver")

    let buffer = new ArrayBuffer(4)
    let dataView = new DataView(buffer)

    // "finish" <=> 66696e697368
    dataView.setUint8(0, 0x66)
    dataView.setUint8(1, 0x69)
    dataView.setUint8(2, 0x6e)
    dataView.setUint8(3, 0x69)
    dataView.setUint8(3, 0x73)
    dataView.setUint8(3, 0x68)

    this.writeBLEData(buffer)
  },

  requestSendEndPackage() {
    console.log("requestSendEndPackage")

    let buffer = new ArrayBuffer(CONTENT_SOH_LENGTH + HEADER_LENGTH + CRC16_LENGTH)
    let dataView = new DataView(buffer)

    // head bytes
    dataView.setUint8(0, C0DE_SOH)
    dataView.setUint8(1, 0x00)
    dataView.setUint8(2, 0xff)

    // fill 128 0x00
    for (var i = 0; i < CONTENT_SOH_LENGTH; i++) {
      dataView.setUint8(i+3, 0x00)
    }

    // crc16
    var uint8array = new Uint8Array(buffer)
    const subbuf = uint8array.subarray(3, CONTENT_SOH_LENGTH + 3)
    const cyc16 = util.cyc16_xmodem(subbuf)

    console.log("end package content crc16 hi: %x", cyc16[0])
    console.log("end package content crc16 lo: %x", cyc16[1])

    dataView.setUint8(HEADER_LENGTH + CONTENT_SOH_LENGTH, cyc16[0])
    dataView.setUint8(HEADER_LENGTH + CONTENT_SOH_LENGTH + 1, cyc16[1])

    this.requestSendOnePackage(buffer)
  },

  // SOH 00 FF + 文件名 + 00 + 文件长度字符串 + 00 + 和校验 + 填充 00 + CRC CRC
  requestSendFileInfo() {

    let buffer = new ArrayBuffer(CONTENT_SOH_LENGTH + HEADER_LENGTH + CRC16_LENGTH)
    let dataView = new DataView(buffer)
    var location = 0

    // head bytes
    dataView.setUint8(0, C0DE_SOH)
    dataView.setUint8(1, 0x00)
    dataView.setUint8(2, 0xff)
    location = location + 3

    // file name
    var fileNameBuffer = util.string2buffer(this._fileName)
    var fileNameView = new DataView(fileNameBuffer)
    for(let i = 0; i < fileNameBuffer.byteLength; i++) {
      dataView.setUint8(location + i, fileNameView.getUint8(i))
    }
    location = location + fileNameBuffer.byteLength

    // add 0x00 separator byte
    dataView.setUint8(location, BYTE_SEPARATOR)
    location = location + 1

    // file length
    var fileLengthStr = this._totalFileLength + ""
    var fileLengthBuffer = util.string2buffer(fileLengthStr)
    var fileLengthView = new DataView(fileLengthBuffer)
    for (var i = 0; i < fileLengthBuffer.byteLength; i++) {
      dataView.setUint8(location + i,fileLengthView.getUint8(i))
    }
    location = location + fileLengthBuffer.byteLength

    // add 0x00 separator byte
    dataView.setUint8(location, BYTE_SEPARATOR)
    location = location + 1

    // add checksum byte
    var uint8array_all = new Uint8Array(this._imageFileData)
    var checkSum = 0
    for (var i = 0; i < this._totalFileLength; i++) {
      checkSum += uint8array_all[i]
    }
    // console.log("check sum: ", checkSum)

    const fileCheckSumByte = checkSum & 0xff
    dataView.setUint8(location, fileCheckSumByte)
    location = location + 1

    // console.log("fileCheckSumByte: ", fileCheckSumByte)

    // fill length
    var fillLength = CONTENT_SOH_LENGTH - (fileNameBuffer.byteLength + 1 + fileLengthBuffer.byteLength + 1 + 1)// 最后2个长度为：分割字节 0x00 和求和字节
    for (var i = 0; i < fillLength; i++) {
      dataView.setUint8(location + i, 0x00)
    }

    // crc16
    var uint8array = new Uint8Array(buffer)
    const subbuf = uint8array.subarray(3, CONTENT_SOH_LENGTH + 3)
    const cyc16 = util.cyc16_xmodem(subbuf)

    // console.log("cyc16_modem: ", util.cyc16_xmodem(subbuf))

    dataView.setUint8(HEADER_LENGTH + CONTENT_SOH_LENGTH, cyc16[0])
    dataView.setUint8(HEADER_LENGTH + CONTENT_SOH_LENGTH + 1, cyc16[1])

    this.requestSendOnePackage(buffer)
  },

  requestUploadSubPackageData(nextIndex) {
    var remainDataLength = this._totalFileLength - nextIndex * CONTENT_STX_LENGTH
    if (remainDataLength < CONTENT_STX_LENGTH) {
      this.requestUploadLastPackage(nextIndex, remainDataLength)
      return
    }

    let buffer = new ArrayBuffer(CONTENT_STX_LENGTH + HEADER_LENGTH + CRC16_LENGTH)
    let dataView = new DataView(buffer)

    // head 3 bytes
    dataView.setUint8(0, C0DE_STX)
    dataView.setUint8(1, (nextIndex + 1))
    dataView.setUint8(2, ~(nextIndex + 1))

    var uint8array_all = new Uint8Array(this._imageFileData)
    var dataStart = nextIndex * CONTENT_STX_LENGTH
    for (var i = 0; i < CONTENT_STX_LENGTH; i++) {
      dataView.setUint8(3 + i, uint8array_all[dataStart + i])
    }

    // crc16
    var uint8array = new Uint8Array(buffer)
    const subbuf = uint8array.subarray(3, CONTENT_STX_LENGTH + 3)
    const cyc16 = util.cyc16_xmodem(subbuf)

    dataView.setUint8(HEADER_LENGTH + CONTENT_STX_LENGTH, cyc16[0])
    dataView.setUint8(HEADER_LENGTH + CONTENT_STX_LENGTH + 1, cyc16[1])

    this.requestSendOnePackage(buffer)
  },

  requestUploadLastPackage(lastIndex, lastLength) {
    let buffer = new ArrayBuffer(CONTENT_STX_LENGTH + HEADER_LENGTH + CRC16_LENGTH)
    let dataView = new DataView(buffer)
    var location = 0

    // head 3 bytes
    dataView.setUint8(0, C0DE_STX)
    dataView.setUint8(1, (lastIndex + 1))
    dataView.setUint8(2, ~(lastIndex + 1))
    location = location + 3

    var uint8array_all = new Uint8Array(this._imageFileData)
    var dataStart = lastIndex * CONTENT_STX_LENGTH
    for (var i = 0; i < lastLength; i++) {
      dataView.setUint8(3 + i, uint8array_all[dataStart + i])
    }
    location = location + lastLength

    // fill length
    var fillLength = CONTENT_STX_LENGTH - lastLength
    for (var i = 0; i < fillLength; i++) {
      dataView.setUint8(location + i, 0x00)
    }
    location = location + fillLength

    // crc16
    var uint8array = new Uint8Array(buffer)
    const subbuf = uint8array.subarray(3, CONTENT_STX_LENGTH + 3)
    const cyc16 = util.cyc16_xmodem(subbuf)

    dataView.setUint8(HEADER_LENGTH + CONTENT_STX_LENGTH, cyc16[0])
    dataView.setUint8(HEADER_LENGTH + CONTENT_STX_LENGTH + 1, cyc16[1])

    this.requestSendOnePackage(buffer)
  },

  requestSendOnePackage(packageData) {
    console.log("requestSendOnePackage packageData:", util.ab2hex(packageData))

    var packageDataLength = packageData.byteLength
    var blockNumber = packageDataLength / BLOCK_SIZE
    if (packageData.length % BLOCK_SIZE > 0) {
      blockNumber = blockNumber + 1;
    }

    var blockSize = BLOCK_SIZE
    var remainBlockLength = packageDataLength

    var uint8array = new Uint8Array(packageData)
    for (var i = 0; i < blockNumber; i++) {
      remainBlockLength = packageDataLength - i * BLOCK_SIZE
      if (remainBlockLength >= BLOCK_SIZE) {
        blockSize = BLOCK_SIZE
      } else {
        blockSize = remainBlockLength
      }

      const subbuf = uint8array.subarray(i * BLOCK_SIZE, i * BLOCK_SIZE + blockSize)
      const blockBuf = new ArrayBuffer(blockSize)
      const blockView = new DataView(blockBuf)
      for(var j = 0; j < subbuf.length; j++) {
        blockView.setUint8(j, subbuf[j])
      }
      
      console.log("write block:", i)
      this.writeBLEData(blockBuf)
    }
  },

  writeBLEData(buffer) {
    console.log("writeBLEData: ", util.ab2hex(buffer))

    const deviceId = app.globalData.deviceId
    //console.log("connected deviceId", deviceId)

    // write data
    wx.writeBLECharacteristicValue({
      deviceId: deviceId,
      serviceId: ble_profile.UUID_SERVICE_SETTING,
      characteristicId: ble_profile.UUID_CHAR_CONTROLLER_OAD_BLOCK,
      value: buffer,
      success(res) {
        console.log("writeBLEData success")
      },
      fail(res) {
        console.log("writeBLEData fail")
      }
    })
  }
})