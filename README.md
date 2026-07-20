# SATrack
**Generate mnemonics. Practice questions. Track your proress. All in one place.**

[![Built for Hack Club Macondo](https://img.shields.io/badge/Built%20for-Hack%20Club%20Macondo-blue?style=for-the-badge)](https://macondo.hackclub.com) [![Made with Node.js](https://img.shields.io/badge/Made%20with-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org) [![Powered by Supabase](https://img.shields.io/badge/Powered%20by-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com) [![AI Powered](https://img.shields.io/badge/AI%20Powered-RAG-blueviolet?style=for-the-badge)](#how-it-works) [![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](#license) [![PRs Welcome](https://img.shields.io/badge/PRs%20Welcome-brightgreen?style=for-the-badge)](#contributing)
---

## Story Time!! (Why I Built This?)

As a gap year student, I struggled significantly with SAT prep last year (my senior year): the lack of free resources available for HALI students reduced my score significantly, and let's be real, SAT prep tools are either *expensive*, *boring*, or both. I went through this hard race and barely could make it, so I wanted to build something that actually helps — not just another question bank, but a full study companion that:

1. Generates **mnemonic devices** for vocabulary words (yes, this damn section) so you can actually *remember* or *retrieve* ~~a nerdy joke~~ the words, inspired by Charles Gulotta's book: [500 Key Words for the SAT: And How To Remember Them Forever!](https://www.goodreads.com/book/show/656272.500_Key_Words_for_the_SAT).
2. Uses **RAG (Retrieval-Augmented Generation)** to pull similar examples from a real question bank before generating new content.
3. Tracks your weaknesses and **adapts** to serve you questions where you need the most practice.
4. Feels like the **real test** with a Bluebook-style practice interface.

> Built this as a high schooler for high schoolers. No subscriptions, no paywalls. Just bring your own API keys after 5 free monthly generations (I will add a video tutorial on how to get your keys) and you're good to go.
---

## Features:
### Vocabulary Builder:
1. **AI-Powered Mnemonics**: Enter any word, get a full vocabulary entry with pronunciation, definition, mnemonic device, picture story, other forms, and example sentences.
2. **RAG-Enhanced Generation**: The system retrieves similar vocabulary entries from the database as style references before generating, so every entry feels much more authentic.
3. **Quality Assurance**: Dual validation system with both rule-based quality checking (authenticity, creativity, accuracy, completeness, and format) and LLM-based evaluation (YESSS, LLMs Checking on LLMs).
4. **Regeneration with Feedback**: Not happy with an entry? (tbh this will happen a lot as AI still sucks) Regenerate with specific instructions. Your feedback improves future generations, **the more you use the model, the smarter it becomes for you and the others**.
 5. **Word Lists**: Create, manage, clone, share (via email or public links), and export (CSV or print format) vocabulary lists, autogenerate a *"your mistakes list"*.
 6. **Daily Word**: A rotating vocabulary word each day to keep you sharp.

 ### SAT Practice:
 1. **Real Question Bank**: Thousands of the **OFFICIAL College Board SAT questions** covering Reading, Writing, and Math, I mean we all know that the College Board's Website's format sucks.
 2. **AI Question Generation**: If you haven't finish the College Board's Bank then you are not training well, and when you does you will be desperate in getting new questions that is *similar* to the actuall test bank, and guess what? this is exactly why RAG was made. You can generate new questions by subject, topic, subtopic, and difficulty using RAG.
 3. **Bluebook-Style UI**: A custom practice interface that mimics the official College Board Bluebook testing app with a: passage panel, question panel, option elimination, timer, question palette, and mark-for-review.
 4. **Adaptive Practice**: Analyzes your weakest topics and automatically serves questions at the appropriate difficulty, avoiding already-solved questions and already-mastered topics.
 5. **Extensive Filtering**: Filter by subject, topic, subtopic, difficulty, source (College Board vs AI vs who know what's next?), status, and text search.
 6. **Answer Tracking**: Tracks correct/incorrect answers, time spent, attempt count, best time, and speed percentile.

## Flashcards:
1. **Spaced Repetition**: Implements the SuperMemo SM-2 algorithm (Again/Hard/Good/Easy ratings), just like Anki's Algorithms for optimal review scheduling.
2. **Session Management**: Start flashcard sessions from any vocabulary list or review all cards.
3. **Progress Tracking**: Tracks stage, ease factor, interval, review count, and correct/incorrect counts per card.
4. **Anki Compatible**: Export flashcards as CSV for Anki import; import words from CSV or plain text.

### Dashboard \& Analytics:
1. **Progress Dashboard**: Vocabulary stats, practice stats, weekly activity chart, study streak, daily word, flashcard stats.
2. **Leaderboard**: Public leaderboard ranked by correct answers or accuracy, filterable by grade.
3. **Analytics Page**: Session-by-session performance breakdown performance trends, time analytics.
4. **Topic Breakdown**: Per-topic accuracy analysis to identify your weak areas

### User System (Technical Stuff):
1. **Authentication**: Email/password sign up (by google soon) and login with *remember me* and password reset.
2. **Profiles**: Edit name, school, grade, gender, birthdate, and avatar.
3. **API Key Management**: Bring your own LLM and embedding API keys (5 free generations/month included)
4. **Dark Mode** (not very technical lol): Toggle between dark and light themes.
5. **Keyboard Shortcuts**: Number keys for navigation, T for theme toggle, Space/Enter to flip flashcards.
6. **Bug Reports**: Built in ticket system for reporting issues.

## Try the Demo:
> the app is currently deployed at  **[satbudd.vercel.app](https://satbudd.vercel.app)** — no setup required.

### For Non-Technical Users:
1. Go to  **[satbudd.vercel.app](https://satbudd.vercel.app)**.
2. **Sign Up** with your email and password
3. Complete your profile (name, school, grade)
4. Start exploring: 
- **Vocabulary** &rarr Enter any SAT word and generate a mnemonic entry
- **Practice** &rarr Browse College Board questions or generate new ones
- **Flashcards** &rarr start a spaced repetition session from any word list
- **Dashboard** &rarr Track your progress and see your leaderboard ranking


> **About the 5 free generations:** This isn't a premium tier, I'm just using free [z.ai](https://z.ai) API and if all the requests were from my own key I'd get banned lol. After 5 free generations per month, you can plug in your own API keys in Settings.

---
> [!WARNING]
> **Be careful!** The following sections are technical. 
> Proceed only if you are comfortable with development setup.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js (>=18) |
| **Backend Framework** | Express.js |
| **Templating** | EJS + Express-ejs-layouts |
| **Database** | Supabase (SQL DB + Vector DB) |
| **Authentication** | Supabase built in Auth |
| **AI / LLM** | OpenAI-compitible (This is what OpenCode says) |
| **Embeddings** | Jina AI Embeddings v3 (1024-dim vectors) |
| **Styling** | SCSS (will change later) |
| **Frontend** | Vanilla JavaScript |
| **Validation** | Zod |
| **Security** | Helmet, CORS, and custom rate limiter middleware |
| **Deployment** | Vercel | 
| **Dev Tools** | Nodemon, Sass |
---

## How It Works:

### RAG Pipeline

![image](https://cdn.hackclub.com/019f7f9f-6dd5-7328-b28d-528f7bc0a8a4/image.png)

Each piece of user feedback is stored and used as context for future generations, creating a continuous improvement loop — the more the community uses SATrack, the better it gets.

### Adaptive Practice Engine

![image](https://cdn.hackclub.com/019f7fa0-ff09-7ae9-876f-fbe343ce0731/image.png)

Already-solved questions and mastered topics skipped

### Spaced Repetition (SM-2 Algorithm)
Flashcard scheduling follows the **SuperMemo SM-2 Algorithm**:

| Rating | Meaning | Effect on Schedule |
|-----|------|--------|
|** Again** | Didn't know it | Reset interval, review soon | 
|** Hard **| Knew it with difficulty | Short interval increase |
|** Good **| Knew it correctly | Standard interval increase |
|** Easy **| Knew it instantly | Large interval increase |

Each card tracks its own ease factor, itnerval, and review count — cards you struggle with appear more often and cards you know well fade into the background.

### Embeddings & Vector Search

Every vocabulary entry and SAT question gets a *1024-dimensional vector embedding* (via Jina AI) sorted in PostgreSQL with the *pgvector* extension. This enables:
- **Semantic Search**: Find entries similar in meaning, not just keyword matching.
- **RAG Context REtrieval**: Pull the most relevant examples before generating new content.
- **Question Similarity**: Match generated questions to the style of real College Board questions.

## Setting Up the Environment:
### Prerequisites:
1. **Node.js** >=18
2. **Supabase** project (with pgvector extension enabled)
3. An **LLM API Key** (any OpenAI-compatible endpoint)
4. An **Embedding API key** (e.g., Jina AI)

### 1. Clone the Repo

```bash
git clone https://github.com/Yaseen-Saad/SATRAG.git
cd SATRAG
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Copy the ```example.env``` file and fill in your keys:
```bash
cp .env.example .env
```
Then edit ```.env```:

```bash
# Supabase
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_PASSWORD=YOUR_DATABASE_PASSWORD

# LLM
LLM_API_KEY=YOUR_LLM_API_KEY
LLM_BASE_URL=https://your-llm-provider.com/api/v1
LLM_MODEL=YOUR_MODEL_NAME

# Embedding
EMBEDDING_BASE_URL=https://your-embedding-provider.com/v1
EMBEDDING_MODEL=YOUR_EMBEDDING_MODEL
EMBEDDING_API_KEY=YOUR_EMBEDDING_API_KEY

# App
APP_DOMAIN=http://localhost:3000
PORT=3000
NODE_ENV=development

# Rate Limiting
BURST_WINDOW=10000
BURST_MAX=20
BURST_BLOCK_MS=900000
CLEANUP_INTERVAL=60000

```
### 4. Set Up the Database
Run these SQL files in your *new* Supabase Database's SQL Editor **in order**:
```text
supabase/01_schema.sql      # Tables, RLS policies, indexes
supabase/02_rag.sql          # RAG feedback tables
supabase/03_match_functions.sql  # Vector search functions + auth trigger
```

### 5. Seed the data
```bash
npm run seed
```
This seeds the vocabulary data and the Collegeboard SAT questions into your Supabase database.

### 6. Build the CSS
```bash
npm run build:css
```
### 7. Start the dev server
```bash
npm run dev
```
The app will be running at [http://localhost:3000](http://localhost:3000)

## Project Structure

```text
satbudd/
├── api/                        # Vercel serverless function entry
├── data/
│   ├── sample.txt              # Vocabulary dataset (Gulotta-style entries)
│   └── sat_questions_with_active.json  # SAT question bank
├── scripts/
│   ├── seed.js                 # Seeds vocabulary + questions into Supabase
│   └── generate_embeddings.js  # Batch-generates embeddings for questions
├── supabase/
│   ├── 01_schema.sql           # Database schema + RLS policies
│   ├── 02_rag.sql              # RAG feedback tables
│   └── 03_match_functions.sql  # pgvector match functions
├── src/
│   ├── index.js                # Express app entry point
│   ├── config.js               # Zod-validated env config
│   ├── lib/
│   │   ├── supabase.js         # Supabase client
│   │   ├── llm.js              # LLM service (chat + embeddings, with caching)
│   │   ├── rag.js              # RAG engine (vector search + keyword fallback)
│   │   ├── parser.js           # Vocabulary entry parser
│   │   ├── qualityChecker.js   # Rule-based quality assessment
│   │   └── vocabularyEvaluator.js  # LLM-based evaluation
│   ├── middleware/
│   │   ├── auth.js             # Authentication middleware
│   │   ├── profile.js          # Profile completion check
│   │   ├── rateLimiter.js      # Burst detection + route-specific limits
│   │   └── useFreeModels.js    # Free tier generation tracking
│   ├── routes/
│   │   ├── auth.js             # Login, signup, logout, password reset
│   │   ├── vocab.js            # Vocab generation, lists, sharing, export
│   │   ├── practice.js         # Questions, generation, adaptive mode
│   │   ├── dashboard.js        # Dashboard, leaderboard, analytics
│   │   ├── flashcards.js       # Flashcard sessions, SM-2 review
│   │   ├── feedback.js         # Entry feedback submission
│   │   ├── settings.js         # Profile settings, API key management
│   │   └── ticket.js           # Bug report tickets
│   ├── services/               # Business logic engines
│   ├── prompts/                # LLM system prompts
│   ├── views/                  # EJS templates
│   └── public/
│       ├── css/                # SCSS source + compiled CSS
│       └── js/                 # Client-side JavaScript
├── package.json
├── vercel.json
└── .env.example
```







## How to Contribute
Contributions are very welcome! Here's how to get started:
1. Fork the repository
2. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```
3. Make your changes
4. Test your changes locally:
```bash
npm run dev
```
5. Commit with a clear message:
```bash
git commit -m "Add: the description of your cool feature"
```
6. Push to your branch:
```bash
git push origin feature/your-feature-name
```
7. Open a Pull Request with a description of what you changed and why

### Ideas for Contributions:
- Fix bugs or improve existing features
- Add new question types or topics
- Improve the UI/UX
- Write tests
- Improve documentation (or create it lol)
- Optimize RAG prompts

> Found a bug? Open an issue or a ticket on the website


# Acknowledgments

- Hack Club (https://hackclub.com) — For the community and the hackathon
- Supabase (https://supabase.com) — For the incredible open-source backend
- Charles Gulotta (https://www.charlesgulotta-author.com) — For the mnemonic style that inspired the vocabulary entries
- Jina AI (https://jina.ai) — For the embedding API
- Every student grinding through SAT prep — this one's for you


<div align="center">
Built with late nights and too much caffeine by a high schooler who got tired of making flashcards by hand.
</div>








# I JUST WANT TO ADD THE FEATURES I WANT TO ADD
1. Sign up with google (next version)
2. Connect to google calender to make some sort of reminder of practicing daily (next version)
3. add the option to upload your sat score report which will help the adaptive mode to track your weak parts (next feature)
4. correct streak (next feature)
5. switch to dark mode while solving (already deploied)
6. bug report and ticket system (already depolied)
7. Add questions rush to make students update with the stress of the test (probably won't do it)
8. add word parts Root: rupt (Latin for 'break'); Prefix: ab- (away); Suffix: -t (used to form adjectives indicating a state or quality) (next feature || next version, not sure tbh)
9. Add an Sat questions evaluator just like the vocab evaluator (vif, very important feature HAHAHAA)
10. Oh lol add a study resources section.
11. Add Bluebook exams that are already set (just if someone wants to try them in the website with an automatic marking and the adaptive behaviour)
12. SAT WRAP!!!!! (monthly or weekly, the yearly spotify shit sucks)

Some analytics from a popular website I want to implement:


Analytics

All time
More options
Questions Attempted
0
Your total practice volume.
Current Accuracy
0%
Your hit rate.
Saved Questions
0
Bookmarked for review later.
View Saved
Study Streak
0
Take one today to start.
Take the diagnostic to see your predicted score.

20 questions · ~20 min

Start diagnostic
Activity trend
Wrong in red, correct in green. Harder questions look darker and sit below easier ones in each color. Each bar is one week.

Not enough data yet
Answer on any day and your trend will fill in here.

No study time yet.

5 topics costing the most points
Upgrade to Pro to unlock
See the topics costing you the most points with Pro.

English
Accuracy by topic











Upgrade to Pro to unlock
See your accuracy in every topic with Pro.

Math
Accuracy by topic









Upgrade to Pro to unlock
See your accuracy in every topic with Pro.

Average time per question
English
Time share by difficulty · gray averages are platform-wide.

Upgrade to Pro to unlock
See your time per difficulty with Pro.

Math
Time share by difficulty · gray averages are platform-wide.

Upgrade to Pro to unlock
See your time per difficulty with Pro.

Your practice activity
0 questions answered.

No practice activity yet
Answer questions on any day and your activity calendar appears here.

0
