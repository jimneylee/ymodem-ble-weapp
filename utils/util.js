
// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

function buf2string(buffer) {
  return String.fromCharCode.apply(null, new Uint16Array(buffer));
}

function str2ab(str) {
  var buffer = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  var dataView = new DataView(buffer);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    dataView[i] = str.charCodeAt(i);
  }
  return buf;
}

function string2buffer(str) {
  // 首先将字符串转为16进制
  let val = ""
  for (let i = 0; i < str.length; i++) {
    if (val === '') {
      val = str.charCodeAt(i).toString(16)
    } else {
      val += ',' + str.charCodeAt(i).toString(16)
    }
  }

  // 将16进制转化为ArrayBuffer
  return new Uint8Array(val.match(/[\da-f]{2}/gi).map(function (h) {
    return parseInt(h, 16)
  })).buffer
}

// modbus crc16
function cyc16_modbus(data) {
  var len = data.length;
  if (len > 0) {
    var crc = 0xFFFF;

    for (var i = 0; i < len; i++) {
      crc = (crc ^ (data[i]));
      for (var j = 0; j < 8; j++) {
        crc = (crc & 1) != 0 ? ((crc >> 1) ^ 0xA001) : (crc >> 1);
      }
    }
    var hi = ((crc & 0xFF00) >> 8);  //高位置
    var lo = (crc & 0x00FF);         //低位置

    return [hi, lo];
  }
  return [0, 0];
}

// port form here: https://blog.csdn.net/weibo1230123/article/details/81179151
function cyc16_xmodem(data) {
  var usDataLen = data.length;
  if (usDataLen == 0) {
    return [0, 0];
  }

  var wCRCin = 0x0000;
  var wCPoly = 0x1021;
  var wChar = 0;
  var index = 0;

  while (usDataLen--) {
    wChar = data[index++];
    wCRCin ^= (wChar << 8);
    for (var i = 0; i < 8; i++) {
      if (wCRCin & 0x8000)
        wCRCin = (wCRCin << 1) ^ wCPoly;
      else
        wCRCin = wCRCin << 1;
    }
  }

  var hi = ((wCRCin & 0xFF00) >> 8);  //高位置
  var lo = (wCRCin & 0x00FF);         //低位置
  return [hi, lo];
}

module.exports = {
  ab2hex: ab2hex,
  buf2string: buf2string,
  string2buffer: string2buffer,
  cyc16_modbus: cyc16_modbus,
  cyc16_xmodem: cyc16_xmodem,
}
