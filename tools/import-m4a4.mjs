import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const file=readFileSync(resolve(root,'assets/models/m4a4_lowpoly.glb'));
if(file.toString('utf8',0,4)!=='glTF'||file.readUInt32LE(4)!==2)throw new Error('Expected GLB 2');
const jsonLength=file.readUInt32LE(12),gltf=JSON.parse(file.toString('utf8',20,20+jsonLength));
const binary=28+jsonLength;
if(gltf.nodes.some(n=>n.matrix||n.translation||n.rotation||n.scale))throw new Error('Bake node transforms first');
const components={SCALAR:1,VEC3:3,VEC4:4},types={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']};
function accessor(index){
  const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],[size,read]=types[a.componentType],width=components[a.type],out=[];
  for(let i=0;i<a.count;i++)for(let c=0;c<width;c++)out.push(file[read](binary+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||width*size)+c*size));
  return out;
}
const lines=[];let triangles=0;
for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
  const source=accessor(primitive.attributes.POSITION),colors=accessor(primitive.attributes.COLOR_0),indices=accessor(primitive.indices),vertices=[];
  for(let i=0;i<source.length;i+=3)vertices.push(source[i+1]*.85,(source[i+2]-.139)*.85,source[i]*.85-.12);
  const hex=(colors[0]<<16)|(colors[1]<<8)|colors[2];
  if(colors.some((v,i)=>v!==colors[i%4]))throw new Error('Expected a solid color per part');
  lines.push('  '+JSON.stringify([vertices.map(v=>+v.toFixed(5)),indices,hex])+', // '+mesh.name);
  triangles+=indices.length/3;
}
const block='// BEGIN M4A4 MODEL\n// Generated from the user GLB: '+triangles+' triangles, one merged mesh.\nGUNS.m4a4 = [\n'+lines.join('\n')+'\n].map(([vertices,indices,hex])=>weaponMesh(vertices,indices,hex));\n// END M4A4 MODEL';
const path=resolve(root,'index.html'),html=readFileSync(path,'utf8');
if(!html.includes('// BEGIN M4A4 MODEL'))throw new Error('Model markers missing');
writeFileSync(path,html.replace(/\/\/ BEGIN M4A4 MODEL[\s\S]*?\/\/ END M4A4 MODEL/,block));
console.log('Imported '+triangles+' triangles from '+gltf.meshes.length+' parts.');
