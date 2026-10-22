// Makes the test pictures used by the end-to-end tests and help images:
//   e2e/fixtures/goblin-boss.png   a goblin on a sky-and-hill background
//   e2e/fixtures/flat-goblin.png   the same goblin on a plain white background
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

function goblin(a: SKRSContext2D) {
  a.fillStyle = '#5f8a3a'; // head
  a.beginPath();
  a.ellipse(300, 290, 110, 125, 0, 0, Math.PI * 2);
  a.fill();
  a.beginPath(); // ears
  a.moveTo(195, 270);
  a.lineTo(90, 210);
  a.lineTo(200, 320);
  a.moveTo(405, 270);
  a.lineTo(510, 210);
  a.lineTo(400, 320);
  a.fill();
  a.fillStyle = '#f2d16b';
  for (const x of [255, 345]) {
    a.beginPath();
    a.arc(x, 270, 18, 0, Math.PI * 2);
    a.fill();
  }
  a.fillStyle = '#7a2e2e'; // body
  a.fillRect(170, 410, 260, 400);
}

const c = createCanvas(600, 800);
const a = c.getContext('2d');
const sky = a.createLinearGradient(0, 0, 0, 800);
sky.addColorStop(0, '#3d5a80');
sky.addColorStop(1, '#98c1d9');
a.fillStyle = sky;
a.fillRect(0, 0, 600, 800);
a.fillStyle = '#4a6b3a';
a.beginPath();
a.ellipse(300, 820, 420, 220, 0, 0, Math.PI * 2);
a.fill();
goblin(a);
writeFileSync('e2e/fixtures/goblin-boss.png', c.toBuffer('image/png'));

const flat = createCanvas(600, 800);
const f = flat.getContext('2d');
f.fillStyle = '#fbfbf8';
f.fillRect(0, 0, 600, 800);
goblin(f);
writeFileSync('e2e/fixtures/flat-goblin.png', flat.toBuffer('image/png'));
console.log('Wrote e2e/fixtures/goblin-boss.png and e2e/fixtures/flat-goblin.png');
