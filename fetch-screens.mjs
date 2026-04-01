import fs from 'fs';
import path from 'path';

const screens = [
  { id: 'login', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2M4ZjQ3ODRlNmZjYTQxOGFhYzUzZTc2MmVlYTYwMzdjEgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' },
  { id: 'dashboard', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzA2ZmEzMzljNmFkODRiM2ZhOWMzYzg5MWNhYWQ5MDliEgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' },
  { id: 'weather', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzQxYmU4OWY0MDlkZTQ1NWViNTI0ZjY0ZmE1YjU5OTUyEgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' },
  { id: 'chat', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzUxNjUyYjQ5ZWVlNDQ5MjBhMjAzZjUzZjFlNzVkNTJjEgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' },
  { id: 'alerts', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2M1MzYzNjQwODcxNjRmYTZhYmI3NzBhZjMyMDhkOTRmEgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' },
  { id: 'reports', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzM3MjA1MmQ0Zjg2ZDQzYWU4M2UzNGY1ZjM3MmRhZjk4EgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' },
  { id: 'landing', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2ZiZWM5MjdjMjlhMDRiMTVhYjBlMDI1OWIxMjYwNzZlEgsSBxD2g7r3oRkYAZIBIwoKcHJvamVjdF9pZBIVQhMzNzQ4NzM1MzE0NzQ5MTM4Njk2&filename=&opi=89354086' }
];

async function download() {
  const dir = path.join(process.cwd(), '.stitch', 'designs');
  fs.mkdirSync(dir, { recursive: true });
  
  for (const s of screens) {
    console.log(`Downloading ${s.id}...`);
    try {
      const res = await fetch(s.url);
      const text = await res.text();
      fs.writeFileSync(path.join(dir, `${s.id}.html`), text);
      console.log(`Saved ${s.id}.html`);
    } catch (e) {
      console.error(`Failed ${s.id}`, e);
    }
  }
}

download();
