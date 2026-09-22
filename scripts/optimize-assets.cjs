/* oxlint-disable typescript/no-require-imports -- Node-only tooling */
// Repack textures without changing the licensed model's geometry, rig or UVs.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SCULPT_SHARP || 'sharp');
const root = path.resolve(__dirname, '..');
async function main() {
  const src = fs.readFileSync(path.join(root, 'assets/source/athlete.glb'));
  const jsonLength = src.readUInt32LE(12);
  const model = JSON.parse(src.subarray(20, 20 + jsonLength));
  const binary = src.subarray(28 + jsonLength);
  const views = new Map(model.images.map((img, index) => [img.bufferView, index]));
  const chunks = []; let size = 0;
  for (let i = 0; i < model.bufferViews.length; i++) {
    const view = model.bufferViews[i];
    let data = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    if (views.has(i)) {
      const image = model.images[views.get(i)];
      data = await sharp(data).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:88,effort:6}).toBuffer();
      image.mimeType = 'image/webp';
    }
    const pad = (4 - size % 4) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); size += pad; }
    view.byteOffset = size; view.byteLength = data.length;
    chunks.push(data); size += data.length;
  }
  for (const tex of model.textures) {
    tex.extensions = {...tex.extensions, EXT_texture_webp:{source:tex.source}};
    delete tex.source;
  }
  model.extensionsUsed = [...new Set([...(model.extensionsUsed||[]),'EXT_texture_webp'])];
  model.extensionsRequired = [...new Set([...(model.extensionsRequired||[]),'EXT_texture_webp'])];
  model.buffers[0].byteLength = size;
  let json = Buffer.from(JSON.stringify(model));
  json = Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const bin = Buffer.concat([...chunks,Buffer.alloc((4-size%4)%4)]);
  const header = Buffer.alloc(20); header.write('glTF'); header.writeUInt32LE(2,4);
  header.writeUInt32LE(28+json.length+bin.length,8); header.writeUInt32LE(json.length,12); header.writeUInt32LE(0x4e4f534a,16);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length,0); binHeader.writeUInt32LE(0x004e4942,4);
  const output = Buffer.concat([header,json,binHeader,bin]);
  fs.writeFileSync(path.join(root,'public/athlete-optimized.glb'),output);
  for(const name of ['athlete-art','studio-art']) {
    await sharp(path.join(root,`assets/source/${name}.png`)).resize({width:1440,withoutEnlargement:true}).webp({quality:80,effort:6}).toFile(path.join(root,`public/${name}.webp`));
  }
  console.log(JSON.stringify({modelBefore:src.length,modelAfter:output.length,reduction:Math.round((1-output.length/src.length)*100)+'%'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
