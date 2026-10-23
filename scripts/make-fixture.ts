// Makes the test pictures used by the end-to-end tests and help images:
//   e2e/fixtures/goblin-boss.png   a goblin on a sky-and-hill background (also public/sample/goblin.png)
//   e2e/fixtures/flat-goblin.png   the same goblin on a plain white background
//   e2e/fixtures/purple-ring.png   a picture frame: a purple ring with a see-through middle
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
// The same goblin is the sample picture new visitors can try (Phase 10).
writeFileSync('public/sample/goblin.png', c.toBuffer('image/png'));

const flat = createCanvas(600, 800);
const f = flat.getContext('2d');
f.fillStyle = '#fbfbf8';
f.fillRect(0, 0, 600, 800);
goblin(f);
writeFileSync('e2e/fixtures/flat-goblin.png', flat.toBuffer('image/png'));
// A ring frame like one a user might upload: solid purple between 72 % and
// 96 % of the half-size, with gold studs, see-through inside and outside.
const ring = createCanvas(512, 512);
const r = ring.getContext('2d');
r.fillStyle = '#7a3fc0';
r.beginPath();
r.arc(256, 256, 256 * 0.96, 0, Math.PI * 2);
r.arc(256, 256, 256 * 0.72, 0, Math.PI * 2, true);
r.fill();
r.fillStyle = '#f0c040';
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  r.beginPath();
  r.arc(256 + Math.cos(a) * 256 * 0.84, 256 + Math.sin(a) * 256 * 0.84, 12, 0, Math.PI * 2);
  r.fill();
}
writeFileSync('e2e/fixtures/purple-ring.png', ring.toBuffer('image/png'));
console.log('Wrote e2e/fixtures/goblin-boss.png, flat-goblin.png and purple-ring.png, and public/sample/goblin.png');
