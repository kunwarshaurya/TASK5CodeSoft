const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Online Quiz System API',
    version: '1.0.0',
    description: 'Online Quiz System REST API — CodSoft Backend Development Internship Task 5. Supports admin quiz management, participant attempts, server-side scoring with negative marking, time limits, leaderboards, and certificate eligibility.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Quiz: { type: 'object', properties: { _id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, status: { type: 'string', enum: ['draft', 'published', 'unpublished'] }, timeLimitMinutes: { type: 'integer' }, passingScore: { type: 'number' }, negativeMarking: { type: 'boolean' }, shuffleQuestions: { type: 'boolean' }, maxAttempts: { type: 'integer' }, totalQuestions: { type: 'integer' }, totalMarks: { type: 'number' } } },
      Question: { type: 'object', properties: { _id: { type: 'string' }, text: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { _id: { type: 'string' }, text: { type: 'string' } } } }, marks: { type: 'integer' } } },
      Attempt: { type: 'object', properties: { _id: { type: 'string' }, quiz: { type: 'string' }, participant: { type: 'string' }, status: { type: 'string', enum: ['in-progress', 'submitted', 'expired'] }, startedAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time' }, scoredMarks: { type: 'number' }, percentage: { type: 'number' }, passed: { type: 'boolean' } } },
    },
  },
  paths: {
    '/health': { get: { tags: ['Health'], summary: 'Health check', responses: { 200: { description: 'OK' } } } },
    '/auth/register': { post: { tags: ['Auth'], summary: 'Register participant', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 201: { description: 'Registered' } } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Login', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'Login successful' } } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current user', security: [{ bearerAuth: [] }], responses: { 200: { description: 'User profile' } } } },
    '/quizzes': {
      get: { tags: ['Quizzes'], summary: 'List quizzes (participants see published only)', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Quiz list' } } },
      post: { tags: ['Quizzes'], summary: 'Create quiz (admin)', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, timeLimitMinutes: { type: 'integer' }, passingScore: { type: 'number' }, negativeMarking: { type: 'boolean' }, negativeMarkingPenalty: { type: 'number' }, shuffleQuestions: { type: 'boolean' }, shuffleOptions: { type: 'boolean' }, maxAttempts: { type: 'integer' } } } } } }, responses: { 201: { description: 'Quiz created' } } },
    },
    '/quizzes/{quizId}': {
      get: { tags: ['Quizzes'], summary: 'Get quiz', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Quiz details' } } },
      patch: { tags: ['Quizzes'], summary: 'Update quiz (admin)', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Quizzes'], summary: 'Delete quiz (admin)', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } },
    },
    '/quizzes/{quizId}/publish': { patch: { tags: ['Quizzes'], summary: 'Publish quiz (admin)', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Published' } } } },
    '/quizzes/{quizId}/unpublish': { patch: { tags: ['Quizzes'], summary: 'Unpublish quiz (admin)', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Unpublished' } } } },
    '/quizzes/{quizId}/questions': {
      get: { tags: ['Questions'], summary: 'List questions (participants see no correct answers)', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Question list' } } },
      post: { tags: ['Questions'], summary: 'Create question (admin)', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text', 'options'], properties: { text: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, isCorrect: { type: 'boolean' } } } }, marks: { type: 'integer' }, explanation: { type: 'string' } } } } } }, responses: { 201: { description: 'Question created' } } },
    },
    '/quizzes/{quizId}/attempts': { post: { tags: ['Attempts'], summary: 'Start a quiz attempt', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Attempt started' } } } },
    '/quizzes/{quizId}/leaderboard': { get: { tags: ['Leaderboard'], summary: 'Quiz leaderboard', security: [{ bearerAuth: [] }], parameters: [{ name: 'quizId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Leaderboard' } } } },
    '/attempts/{attemptId}': { get: { tags: ['Attempts'], summary: 'Get attempt details', security: [{ bearerAuth: [] }], parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Attempt details' } } } },
    '/attempts/{attemptId}/questions': { get: { tags: ['Attempts'], summary: 'Get attempt questions (no correct answers)', security: [{ bearerAuth: [] }], parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Questions' } } } },
    '/attempts/{attemptId}/submit': { post: { tags: ['Attempts'], summary: 'Submit answers', security: [{ bearerAuth: [] }], parameters: [{ name: 'attemptId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['answers'], properties: { answers: { type: 'array', items: { type: 'object', properties: { questionId: { type: 'string' }, selectedOptionId: { type: 'string', nullable: true } } } } } } } } }, responses: { 200: { description: 'Scored result' } } } },
    '/users/me/results': { get: { tags: ['Results'], summary: 'My quiz results', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Result history' } } } },
    '/admin/statistics': { get: { tags: ['Admin'], summary: 'Quiz statistics (admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Statistics' } } } },
  },
};

export default swaggerDocument;
