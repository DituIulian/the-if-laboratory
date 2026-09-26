import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['index.html','styles.css','app.js','content.js','engine.js','effects.js','scenes.js','analytics.js','classroom.js','teacher-ui.js','backend.js','config.js','favicon.svg']) await copyFile(name, `dist/${name}`);
await cp('assets', 'dist/assets', { recursive: true });
if (process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Both Supabase environment variables are required.');
  await writeFile('dist/config.js', `window.LAB_CONFIG = ${JSON.stringify({supabaseUrl:process.env.SUPABASE_URL,supabaseKey:process.env.SUPABASE_PUBLISHABLE_KEY})};\n`);
}
console.log('Ready for Netlify: dist/');
