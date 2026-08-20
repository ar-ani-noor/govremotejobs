import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    relatedHubs: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  }),
})

export const collections = { guides }
