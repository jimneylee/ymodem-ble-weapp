# ymodem-ble-weapp
YModem 蓝牙透传升级小程序

# Step1: 熟悉理解 YModem 升级透传协议
```
/**
 * ========================================================================================
 * YMODEM 通过发送 "start" 标志开始升级:
 
 * Send "start" >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< C
 
 * SOH 00 FF "firmware.bin" "1064" checkSumByte NUL[118] CRC CRC >>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< C
 
 * STX 01 FE data[256] CRC CRC >>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 
 * STX 02 FD data[256] CRC CRC >>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 
 * STX 03 FC data[256] CRC CRC >>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 
 * STX 04 FB data[256] CRC CRC >>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 
 * SOH 05 FA data[100] 1A[28] CRC CRC >>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 
 * EOT >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< NAK
 
 * EOT>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< C
 
 * SOH 00 FF NUL[128] CRC CRC >>>>>>>>>>>>>>>>>>>>>>>>
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ACK
 
 * THE YMODEM End with SOH:
 
 * Send "finish" >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
 * 下控收到 "finish"，结束升级:
 
 * ===========================================================================================
 **/
```

# Step2: 配置服务和特征 UUID
```
// 路径：config/ble_profile.js
// TODO: 请先配置服务和特征 UUID
module.exports = {
  
  // 主服务 UUID
  UUID_SERVICE_PIRMARY: "",

  // block 数据包写特征
  UUID_CHAR_CONTROLLER_OAD_BLOCK: "",

  // state 状态同步通知特征
  UUID_CHAR_CONTROLLER_OAD_STATE: "",

}
```

# Step3: 配置下控固件网络下载 url
注意：配置工程支持的 url 白名单

```
// 路径：controller/index.js
// 网络下载下控固件
requestDownloadFirmwareFile() {
  this.updateProgressInfo("开始从网络后台下载固件")

  // 配置固件 url 地址
  var url = null

  console.log("firmware url: ", url)

  if (url == null) {
    this.updateProgressInfo("请先配置固件 url 地址")
    return
  }

  // ......
}
```

# Step4：跟下控同学联调，设置开始和结束的标志位
```
const CODE_START    = "start"  // 7374617274
const CODE_FINISH   = "finish" // 6f766572

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

```