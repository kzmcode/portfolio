import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { workSchema } from './content/work-schema.mjs';

// 作品は 1 作品 1 フォルダ：src/content/works/<slug>/work.yaml（＋ preview.mp4・poster.*）。id = フォルダ名 = slug
const works = defineCollection({
  loader: glob({ pattern: '*/work.yaml', base: './src/content/works', generateId: ({ entry }) => entry.split('/')[0] }),
  schema: workSchema(z),
});

export const collections = { works };
