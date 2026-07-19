# SATrack
**Generate mnemonics. Practice questions. Track your proress. All in one place.**

[![Built for Hack Club Macondo](https://img.shields.io/badge/Built%20for-Hack%20Club%20Macondo-blue?style=for-the-badge)](https://macondo.hackclub.com) [![Made with Node.js](https://img.shields.io/badge/Made%20with-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org) [![Powered by Supabase](https://img.shields.io/badge/Powered%20by-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com) [![AI Powered](https://img.shields.io/badge/AI%20Powered-RAG-blueviolet?style=for-the-badge)](#)
---

## Story Time!! (Why I Built This?)

As a gap year student, I struggled signifcantly with SAT prep last year (my senior year): the lack of free resources available for HALI students reduced my score signifcantly, and let's be real, SAT prep tools are either *expensive*, *boring*, or both. I went throgh this hard race and I barely could make it, so I wanted to build something that actually helps, not just another question bank, but a full study companion that:

1. Generates **mnemonic devices** for vocabulary words (yes this damn section) so you can actually *remeber* or ~~retrive~~ the words, inspired by Charles Gulotta's Book: [500 Key Words for the SAT: And How To Remember Them Forever!](https://www.goodreads.com/book/show/656272.500_Key_Words_for_the_SAT).
2. Uses **RAG (Retrieval-Augmented Generation)** to pull similar examples from a real question bank before generating new content.
3. Tracks your weaknesses and **adapts** to serve your questionswhere you need the most practice.
4. Feels like the **real test** with a Bluebook-style practice interface.

> Built this as a high schooler for high schoolers. No subscriptions, no paywalls. Just bring your own API keys after 5 free monthly generations (I will add a video tutorial on how to get your keys) and you're good to go.
---

## Features:
### Vocabulary Builder:
1. **AI-Powered Mnemonics**: Enter any word, get a full vocabulary entry with pronunciation, definition, mnemonic device, picture story, other forms, and example sentences.
2. **RAG-Enhanced Generation**: The system retrieves similar vocabulary entries from the database as style references before generating, so every entry feels much more authentic.
3. **Quality Assurance**: Dual validation system with both rule-based quality checking (authenticity, creativity, accuracy, completness, and format) and LLM-based evaluation (YESSS, LLMs Checking on LLMs).
4. **Regeneration with Feedback**: Not happy with an entry? (tbh this will happen a lot as AI still sucks) Regenerate with specific instructions. Your feedback improves future genrations, **the more you use the model, the smarter it becomes for you and the others**.
 5. **Word Lists**: Create, manage, clone, share (via email or public links), and export (CSV or print format) vocabulary lists, autogenerate a *"your mistakes list"*.
 6. **Daily Word**: A rotating vocabulary word each day to keep you sharp.

 ### SAT Practice:
 1. **Real Question Bank**: Thousands of the **OFFICIAL College Board SAT questions** covering Reading, Writing, and Math, I mean we all know that the College Board's Website's format sucks.
 2. **AI Question Generation**: If you haven't finish the College Board's Bank then you are not training well, and when you does you will be desperate in getting new questions that is *similar* to the actuall test bank, and guess what? this is exactly why RAG was made. You can generate new questions by subject, topic, subtopic, and difficulty using RAG.
 3. **Bluebook-Style UI**: A custom practice interface that mimics the official College Board Bluebook testing app with a: passage panel, question panel, option elimination, timer, question palette, and mark-for-review.
 4. **Adaptive Practice**: Analyzes your weakest topics and automatically serves questions at the appropriate difficulty, avoiding already-solved questions and already-mastered topics.
 5. **Extensive Filtering**: Filter by subject, topic, subtopic, difficulty, source (College Board vs AI vs who know what's next?), status, and text search.
 6. **Answer Tracking**: Tracks correct/incorrect answeres, time spent, attempt count, best time, and speed percentile.

## Flashcards:
1. **Spaced Repetition**: Implements te SuperMemo SM-2 algorithm (Again/Hard/Good/Easy ratings), just like Anki's Algorithms for optimal review scheduling.
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
4. **Dark Mode** (not very technical lol): Toggle etween dark and light theems.
5. **Keyboard Shortcuts**: Number keys for navigation, T for theme toggle, Space/Enter to flip flashcards.
6. **Bug Reports**: Built in ticket system for reporting issues.

> Just a clarification for the 5 free generations, this is not something like offering premium plans but I am using free [z.ai](https://z.ai) API and if all the requests were from my own API I would be banned lol.
---




























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
