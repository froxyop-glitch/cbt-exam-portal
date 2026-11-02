# Apex CBT - Proctored Computer-Based Testing Portal

A modern, full-featured Computer-Based Testing (CBT) portal with an **Admin Question Builder** and **Anti-Cheat Lockdown Engine** that disables back navigation (back-tap, swipe-back, browser back button, Alt+Left, Backspace), enforces fullscreen, and monitors tab switches.

---

## 🚀 Key Features

### 1. 🔒 Back-Tap & Navigation Lockdown Engine
- **Back-Tap Trapping:** Intercepts browser back buttons, Android swipe-back gestures, and mobile hardware back keys via a resilient `popstate` history trapping cycle (`history.pushState`).
- **Immediate Warning Toast:** Flashes an alert (`BACK-TAP IS LOCKED!`) whenever back navigation is attempted, preventing candidates from navigating away from the exam.
- **Shortcut & Context Protection:** Blocks `Alt + ArrowLeft`, `Backspace` (outside inputs), `F5`, `Ctrl+R`, `Ctrl+W`, `Ctrl+Shift+I` (DevTools), right-click context menus, and text copy/paste.
- **Unload Guard:** Intercepts page refresh or tab closure with `beforeunload`.
- **Fullscreen Enforcement:** Requests browser fullscreen upon exam entry; exiting fullscreen flags a proctoring violation strike and prompts immediate re-entry.
- **Tab Switching & Blur Detection:** Detects when a candidate switches tabs, minimizes the window, or loses window focus, accumulating strikes towards auto-submission (default: 3 strikes).

### 2. 👨‍🏫 Admin Examination & Question Manager
- **Admin Authentication:** Access admin console with passcode (`DATM199.`).
- **Exam Configuration:** Set Title, Subject, Duration (minutes), Pass Mark (%), and Maximum Allowed Security Violations before auto-submit.
- **Rich Question Authoring:**
  - Multiline question text
  - Dynamic options (A, B, C, D, E...) with radio selector for the correct answer
  - Custom marks (+ marks for correct, - negative marking for incorrect)
  - Answer explanations and solution notes
- **Import / Export:** Export questions to JSON for backup or question bank sharing.
- **Candidate Submission Audit:** View full candidate scores, percentage, pass/fail status, time spent, and an **Anti-Cheat Audit Trail** detailing timestamps of every back-tap or tab-switch violation.

### 3. 🎓 Student Examination Experience
- Modeled after official CBT platforms (e.g. NTA, Pearson VUE, Prometric).
- **Clear Status Legend:**
  - 🟢 Answered
  - 🔴 Not Answered
  - ⚪ Not Visited
  - 🟣 Marked for Review
  - 🟣🟢 Answered & Marked for Review
- **Question Palette:** 1..N direct navigation grid.
- **Continuous Countdown Timer:** Real-time countdown with visual alerts when time is running low.
- **Instant Result Scorecard:** Immediate score, percentage, grade, review of every question with correct answers vs student choices, and print-ready format.

---

## 🏃 Running the Application

1. Open PowerShell / Command Prompt:
```bash
cd "C:\Users\Service PC\.gemini\antigravity\scratch\cbt-exam-portal"
```

2. Start the server:
```bash
npm start
# or
node server.js
```

3. Open your browser:
```
http://localhost:3000
```

---

## 🔑 Credentials
- **Admin Passcode:** `DATM199.`

---

made by @[https://github.com/froxyop-glitch](https://github.com/froxyop-glitch)
