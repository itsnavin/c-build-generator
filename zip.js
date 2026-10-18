// ZIP "store" format: no compression or third-party runtime dependency.
export function zip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const header = size => new DataView(new ArrayBuffer(size));
  const bytes = view => new Uint8Array(view.buffer);
  for (const [name, content] of Object.entries(files)) {
    const filename = encoder.encode(name);
    const data = encoder.encode(content);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = header(30);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x800, true);
    local.setUint16(12, 33, true); // 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, filename.length, true);
    chunks.push(bytes(local), filename, data);
    const entry = header(46);
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x800, true);
    entry.setUint16(14, 33, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, filename.length, true);
    entry.setUint32(42, offset, true);
    central.push(bytes(entry), filename);
    offset += 30 + filename.length + data.length;
  }
  const length = central.reduce((sum, item) => sum + item.length, 0);
  const end = header(22);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, length, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, bytes(end)], { type: "application/zip" });
}
