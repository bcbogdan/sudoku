export type Board = number[];
export const emptyBoard = (): Board => Array(81).fill(0);
export function peers(a:number,b:number) {
 return Math.floor(a/9)===Math.floor(b/9) || a%9===b%9 || (Math.floor(a/27)===Math.floor(b/27)&&Math.floor(a%9/3)===Math.floor(b%9/3));
}
export function validBoard(board:Board) {
 return board.length===81 && board.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=9&&(!v||!board.some((w,j)=>j!==i&&w===v&&peers(i,j))));
}
// Count at most two solutions. MRV keeps even sparse review boards bounded in practice.
export function solve(board:Board): {count:number;solution:Board|null} {
 if (!validBoard(board)) return {count:0,solution:null};
 const b=board.slice();let count=0;let solution:Board|null=null;
 function visit() {
  if(count>=2)return;
  let index=-1, choices:number[]=[];
  for(let i=0;i<81;i++) if(!b[i]) {
   const possible=[1,2,3,4,5,6,7,8,9].filter(n=>!b.some((v,j)=>v===n&&peers(i,j)));
   if(!possible.length)return;
   if(index<0||possible.length<choices.length){index=i;choices=possible;if(choices.length===1)break;}
  }
  if(index<0){count++;solution??=b.slice();return;}
  for(const n of choices){b[index]=n;visit();if(count>=2)break;} b[index]=0;
 }
 visit();return {count,solution};
}
