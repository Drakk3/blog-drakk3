import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),

    audio: z.string().optional(),
    audioTitle: z.string().optional(),
    audioStartTime: z.coerce.number().optional(),

    categories: z.array(z.string()).default(['others']),
    tags: z.array(z.string()).default(['others']),
    authors: z.array(z.string()).default(['drakk3']),
  }),
});

export const collections = { blog };
