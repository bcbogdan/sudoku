import {test,expect} from '@playwright/test';
import path from 'node:path';
import expected from './fixtures/expected.json';
import {solve} from '../lib/sudoku';
test('original image: local OCR, review, and game interactions',async({page})=>{
 const errors:string[]=[];const uploads:string[]=[];const external:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(request.method()==='POST')uploads.push(request.url());if(!/^(http:\/\/127\.0\.0\.1|blob:|data:)/.test(request.url()))external.push(request.url());});
 await page.goto('/');
 await page.getByLabel('Choose a Sudoku photo',{exact:true}).setInputFiles(path.resolve('tests/fixtures/original.jpeg'));
 await expect(page.getByRole('heading',{name:'Check the clues.'})).toBeVisible({timeout:150000});
 const actual=await page.locator('.cell').evaluateAll(cells=>cells.map(cell=>Number(cell.getAttribute('data-value'))));
 const differences=actual.flatMap((v,i)=>v!==expected[i]?[{row:Math.floor(i/9)+1,column:i%9+1,expected:expected[i],actual:v}]:[]);
 console.log(JSON.stringify({recognizedClues:actual.filter(Boolean).length,correctClues:actual.filter((v,i)=>v&&v===expected[i]).length,missedClues:actual.filter((v,i)=>!v&&expected[i]).length,falsePositives:actual.filter((v,i)=>v&&!expected[i]).length,differences,uploads,external,errors},null,2));
 expect(actual).toEqual(expected);expect(uploads).toEqual([]);expect(external).toEqual([]);expect(errors).toEqual([]);
 await page.getByRole('button',{name:'Confirm clues & play'}).click();
 await expect(page.getByRole('heading',{name:'Make your move.'})).toBeVisible();
 await expect(page.locator('.cell[data-given=true]')).toHaveCount(32);
 await page.locator('#cell-5').click();await page.getByRole('button',{name:'Enter 1',exact:true}).click();await expect(page.locator('#cell-5')).toHaveAttribute('data-value','5');
 await expect(page.locator('.cell.match')).toHaveCount(2);await expect(page.locator('.cell.peer')).toHaveCount(21);
 await page.locator('#cell-0').click();await page.getByRole('button',{name:'Pencil notes'}).click();await page.getByRole('button',{name:'Enter 1',exact:true}).click();await page.getByRole('button',{name:'Enter 2',exact:true}).click();
 await expect(page.locator('#cell-0 .notes')).toHaveText('12');await expect(page.locator('#cell-0')).toHaveAttribute('data-value','0');
 await page.getByRole('button',{name:'Pencil notes'}).click();const correct=solve(expected).solution![0],wrong=correct===1?2:1;
 await page.getByRole('button',{name:`Enter ${wrong}`,exact:true}).click();await expect(page.locator('#cell-0')).toHaveAttribute('data-wrong','true');await expect(page.locator('.mistakes')).toHaveText('Mistakes 1');
 await page.getByRole('button',{name:'Mistake check'}).click();await expect(page.locator('#cell-0')).toHaveAttribute('data-wrong','false');
 await page.getByRole('button',{name:`Enter ${correct}`,exact:true}).click();await expect(page.locator('#cell-0')).toHaveAttribute('data-value',String(correct));
 await page.getByRole('button',{name:'Reset entries',exact:true}).click();await expect(page.locator('#cell-0')).toHaveAttribute('data-value','0');await expect(page.locator('.mistakes')).toHaveText('Mistakes 0');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 expect(errors).toEqual([]);
});
test('manual review rejects incomplete and conflicting puzzles',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Enter clues by hand'}).click();await page.getByRole('button',{name:'Confirm clues & play'}).click();await expect(page.getByRole('status')).toContainText('at least 17');
 for(let i=0;i<81;i++)if(expected[i]){await page.locator(`#cell-${i}`).click();await page.keyboard.press(String(expected[i]));}
 await page.locator('#cell-0').click();await page.keyboard.press('5');await page.getByRole('button',{name:'Confirm clues & play'}).click();await expect(page.getByRole('status')).toContainText('conflict');
});
