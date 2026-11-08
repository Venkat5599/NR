(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,24572,o=>{"use strict";function i(o,i,r){let t=(o>>24&255)/255;i[r++]=(255&o)/255*t,i[r++]=(o>>8&255)/255*t,i[r++]=(o>>16&255)/255*t,i[r++]=t}o.s(["color32BitToUniform",()=>i])},66481,o=>{"use strict";class i{constructor(){this.batcherName="default",this.topology="triangle-list",this.attributeSize=4,this.indexSize=6,this.packAsQuad=!0,this.roundPixels=0,this._attributeStart=0,this._batcher=null,this._batch=null}get blendMode(){return this.renderable.groupBlendMode}get color(){return this.renderable.groupColorAlpha}reset(){this.renderable=null,this.texture=null,this._batcher=null,this._batch=null,this.bounds=null}}o.s(["BatchableSprite",()=>i])},27705,o=>{"use strict";let i={name:"local-uniform-bit",vertex:{header:`

            struct LocalUniforms {
                uTransformMatrix:mat3x3<f32>,
                uColor:vec4<f32>,
                uRound:f32,
            }

            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,main:`
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,end:`
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `}},r={...i,vertex:{...i.vertex,header:i.vertex.header.replace("group(1)","group(2)")}},t={name:"local-uniform-bit",vertex:{header:`

            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,main:`
            vColor *= uColor;
            modelMatrix = uTransformMatrix;
        `,end:`
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `}};o.s(["localUniformBit",()=>i,"localUniformBitGl",()=>t,"localUniformBitGroup2",()=>r])},34328,o=>{"use strict";o.i(83015),o.i(55376),o.i(10402),o.i(62933),o.i(75179),o.i(67536),o.i(70848),o.i(20531),o.i(90848),o.i(57637),o.i(53363),o.i(16084),o.s([])}]);