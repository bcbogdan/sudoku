import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solve,validBoard,emptyBoard,peers} from '../lib/sudoku';
import expected from './fixtures/expected.json';
test('original puzzle has 32 clues and exactly one valid solution',()=>{assert.equal(expected.filter(Boolean).length,32);const {count,solution}=solve(expected);assert.equal(count,1);assert.ok(solution);assert.ok(solution.every(Boolean));assert.ok(validBoard(solution));expected.forEach((v,i)=>{if(v)assert.equal(solution[i],v);});});
test('duplicate clues are rejected',()=>{const b=emptyBoard();b[0]=b[8]=1;assert.equal(solve(b).count,0);assert.equal(validBoard(b),false);});
test('ambiguous puzzle is detected',()=>assert.equal(solve(emptyBoard()).count,2));
test('invalid input is rejected',()=>{assert.equal(validBoard([1]),false);const b=emptyBoard();b[0]=10;assert.equal(validBoard(b),false);});
test('peers include row, column and box, but not unrelated cells',()=>{assert.ok(peers(0,8));assert.ok(peers(0,72));assert.ok(peers(0,20));assert.equal(peers(0,40),false);});
