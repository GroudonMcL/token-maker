// Makes the test pictures used by the end-to-end tests:
// e2e/fixtures/goblin-boss.png and e2e/fixtures/flat-knight.png (flat background, for removal).
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

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
writeFileSync('e2e/fixtures/goblin-boss.png', c.toBuffer('image/png'));
console.log('Wrote e2e/fixtures/goblin-boss.png');

// A knight on a flat white background with a grey shadow at its feet.
const k = createCanvas(600, 600);
const b = k.getContext('2d');
b.fillStyle = '#ffffff';
b.fillRect(0, 0, 600, 600);
b.fillStyle = '#9a9a9a';
b.beginPath();
b.ellipse(300, 560, 170, 26, 0, 0, Math.PI * 2);
b.fill();
b.fillStyle = '#2f4f7f'; // body
b.fillRect(200, 260, 200, 300);
b.fillStyle = '#c9ced6'; // helmet
b.beginPath();
b.arc(300, 180, 90, 0, Math.PI * 2);
b.fill();
b.fillStyle = '#ffffff'; // a white visor slot, enclosed by the helmet
b.fillRect(250, 170, 100, 18);
writeFileSync('e2e/fixtures/flat-knight.png', k.toBuffer('image/png'));
console.log('Wrote e2e/fixtures/flat-knight.png');
