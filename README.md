# Task 5 — Online Quiz System

A secure online quiz backend with administrator quiz management, participant attempts, server-side scoring, negative marking, time limits, leaderboards, and certificate eligibility.

**This is the most feature-rich of the three internship projects.**

---

## 📋 Project Overview

### Problem Statement
Build a complete online quiz system backend that supports quiz creation by administrators, timed quiz attempts by participants, secure server-side score calculation, and result tracking — with critical security requirements around answer protection and attempt validation.

### CodSoft Requirement Mapping
This project fulfills **CodSoft Backend Development Internship — Task 5: Online Quiz System**.

---

## ✨ Features

### Administrator Features
- Create, update, and delete quizzes
- Add multiple-choice questions with configurable correct answers
- Configure quiz settings (time limit, passing score, negative marking, shuffle, max attempts)
- Publish and unpublish quizzes
- View all quiz attempts and results
- View platform-wide statistics (total quizzes, pass rate, most attempted)

### Participant Features
- Register and login
- Browse published quizzes
- Start timed quiz attempts
- Receive questions **without** correct answer information
- Submit answers within the time limit
- View scored results and attempt history
- View quiz leaderboards

### Security Features
- ✅ Correct answers **never** exposed in participant-facing responses
- ✅ Server-side score calculation (client cannot determine score)
- ✅ Answer validation against the active attempt's question set
- ✅ Attempt ownership enforcement
- ✅ Server-side timer enforcement (expiry checked on submission)
- ✅ Idempotent submission (retries return same result, no duplicate scoring)
- ✅ Published status and attempt limit checked server-side
- ✅ Explicit DTO-style serializers (`toParticipantJSON` / `toAdminJSON`)
- ✅ Role escalation prevention at registration

### Bonus Features
- ⏱ Quiz time limits with server-side expiry
- ➖ Configurable negative marking
- 🔀 Random question ordering (shuffle)
- 🔀 Random option ordering (shuffle)
- 📊 Configurable passing score
- 🏆 Certificate eligibility flag
- 🔄 Configurable attempt limits / retakes

---

## 🛠 Technology Stack

| Technology | Purpose |
|-----------|---------|
| Node.js | Runtime |
| Express.js | Web framework |
| MongoDB | Database |
| Mongoose | ODM |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Zod | Validation |
| Helmet | Security headers |
| express-rate-limit | Rate limiting |
| Swagger UI | API docs |
| Jest + Supertest | Testing |

---

## 🏗 Architecture

```
Request → Routes → Auth Middleware → Role Authorization → Validation → Controller → Service → Model → MongoDB
```

### Folder Structure

```
Task-5-Online-Quiz-System/
├── package.json
├── jest.config.js
├── .env.example
├── src/
│   ├── app.js, server.js
│   ├── config/                    (index.js, database.js)
│   ├── models/
│   │   ├── User.js               (participant/admin roles)
│   │   ├── Quiz.js               (settings, status)
│   │   ├── Question.js           (options with isCorrect, serializers)
│   │   └── Attempt.js            (answers, scoring, timer)
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── quiz.routes.js        (quizzes + nested questions + attempts)
│   │   ├── attempt.routes.js     (submission + questions)
│   │   ├── user.routes.js        (results)
│   │   ├── admin.routes.js       (statistics)
│   │   └── health.routes.js
│   ├── controllers/               (auth, quiz, question, attempt)
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── quiz.service.js       (CRUD, publish, stats)
│   │   ├── question.service.js   (CRUD with admin/participant split)
│   │   └── attempt.service.js    (start, submit, score, leaderboard)
│   ├── middleware/, validators/, utils/, docs/
├── scripts/
│   └── seed-admin.js
├── tests/
└── postman/
```

---

## 💾 Database Schema & Design Decisions

### Why This Model Design

- **Quiz ↔ Question**: One-to-many via reference. Questions reference their quiz. This allows independent question management and efficient quiz publishing (count questions, sum marks).
- **Attempt embeds answers**: Answers are embedded in the Attempt document because they're always accessed together and don't need independent querying. This improves read performance for result display.
- **Question order stored in Attempt**: The `questionOrder` array in Attempt preserves the shuffled order for each participant, ensuring consistent question presentation during the attempt.
- **No separate Result model**: The Attempt model contains all scoring fields. A separate Result model would add complexity without genuine value since there's a 1:1 relationship.

### User
| Field | Type | Details |
|-------|------|---------|
| name | String | Required |
| email | String | Unique |
| password | String | Hashed, never returned |
| role | String | `participant` / `admin` |

### Quiz
| Field | Type | Details |
|-------|------|---------|
| title | String | Required |
| description | String | Optional |
| category | String | Default: General |
| status | String | `draft` / `published` / `unpublished` |
| createdBy | ObjectId | Reference to admin User |
| timeLimitMinutes | Number | Default: 30 |
| passingScore | Number | Percentage, default: 50 |
| negativeMarking | Boolean | Default: false |
| negativeMarkingPenalty | Number | Fraction 0-1, default: 0.25 |
| shuffleQuestions | Boolean | Default: false |
| shuffleOptions | Boolean | Default: false |
| maxAttempts | Number | Default: 1 |
| totalQuestions | Number | Auto-calculated |
| totalMarks | Number | Auto-calculated |

### Question
| Field | Type | Details |
|-------|------|---------|
| quiz | ObjectId | Reference to Quiz |
| text | String | Question text |
| options | Array | 2-6 options with `text` and `isCorrect` |
| marks | Number | Default: 1 |
| explanation | String | Shown after submission |
| order | Number | Display order |

**CRITICAL**: `isCorrect` on options is **never** returned in participant-facing responses. The `toParticipantJSON()` method strips it. The `toAdminJSON()` method includes it.

### Attempt
| Field | Type | Details |
|-------|------|---------|
| quiz | ObjectId | Reference to Quiz |
| participant | ObjectId | Reference to User |
| status | String | `in-progress` / `submitted` / `expired` |
| startedAt | Date | When attempt began |
| expiresAt | Date | Calculated from quiz time limit |
| submittedAt | Date | When answers submitted |
| questionOrder | [ObjectId] | Shuffled question IDs for this attempt |
| answers | [Embedded] | `{ question, selectedOption, isCorrect, marksAwarded }` |
| totalMarks | Number | From quiz |
| scoredMarks | Number | Calculated server-side |
| percentage | Number | Calculated |
| correctCount | Number | Count |
| wrongCount | Number | Count |
| unansweredCount | Number | Count |
| passed | Boolean | percentage >= passingScore |
| certificateEligible | Boolean | Same as passed |

---

## 📐 Scoring Formula

```
For each question:
  if correct:    marksAwarded = question.marks
  if wrong:      marksAwarded = -(question.marks × negativeMarkingPenalty)
  if unanswered: marksAwarded = 0

scoredMarks = max(0, sum of all marksAwarded)
percentage  = (scoredMarks / totalMarks) × 100
passed      = percentage >= quiz.passingScore
```

- **Negative marking penalty** is a fraction (0-1). Default 0.25 means 25% of the question's marks are deducted for a wrong answer.
- **Floor at 0**: Total scored marks cannot go below 0.
- **Percentage**: Rounded to 2 decimal places.

---

## 🔄 Quiz Lifecycle

1. Admin creates a quiz (status: `draft`)
2. Admin adds questions with options and correct answers
3. Admin configures settings (time limit, passing score, etc.)
4. Admin publishes the quiz → status: `published`, `totalQuestions` and `totalMarks` calculated
5. Participant views published quiz catalog
6. Participant starts an attempt → server creates attempt with `startedAt`, `expiresAt`, and shuffled `questionOrder`
7. Participant receives questions **without** `isCorrect` or `explanation`
8. Participant submits answers within time limit
9. Server validates: ownership, attempt status, time limit, option IDs
10. Server calculates score with negative marking
11. Server stores result and marks attempt as `submitted`
12. Subsequent submissions of same attempt return existing result (idempotent)
13. Participant views results and leaderboard

---

## 📦 Prerequisites

- Node.js v18+
- MongoDB v6+
- npm v9+

---

## 🚀 Installation & Setup

```bash
cd Task-5-Online-Quiz-System
npm install
cp .env.example .env
# Edit .env with your values
npm run seed    # Create admin user
npm run dev     # Start on port 5003
```

### Browser UI

The quiz frontend is served by the same Express server. Start the backend and open **http://localhost:5003**. Participants can browse published quizzes, take timed attempts, and review results. Admins can manage quizzes and questions and review participant scores. Admin access uses the account created with `npm run seed`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5003` |
| `MONGODB_URI` | MongoDB URI | Required |
| `JWT_SECRET` | JWT signing key | Required |
| `DEFAULT_QUIZ_TIME_LIMIT_MINUTES` | Default quiz time | `30` |
| `DEFAULT_PASSING_SCORE` | Default passing % | `50` |
| `DEFAULT_NEGATIVE_MARKING_PENALTY` | Default penalty fraction | `0.25` |
| `DEFAULT_MAX_ATTEMPTS` | Default max attempts | `1` |
| `ADMIN_EMAIL` | Seed admin email | `admin@quizsystem.com` |
| `ADMIN_PASSWORD` | Seed admin password | `Admin@123456` |

---

## 🔗 API Endpoints

**Base URL:** `http://localhost:5003/api/v1`

### Authentication
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | `/auth/register` | No | — |
| POST | `/auth/login` | No | — |
| GET | `/auth/me` | Yes | Any |

### Quizzes
| Method | Endpoint | Auth | Role | Notes |
|--------|----------|------|------|-------|
| GET | `/quizzes` | Yes | Any | Participants see published only |
| POST | `/quizzes` | Yes | Admin | Create quiz |
| GET | `/quizzes/:quizId` | Yes | Any | |
| PATCH | `/quizzes/:quizId` | Yes | Admin | Update settings |
| DELETE | `/quizzes/:quizId` | Yes | Admin | Only if no attempts |
| PATCH | `/quizzes/:quizId/publish` | Yes | Admin | Requires ≥1 question |
| PATCH | `/quizzes/:quizId/unpublish` | Yes | Admin | |

### Questions
| Method | Endpoint | Auth | Role | Notes |
|--------|----------|------|------|-------|
| GET | `/quizzes/:quizId/questions` | Yes | Any | **Participants: no isCorrect** |
| POST | `/quizzes/:quizId/questions` | Yes | Admin | Include options with isCorrect |
| GET | `/quizzes/:quizId/questions/:questionId` | Yes | Any | |
| PATCH | `/quizzes/:quizId/questions/:questionId` | Yes | Admin | |
| DELETE | `/quizzes/:quizId/questions/:questionId` | Yes | Admin | |

### Attempts
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | `/quizzes/:quizId/attempts` | Yes | Any | Start attempt |
| GET | `/quizzes/:quizId/attempts` | Yes | Admin | All attempts for quiz |
| GET | `/attempts/:attemptId` | Yes | Owner/Admin | Attempt details |
| GET | `/attempts/:attemptId/questions` | Yes | Owner | **No correct answers** |
| POST | `/attempts/:attemptId/submit` | Yes | Owner | Submit + score |

### Results & Leaderboard
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/users/me/results` | Yes | Any | My submitted results |
| GET | `/quizzes/:quizId/leaderboard` | Yes | Any | Top scores |

### Admin
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/admin/statistics` | Yes | Admin | Platform statistics |

---

## 📝 Example Requests

### Create Quiz (Admin)
```bash
curl -X POST http://localhost:5003/api/v1/quizzes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "title": "JavaScript Fundamentals",
    "category": "Programming",
    "timeLimitMinutes": 15,
    "passingScore": 60,
    "negativeMarking": true,
    "negativeMarkingPenalty": 0.25,
    "maxAttempts": 3
  }'
```

### Add Question (Admin)
```bash
curl -X POST http://localhost:5003/api/v1/quizzes/QUIZ_ID/questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "text": "What does typeof null return?",
    "options": [
      {"text": "null", "isCorrect": false},
      {"text": "object", "isCorrect": true},
      {"text": "undefined", "isCorrect": false},
      {"text": "string", "isCorrect": false}
    ],
    "marks": 2,
    "explanation": "typeof null returns object due to a historical JavaScript bug"
  }'
```

### Start Attempt (Participant)
```bash
curl -X POST http://localhost:5003/api/v1/quizzes/QUIZ_ID/attempts \
  -H "Authorization: Bearer PARTICIPANT_TOKEN"
```

### Submit Answers
```bash
curl -X POST http://localhost:5003/api/v1/attempts/ATTEMPT_ID/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer PARTICIPANT_TOKEN" \
  -d '{
    "answers": [
      {"questionId": "Q1_ID", "selectedOptionId": "OPTION_ID"},
      {"questionId": "Q2_ID", "selectedOptionId": null}
    ]
  }'
```

---

## 📚 API Documentation

- **Swagger UI:** http://localhost:5003/api/v1/docs
- **Postman:** Import `postman/Online_Quiz_System_API.postman_collection.json`

---

## 🧪 Testing

```bash
npm test
npm run test:verbose
```

### Test Coverage
- Registration and login
- Role escalation prevention
- Participant blocked from admin endpoints
- Quiz CRUD and publishing lifecycle
- Cannot publish empty quiz
- **Answer security: `isCorrect` never in participant question responses**
- **Answer security: `isCorrect` never in attempt question responses**
- Admin sees `isCorrect` in question responses
- Attempt start with expiry calculation
- Score calculation — all correct (100%)
- Negative marking calculation
- Idempotent submission (retry returns same result)
- Max attempts enforcement
- Attempt ownership (can't access others' attempts)
- Time limit expiry enforcement
- Result history
- Leaderboard
- Health check

---

## 🔒 Security Decisions

| Decision | Implementation |
|----------|---------------|
| Answer protection | `toParticipantJSON()` strips `isCorrect` from all options and `explanation` from questions |
| Score integrity | Score calculated entirely server-side; client submits only option IDs |
| Answer validation | Each submitted optionId validated against the question's actual options |
| Attempt ownership | Every attempt operation checks `participant === req.user._id` |
| Timer enforcement | `expiresAt` checked server-side on submission; expired attempts rejected |
| Idempotent submission | If attempt already `submitted`, return existing result (prevents double-scoring) |
| Published check | Only published quizzes can be attempted |
| Attempt limits | Server checks count of submitted/expired attempts before allowing new ones |
| Role escalation | Public registration always assigns `participant` role |

---

## ⚠️ Known Limitations

- Timer is checked at submission time, not continuously enforced (no server push)
- No real-time WebSocket updates for timer countdown
- Question randomization is per-attempt, not per-question-bank
- No image support in questions
- No partial credit scoring
- Certificate eligibility is a boolean flag; no actual certificate generation

---

## 🔮 Future Improvements

- WebSocket-based real-time timer with auto-submit
- Question bank with random selection (N of M)
- Image/media support in questions
- Partial credit for multiple-correct questions
- PDF certificate generation
- Analytics dashboard per quiz
- Question difficulty levels
- Anti-cheating measures (tab-switch detection)
- Export results to CSV
