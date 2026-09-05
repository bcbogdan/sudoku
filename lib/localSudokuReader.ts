import type CV from '@techstark/opencv-js';
import type {Board} from './sudoku';
let cvPromise:Promise<{cv:typeof CV}>|undefined;
function loadCV():Promise<{cv:typeof CV}> {
 if(cvPromise)return cvPromise;
 cvPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/vendor/opencv.js';
  const timeout=setTimeout(()=>reject(new Error('Image reader took too long to load. Please retry.')),60000);
  script.onerror=()=>{clearTimeout(timeout);script.remove();reject(new Error('Could not load the local image reader.'));};
  script.onload=()=>{
   const module=(window as unknown as {cv:typeof CV & {onRuntimeInitialized?:()=>void}}).cv;
   const ready=()=>{clearTimeout(timeout);resolve({cv:module});};
   // Do not resolve a Promise with the legacy Emscripten module itself: its
   // then() returns itself, causing endless Promise assimilation.
   if(module.Mat)ready();else module.onRuntimeInitialized=ready;
  };
  document.head.append(script);
 }).catch(error=>{cvPromise=undefined;throw error;}) as Promise<{cv:typeof CV}>;
 return cvPromise;
}
function canvas(width:number,height:number){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
export async function readSudoku(file:File,progress:(message:string)=>void):Promise<{board:Board;uncertain:number[]}> {
 progress('Loading the local image reader…');
 const [{cv},{createWorker,PSM},bitmap]=await Promise.all([loadCV(),import('tesseract.js'),createImageBitmap(file)]);
 const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
 const source=canvas(Math.round(bitmap.width*scale),Math.round(bitmap.height*scale));
 source.getContext('2d')!.drawImage(bitmap,0,0,source.width,source.height);bitmap.close();
 const mats:{delete():void}[]=[];
 const own=<T extends {delete():void}>(m:T):T=>{mats.push(m);return m;};
 let worker:Awaited<ReturnType<typeof createWorker>>|undefined;
 try {
  progress('Finding the Sudoku grid…');
  const src=own(cv.imread(source)),gray=own(new cv.Mat()),blur=own(new cv.Mat()),binary=own(new cv.Mat());
  cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
  cv.adaptiveThreshold(blur,binary,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,9);
  const contours=own(new cv.MatVector()),hierarchy=own(new cv.Mat());cv.findContours(binary,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
  let bestArea=0;let points:{x:number;y:number}[]=[];
  for(let i=0;i<contours.size();i++){
   const contour=contours.get(i),approx=new cv.Mat();
   try{cv.approxPolyDP(contour,approx,0.02*cv.arcLength(contour,true),true);const area=cv.contourArea(contour);
    if(approx.rows===4&&area>bestArea&&area>source.width*source.height*0.12&&cv.isContourConvex(approx)){
     bestArea=area;points=Array.from({length:4},(_,j)=>({x:approx.data32S[j*2],y:approx.data32S[j*2+1]}));
    }
   }finally{contour.delete();approx.delete();}
  }
  if(points.length!==4)throw new Error('Could not find a Sudoku grid. Try a clear photo of the whole board.');
  const tl=points.reduce((a,b)=>a.x+a.y<b.x+b.y?a:b),br=points.reduce((a,b)=>a.x+a.y>b.x+b.y?a:b);
  const tr=points.reduce((a,b)=>a.x-a.y>b.x-b.y?a:b),bl=points.reduce((a,b)=>a.x-a.y<b.x-b.y?a:b);
  if(new Set([tl,tr,br,bl]).size!==4)throw new Error('Please rotate the photo so the board is upright.');
  const from=own(cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y,tr.x,tr.y,br.x,br.y,bl.x,bl.y]));
  const to=own(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,899,0,899,899,0,899]));
  const transform=own(cv.getPerspectiveTransform(from,to)),flat=own(new cv.Mat()),ink=own(new cv.Mat());
  cv.warpPerspective(gray,flat,transform,new cv.Size(900,900));
  cv.adaptiveThreshold(flat,ink,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,12);
  worker=await createWorker('eng',1,{workerPath:'/vendor/worker.min.js',corePath:'/vendor',langPath:'/vendor',workerBlobURL:false});
  await worker.setParameters({tessedit_char_whitelist:'123456789',tessedit_pageseg_mode:PSM.SINGLE_WORD});
  const board:Board=Array(81).fill(0),uncertain:number[]=[];
  for(let index=0;index<81;index++){
   progress(`Reading cells… ${index+1} / 81`);
   const roi=ink.roi(new cv.Rect(index%9*100+10,Math.floor(index/9)*100+10,80,80));
   const labels=new cv.Mat(),stats=new cv.Mat(),centers=new cv.Mat();
   try{
    const count=cv.connectedComponentsWithStats(roi,labels,stats,centers,8,cv.CV_32S);
    let selected=0,best=0;
    for(let k=1;k<count;k++){
     const x=stats.intAt(k,cv.CC_STAT_LEFT),y=stats.intAt(k,cv.CC_STAT_TOP),w=stats.intAt(k,cv.CC_STAT_WIDTH),h=stats.intAt(k,cv.CC_STAT_HEIGHT),area=stats.intAt(k,cv.CC_STAT_AREA);
     if(x<=1||y<=1||x+w>=79||y+h>=79||h<22||w<5||area<65||Math.abs(x+w/2-40)>22||Math.abs(y+h/2-40)>22)continue;
     if(area>best){selected=k;best=area;}
    }
    if(!selected)continue;
    const x=stats.intAt(selected,cv.CC_STAT_LEFT),y=stats.intAt(selected,cv.CC_STAT_TOP),w=stats.intAt(selected,cv.CC_STAT_WIDTH),h=stats.intAt(selected,cv.CC_STAT_HEIGHT);
    const digit=canvas(w,h),ctx=digit.getContext('2d')!,data=ctx.createImageData(w,h);
    for(let py=0;py<h;py++)for(let px=0;px<w;px++){const offset=(py*w+px)*4,value=labels.intAt(y+py,x+px)===selected?0:255;data.data[offset]=value;data.data[offset+1]=value;data.data[offset+2]=value;data.data[offset+3]=255;}
    ctx.putImageData(data,0,0);
    const normalized=canvas(160,160),nctx=normalized.getContext('2d')!;nctx.fillStyle='white';nctx.fillRect(0,0,160,160);const factor=110/Math.max(w,h);nctx.drawImage(digit,(160-w*factor)/2,(160-h*factor)/2,w*factor,h*factor);
    const {data:result}=await worker.recognize(normalized);const text=result.text.trim();
    if(/^[1-9]$/.test(text)){board[index]=Number(text);if(result.confidence<65)uncertain.push(index);}else uncertain.push(index);
   }finally{roi.delete();labels.delete();stats.delete();centers.delete();}
  }
  if(!board.some(Boolean))throw new Error('No digits were recognized. Try a sharper photo.');
  return {board,uncertain};
 }finally{await worker?.terminate();for(const mat of mats.reverse())mat.delete();}
}
