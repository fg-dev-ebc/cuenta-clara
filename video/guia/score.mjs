// Original 24-second score: muted keys, bass pulse and a small arrival chime.
import { writeFileSync } from 'node:fs'
const rate=32000, n=rate*24, samples=new Float32Array(n)
function note(start,hz,duration,gain,decay=3){
  const a=Math.round(start*rate),m=Math.round(duration*rate)
  for(let i=0;i<m && a+i<n;i++){
    const t=i/rate,phase=2*Math.PI*hz*t
    samples[a+i]+=gain*Math.min(1,t/.013,(m-i)/(rate*.04))*Math.exp(-decay*t/duration)*(Math.sin(phase)+.18*Math.sin(phase*2))
  }
}
const roots=[146.83,116.54,130.81,98]
for(let beat=0;beat<40;beat++){
  const t=beat*.55,root=roots[Math.floor(beat/8)%4]
  if(beat%2===0)note(t,root/2,.55,.15)
  if(beat%4!==3)note(t+.275,root*[2,2.5,3,3.75][beat%4],.54,.09)
  if(beat%8===0)for(const r of [1,1.25,1.5])note(t,root*r,2.1,.039,1.2)
}
for(const t of [2.8,6.8,9.4,12.35,13.8,15.25,19.6])note(t,880,.32,.062)
for(const r of [1,1.25,1.5,2])note(22,146.83*r,1.92,.068)
const wav=Buffer.alloc(44+2*n)
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16)
wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28)
wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40)
for(let i=0;i<n;i++)wav.writeInt16LE(Math.round(samples[i]*30000),44+i*2)
writeFileSync(new URL('./assets/pulso.wav',import.meta.url),wav)
