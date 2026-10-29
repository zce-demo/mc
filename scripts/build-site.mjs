import {cp,mkdir,copyFile,rm} from 'node:fs/promises';
await rm('site',{recursive:true,force:true});
await mkdir('site',{recursive:true});
await copyFile('index.html','site/index.html');
await copyFile('style.css','site/style.css');
await cp('dist','site/dist',{recursive:true});
console.log('Built GitHub Pages site/ with relative asset paths');
