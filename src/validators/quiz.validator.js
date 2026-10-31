import { z } from 'zod';

export const createQuizSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional().default(''),
  category: z.string().trim().max(100).optional().default('General'),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).optional().default(30),
  passingScore: z.coerce.number().min(0).max(100).optional().default(50),
  negativeMarking: z.boolean().optional().default(false),
  negativeMarkingPenalty: z.coerce.number().min(0).max(1).optional().default(0.25),
  shuffleQuestions: z.boolean().optional().default(false),
  shuffleOptions: z.boolean().optional().default(false),
  maxAttempts: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export const updateQuizSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(100).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).optional(),
  passingScore: z.coerce.number().min(0).max(100).optional(),
  negativeMarking: z.boolean().optional(),
  negativeMarkingPenalty: z.coerce.number().min(0).max(1).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(100).optional(),
});

export const quizQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published', 'unpublished']).optional(),
  sortBy: z.enum(['createdAt', 'title', 'category']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
