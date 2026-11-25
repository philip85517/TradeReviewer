import {expect,it} from 'vitest';
import {stripLanes} from './strip-lanes';
it('separates nearby and coincident points without changing return coordinates',()=>{
 expect(stripLanes([50,50.12,50],1000)).toEqual([0,2,1]);
 expect(stripLanes([10,50,90],1000)).toEqual([0,0,0]);
});
it('reassigns lanes when responsive space narrows and never overlaps targets',()=>{
 const positions=[10,15,20,21,80];
 for(const width of [0,120,390,1280]){
  const lanes=stripLanes(positions,width);
  positions.forEach((a,i)=>positions.forEach((b,j)=>{
   if(i!==j&&lanes[i]===lanes[j])expect(Math.abs(a-b)*width/100).toBeGreaterThanOrEqual(50);
  }));
 }
 expect(stripLanes([10,15],120)).toEqual([0,1]);
 expect(stripLanes([10,15],1280)).toEqual([0,0]);
});

it('uses actual hit target width plus a gap, including mobile 44px targets',()=>{
 for(const size of [36,44,60]) {
  const positions=[0,4,4.8,8,16];
  const lanes=stripLanes(positions,1000,size+6);
  positions.forEach((a,i)=>positions.forEach((b,j)=>{
   if(i!==j && lanes[i]===lanes[j])expect(Math.abs(a-b)*10).toBeGreaterThanOrEqual(size+6);
  }));
 }
});
