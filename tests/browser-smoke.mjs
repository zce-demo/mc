import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'load'});
  await page.locator('#mission').getByText('连接世界').waitFor();
  assert.equal(await page.locator('#map').count(),1);
  const canvas=page.locator('#map'),box=await canvas.boundingBox();
  assert.ok(box && box.width>1000 && box.height>700);
  // Camera initially starts at (-10,-7) and the default tile size is 40px.
  // Paint three tiles adjacent to the existing city hall road at (0,0).
  await page.mouse.move(420,340);
  await page.mouse.down();
  await page.mouse.move(420,420,{steps:12});
  await page.mouse.up();
  await page.locator('#mission').getByText('有人住，也有工作').waitFor();
  await page.locator('[data-tool=home]').click();
  await page.mouse.click(460,340);
  assert.match(await page.locator('#stats').innerText(),/2,|2\d{3}|\d/);
  await page.locator('[data-tab=finance]').click();
  await page.locator('#panel').getByText('预计每日结余').waitFor();
  await page.locator('[data-tab=service]').click();
  await page.locator('#panel').getByText('教育').first().waitFor();
  assert.deepEqual(errors,[]);
  await page.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  mobile.on('pageerror',err=>errors.push(err.message));
  await mobile.goto('http://127.0.0.1:5173/',{waitUntil:'load'});
  await mobile.locator('#mission').waitFor();
  assert.equal(await mobile.locator('#map').count(),1);
  assert.deepEqual(errors,[]);
  await mobile.close();
  console.log('Browser smoke: canvas, guided road painting, housing, finance, services, mobile — OK');
} finally {
  await browser.close();
}
