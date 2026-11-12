import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Offline input only: glTF exported by the official Source 2 Viewer CLI.
export class Source2Gltf {
  constructor(file){
    this.json=JSON.parse(readFileSync(file,'utf8'));this.buffers=this.json.buffers.map(b=>readFileSync(resolve(dirname(file),b.uri)));
  }
  accessor(id){
    const a=this.json.accessors[id],v=this.json.bufferViews[a.bufferView],b=this.buffers[v.buffer||0],sizes={5121:1,5123:2,5125:4,5126:4},width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size=sizes[a.componentType],offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||width*size;
    const read=a.componentType===5126?p=>b.readFloatLE(p):a.componentType===5125?p=>b.readUInt32LE(p):a.componentType===5123?p=>b.readUInt16LE(p):p=>b[p];
    return {count:a.count,width,get:(i,j=0)=>read(offset+i*stride+j*size)};
  }
  *physicsTriangles(){
    // world_physics positions retain Source's inch/Z-up frame. Do not apply the glTF presentation matrix.
    for(const node of this.json.nodes){if(node.mesh===undefined)continue;
      for(const primitive of this.json.meshes[node.mesh].primitives){
        const vertices=this.accessor(primitive.attributes.POSITION),indices=this.accessor(primitive.indices),material=this.json.materials?.[primitive.material]?.name||node.name;
        for(let i=0;i<indices.count;i+=3){const p=[0,1,2].map(j=>{const id=indices.get(i+j);return [vertices.get(id,0),vertices.get(id,1),vertices.get(id,2)];});yield {p,material,name:node.name};}
      }
    }
  }
}
