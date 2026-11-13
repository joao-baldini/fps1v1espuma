import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{const r=i%4,c=i>>2;return a[r]*b[c*4]+a[r+4]*b[c*4+1]+a[r+8]*b[c*4+2]+a[r+12]*b[c*4+3];});
function transform(node){
  if(node.matrix)return node.matrix;
  const [x,y,z,w]=node.rotation||[0,0,0,1],[sx,sy,sz]=node.scale||[1,1,1],[tx,ty,tz]=node.translation||[0,0,0];
  return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,tx,ty,tz,1];
}
export class Gltf {
  constructor(file){
    const bytes=readFileSync(file),binary=bytes.readUInt32LE(0)===0x46546c67;
    if(binary){for(let p=12;p<bytes.length;){const n=bytes.readUInt32LE(p),type=bytes.readUInt32LE(p+4),chunk=bytes.subarray(p+8,p+8+n);if(type===0x4e4f534a)this.json=JSON.parse(chunk.toString('utf8'));else if(type===0x004e4942)this.bin=chunk;p+=8+n;}}
    else this.json=JSON.parse(bytes.toString('utf8'));
    this.buffers=this.json.buffers.map(b=>b.uri?readFileSync(resolve(dirname(file),b.uri)):this.bin);
  }
  accessor(id){
    const a=this.json.accessors[id],v=this.json.bufferViews[a.bufferView],b=this.buffers[v.buffer||0],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size*width;
    if(!size||!width||a.sparse)throw Error('Unsupported glTF accessor');
    const read=a.componentType===5126?p=>b.readFloatLE(p):a.componentType===5125?p=>b.readUInt32LE(p):a.componentType===5123?p=>b.readUInt16LE(p):p=>b[p];
    return {count:a.count,get:(i,j=0)=>read(offset+i*stride+j*size)};
  }
  *triangles(){
    const doc=this.json,visit=function*(reader,id,parent){
      const node=doc.nodes[id],m=multiply(parent,transform(node));
      if(node.mesh!==undefined)for(const primitive of doc.meshes[node.mesh].primitives){
        if(primitive.mode!==undefined&&primitive.mode!==4)throw Error('Expected triangle mesh');
        const vertices=reader.accessor(primitive.attributes.POSITION),index=primitive.indices===undefined?null:reader.accessor(primitive.indices),count=index?index.count:vertices.count,tex=primitive.attributes.TEXCOORD_0===undefined?null:reader.accessor(primitive.attributes.TEXCOORD_0);
        for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>index?index.get(i+k):i+k),p=ids.map(q=>{const x=vertices.get(q,0),y=vertices.get(q,1),z=vertices.get(q,2);return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];});
          yield {p,material:primitive.material??0,node:node.name,...(tex?{uv:ids.map(q=>[tex.get(q,0),tex.get(q,1)])}:{})};;}
      }
      for(const child of node.children||[])yield*visit(reader,child,m);
    };
    for(const node of doc.scenes[doc.scene||0].nodes)yield*visit(this,node,identity());
  }
}
