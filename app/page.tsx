'use client';
import {useState} from 'react';
import {emptyBoard,peers,solve,validBoard,type Board} from '@/lib/sudoku';
export default function Sudoku() {
 const [board,setBoard]=useState<Board>(emptyBoard),[givens,setGivens]=useState<Board>(emptyBoard),[solution,setSolution]=useState<Board|null>(null);
 const [phase,setPhase]=useState<'upload'|'review'|'play'>('upload'),[selected,setSelected]=useState(0),[notesMode,setNotesMode]=useState(false),[check,setCheck]=useState(true);
 const [notes,setNotes]=useState<number[][]>(()=>Array.from({length:81},()=>[])),[mistakes,setMistakes]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState<number[]>([]);
 const complete=phase==='play'&&board.every(Boolean)&&validBoard(board);
 async function upload(file?:File){
  if(!file||busy)return;
  if(!file.type.startsWith('image/')){setMessage('Please choose an image file.');return;}
  if(file.size>20*1024*1024){setMessage('Please use an image smaller than 20 MB.');return;}
  setBusy(true);setMessage('Opening photo…');
  try{const {readSudoku}=await import('@/lib/localSudokuReader');const result=await readSudoku(file,setMessage);setBoard(result.board);setUncertain(result.uncertain);setPhase('review');setSelected(0);setMessage('Check each clue against your photo, then start playing.');}
  catch(error){setMessage(error instanceof Error?error.message:'Could not read this photo. Please try again.');}
  finally{setBusy(false);}
 }
 function enter(n:number){
  if(phase==='upload'||busy||complete||(phase==='play'&&givens[selected]))return;
  if(phase==='play'&&notesMode&&n){if(board[selected])return;setNotes(old=>old.map((items,i)=>i===selected?(items.includes(n)?items.filter(v=>v!==n):[...items,n].sort()):items));return;}
  if(phase==='play'&&check&&n&&solution&&solution[selected]!==n&&board[selected]!==n)setMistakes(v=>v+1);
  setBoard(old=>old.map((v,i)=>i===selected?n:v));setNotes(old=>old.map((v,i)=>i===selected?[]:v));setUncertain(old=>old.filter(i=>i!==selected));
 }
 function start(){
  if(board.filter(Boolean).length<17){setMessage('Add at least 17 clues before checking for a unique puzzle.');return;}
  const result=solve(board);
  if(result.count!==1){setMessage(result.count===0?'These clues conflict or cannot form a solved Sudoku. Please check the photo.':'This board has more than one solution. Please check for missing clues.');return;}
  setGivens(board.slice());setSolution(result.solution);setNotes(Array.from({length:81},()=>[]));setMistakes(0);setNotesMode(false);setPhase('play');setSelected(board.findIndex(v=>!v));setMessage('');
 }
 return <main>
  <header><a href="/" className="brand" aria-label="Sudoku home"><span className="mark">▦</span> Sudoku</a><span className="privacy">Your photo stays on your device</span></header>
  <div className="workspace"><section className="sidebar"><p className="eyebrow">FROM PAPER TO PLAY</p><h1>{phase==='upload'?'Your next puzzle.':phase==='review'?'Check the clues.':'Make your move.'}</h1>
  <p className="intro">{phase==='upload'?'Turn a photo of a Sudoku into a board you can play.':phase==='review'?'Correct any missing or misread numbers. Only confirmed clues will be locked.':'A little focus. One square at a time.'}</p>
  <label className={`upload ${busy?'loading':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void upload(e.dataTransfer.files[0]);}}><span aria-hidden="true">＋</span><strong>{busy?'Reading your photo…':phase==='upload'?'Choose a Sudoku photo':'Choose another photo'}</strong><small>or drop an image here · up to 20 MB</small><input aria-label="Choose a Sudoku photo" type="file" accept="image/*" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label>
  {phase==='upload'?<button className="text-button" onClick={()=>{setPhase('review');setMessage('Enter the printed clues, then start playing.');}}>Enter clues by hand →</button>:null}
  {phase==='review'?<><div className="summary"><strong>{board.filter(Boolean).length}</strong> clues found{uncertain.length>0?<p>{uncertain.length} cells need a closer look.</p>:null}</div><button className="primary" onClick={start} disabled={busy}>Confirm clues & play →</button></>:null}
  {phase==='play'?<div className="controls"><button aria-pressed={notesMode} onClick={()=>setNotesMode(v=>!v)}>Pencil notes <span>{notesMode?'On':'Off'}</span></button><button aria-pressed={check} onClick={()=>setCheck(v=>!v)}>Mistake check <span>{check?'On':'Off'}</span></button><p className="mistakes">Mistakes <strong>{mistakes}</strong></p><button className="text-button" onClick={()=>{setBoard(givens.slice());setNotes(Array.from({length:81},()=>[]));setMistakes(0);}}>Reset entries</button><button className="text-button" onClick={()=>{setPhase('review');setBoard(givens.slice());setMessage('Edit the original clues, then confirm again.');}}>Edit original clues</button></div>:null}
  <p className="status" role="status" aria-live="polite">{complete?'Puzzle complete. Nicely done!':message}</p>
  </section><section className="game" aria-label="Sudoku game"><div className="board-heading"><span>{phase==='review'?'REVIEW BOARD':phase==='play'?'YOUR PUZZLE':'A FRESH START'}</span><span>{phase==='play'?`${board.filter(Boolean).length} / 81`:'9 × 9'}</span></div>
  <div className={`board ${phase==='upload'?'empty':''}`} role="group" aria-label="Sudoku board" onKeyDown={e=>{if(/^[1-9]$/.test(e.key)){e.preventDefault();enter(Number(e.key));}else if(['Backspace','Delete','0'].includes(e.key)){e.preventDefault();enter(0);}else if(e.key.toLowerCase()==='n'){setNotesMode(v=>!v);}else {const delta:Record<string,number>={ArrowUp:-9,ArrowDown:9,ArrowLeft:-1,ArrowRight:1};if(e.key in delta){e.preventDefault();const next=Math.max(0,Math.min(80,selected+delta[e.key]));setSelected(next);document.getElementById(`cell-${next}`)?.focus();}}}}>
  {board.map((value,i)=>{const given=phase==='play'&&!!givens[i],wrong=phase==='play'&&check&&value&&!given&&solution?.[i]!==value;return <button key={i} id={`cell-${i}`} type="button" data-value={value} data-given={given} data-wrong={!!wrong} aria-label={`Row ${Math.floor(i/9)+1} column ${i%9+1}, ${value||'empty'}${given?', given':''}`} aria-pressed={selected===i&&phase!=='upload'} disabled={phase==='upload'||busy} tabIndex={selected===i?0:-1} className={`cell ${given?'given':''} ${phase!=='upload'&&peers(selected,i)?'peer':''} ${phase!=='upload'&&value&&value===board[selected]?'match':''} ${selected===i&&phase!=='upload'?'selected':''} ${wrong?'wrong':''} ${phase==='review'&&uncertain.includes(i)?'uncertain':''}`} onClick={()=>setSelected(i)}>{value||<span className="notes">{[1,2,3,4,5,6,7,8,9].map(n=><span key={n} className={board[selected]===n?'note-match':''}>{phase==='play'&&notes[i].includes(n)?n:''}</span>)}</span>}</button>;})}
  </div><div className="keypad">{[1,2,3,4,5,6,7,8,9,0].map(n=><button key={n} aria-label={n?`Enter ${n}`:'Erase cell'} disabled={phase==='upload'||busy} onClick={()=>enter(n)}>{n||'⌫'}</button>)}</div><p className="hint">{phase==='upload'?'Your scanned puzzle will appear here.':'Select a square, then a number. Keyboard: 1–9 · Delete to erase · N for notes.'}</p>
  </section></div><footer>Scan. Check. Settle in.</footer>
 </main>;
}
