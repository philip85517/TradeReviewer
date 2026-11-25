/** Keep the return coordinate; separate overlapping measured targets vertically. */
export function stripLanes(positions: number[], width: number, separation = 50): number[] {
 const ends: number[]=[];
 const lanes: number[]=[];
 positions.map((position,index)=>({x:position*width/100,index})).sort((a,b)=>a.x-b.x||a.index-b.index).forEach(({x,index})=>{
  let lane=ends.findIndex(end=>x-end>=separation);
  if(lane<0)lane=ends.length;
  ends[lane]=x;
  lanes[index]=lane;
 });
 return lanes;
}
