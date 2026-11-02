const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const EXAMS_FILE = path.join(__dirname, 'data', 'exams.json');
const SUBMISSIONS_FILE = path.join(__dirname, 'data', 'submissions.json');

// Helper to safely read JSON
function readData(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

// Helper to safely write JSON
function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// ----------------- ADMIN AUTH -----------------
const VALID_PASSCODES = ['ewebs2022'];

app.post('/api/admin/verify', (req, res) => {
  const passcode = (req.body && req.body.passcode ? String(req.body.passcode).trim() : '');
  const match = VALID_PASSCODES.includes(passcode) || 
                VALID_PASSCODES.some(p => p.toLowerCase() === passcode.toLowerCase());

  if (match) {
    res.json({ success: true, token: 'cbt_admin_session_token_' + Date.now() });
  } else {
    res.status(401).json({ success: false, message: 'Invalid Admin Passcode' });
  }
});

// ----------------- EXAMS API -----------------
// GET all exams
app.get('/api/exams', (req, res) => {
  const exams = readData(EXAMS_FILE, []);
  const role = req.query.role || 'student';

  const sanitized = exams.map(exam => {
    return {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      description: exam.description,
      duration: exam.duration,
      passPercentage: exam.passPercentage,
      maxViolations: exam.maxViolations || 3,
      questionCount: exam.questions ? exam.questions.length : 0,
      totalMarks: (exam.questions || []).reduce((acc, q) => acc + (q.marks || 1), 0),
      createdAt: exam.createdAt,
      // If admin, send full questions; if student, only metadata
      questions: role === 'admin' ? exam.questions : undefined
    };
  });

  res.json({ success: true, data: sanitized });
});

// GET single exam by ID
app.get('/api/exams/:id', (req, res) => {
  const exams = readData(EXAMS_FILE, []);
  const exam = exams.find(e => e.id === req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const role = req.query.role || 'student';

  if (role === 'student') {
    // SECURITY: Strip correctAnswer and explanation so client cannot inspect devtools
    const sanitizedQuestions = (exam.questions || []).map((q, idx) => ({
      id: q.id,
      index: idx + 1,
      text: q.text,
      options: q.options,
      marks: q.marks || 1,
      negativeMarks: q.negativeMarks || 0
    }));

    return res.json({
      success: true,
      data: {
        ...exam,
        questions: sanitizedQuestions
      }
    });
  }

  // Admin gets full questions including answers & explanations
  res.json({ success: true, data: exam });
});

// CREATE Exam (Admin)
app.post('/api/exams', (req, res) => {
  const { title, subject, description, duration, passPercentage, maxViolations } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }

  const exams = readData(EXAMS_FILE, []);
  const newExam = {
    id: 'exam-' + Date.now().toString(36),
    title: title.trim(),
    subject: subject ? subject.trim() : 'General',
    description: description ? description.trim() : '',
    duration: parseInt(duration, 10) || 15,
    passPercentage: parseInt(passPercentage, 10) || 50,
    maxViolations: parseInt(maxViolations, 10) || 3,
    shuffleQuestions: Boolean(req.body.shuffleQuestions),
    shuffleOptions: Boolean(req.body.shuffleOptions),
    createdAt: new Date().toISOString(),
    questions: req.body.questions || []
  };

  exams.unshift(newExam);
  writeData(EXAMS_FILE, exams);

  res.status(201).json({ success: true, message: 'Exam created successfully', data: newExam });
});

// UPDATE Exam (Admin)
app.put('/api/exams/:id', (req, res) => {
  const exams = readData(EXAMS_FILE, []);
  const index = exams.findIndex(e => e.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const updated = {
    ...exams[index],
    ...req.body,
    id: exams[index].id, // preserve ID
    updatedAt: new Date().toISOString()
  };

  exams[index] = updated;
  writeData(EXAMS_FILE, exams);

  res.json({ success: true, message: 'Exam updated successfully', data: updated });
});

// DELETE Exam (Admin)
app.delete('/api/exams/:id', (req, res) => {
  let exams = readData(EXAMS_FILE, []);
  const exists = exams.some(e => e.id === req.params.id);

  if (!exists) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  exams = exams.filter(e => e.id !== req.params.id);
  writeData(EXAMS_FILE, exams);

  res.json({ success: true, message: 'Exam deleted successfully' });
});

// ----------------- QUESTIONS API -----------------
// ADD Question to Exam
app.post('/api/exams/:id/questions', (req, res) => {
  const { text, options, correctAnswer, marks, negativeMarks, explanation } = req.body;
  if (!text || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ success: false, message: 'Valid question text and at least 2 options are required' });
  }

  const exams = readData(EXAMS_FILE, []);
  const exam = exams.find(e => e.id === req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const newQuestion = {
    id: 'q-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
    text: text.trim(),
    options: options.map(opt => String(opt).trim()),
    correctAnswer: parseInt(correctAnswer, 10) || 0,
    marks: parseFloat(marks) || 1,
    negativeMarks: parseFloat(negativeMarks) || 0,
    explanation: explanation ? explanation.trim() : ''
  };

  if (!exam.questions) exam.questions = [];
  exam.questions.push(newQuestion);
  writeData(EXAMS_FILE, exams);

  res.status(201).json({ success: true, message: 'Question added', data: newQuestion });
});

// UPDATE Question in Exam
app.put('/api/exams/:id/questions/:qid', (req, res) => {
  const exams = readData(EXAMS_FILE, []);
  const exam = exams.find(e => e.id === req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const qIndex = (exam.questions || []).findIndex(q => q.id === req.params.qid);
  if (qIndex === -1) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }

  exam.questions[qIndex] = {
    ...exam.questions[qIndex],
    ...req.body,
    id: exam.questions[qIndex].id
  };

  writeData(EXAMS_FILE, exams);
  res.json({ success: true, message: 'Question updated', data: exam.questions[qIndex] });
});

// DELETE Question from Exam
app.delete('/api/exams/:id/questions/:qid', (req, res) => {
  const exams = readData(EXAMS_FILE, []);
  const exam = exams.find(e => e.id === req.params.id);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  exam.questions = (exam.questions || []).filter(q => q.id !== req.params.qid);
  writeData(EXAMS_FILE, exams);

  res.json({ success: true, message: 'Question deleted' });
});

// ----------------- SUBMISSION & SCORING API -----------------
app.post('/api/submissions', (req, res) => {
  const { examId, studentName, studentRoll, answers, timeTakenSeconds, violationLog } = req.body;

  if (!examId || !studentName) {
    return res.status(400).json({ success: false, message: 'Exam ID and Candidate Name are required' });
  }

  const exams = readData(EXAMS_FILE, []);
  const exam = exams.find(e => e.id === examId);

  if (!exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const questions = exam.questions || [];
  let score = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const itemizedResults = questions.map((q, idx) => {
    const studentAnswer = answers ? answers[q.id] : undefined;
    const isAnswered = studentAnswer !== undefined && studentAnswer !== null;
    const isCorrect = isAnswered && parseInt(studentAnswer, 10) === q.correctAnswer;
    const qMarks = q.marks || 1;
    const qNegative = q.negativeMarks || 0;

    totalMarks += qMarks;

    if (isAnswered) {
      if (isCorrect) {
        score += qMarks;
        correctCount++;
      } else {
        score -= qNegative;
        incorrectCount++;
      }
    } else {
      unansweredCount++;
    }

    return {
      questionId: q.id,
      index: idx + 1,
      questionText: q.text,
      options: q.options,
      studentAnswer: isAnswered ? parseInt(studentAnswer, 10) : null,
      correctAnswer: q.correctAnswer,
      isCorrect,
      isAnswered,
      marksAwarded: isAnswered ? (isCorrect ? qMarks : -qNegative) : 0,
      explanation: q.explanation || ''
    };
  });

  // Ensure score is not negative
  const finalScore = Math.max(0, Math.round(score * 100) / 100);
  const percentage = totalMarks > 0 ? Math.round((finalScore / totalMarks) * 10000) / 100 : 0;
  const passed = percentage >= (exam.passPercentage || 50);

  const submission = {
    id: 'sub-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
    examId: exam.id,
    examTitle: exam.title,
    studentName: studentName.trim(),
    studentRoll: (studentRoll || 'N/A').trim(),
    submittedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    attempted: correctCount + incorrectCount,
    correct: correctCount,
    incorrect: incorrectCount,
    unanswered: unansweredCount,
    score: finalScore,
    totalMarks,
    percentage,
    passPercentage: exam.passPercentage || 50,
    passed,
    timeTakenSeconds: timeTakenSeconds || 0,
    violations: Array.isArray(violationLog) ? violationLog.length : 0,
    violationLog: violationLog || [],
    itemizedResults
  };

  const submissions = readData(SUBMISSIONS_FILE, []);
  submissions.unshift(submission);
  writeData(SUBMISSIONS_FILE, submissions);

  res.status(201).json({
    success: true,
    message: 'Exam submitted successfully',
    data: submission
  });
});

// GET all submissions (Admin)
app.get('/api/submissions', (req, res) => {
  const submissions = readData(SUBMISSIONS_FILE, []);
  // Return summarized list for table view
  const summary = submissions.map(s => ({
    id: s.id,
    examId: s.examId,
    examTitle: s.examTitle,
    studentName: s.studentName,
    studentRoll: s.studentRoll,
    submittedAt: s.submittedAt,
    score: s.score,
    totalMarks: s.totalMarks,
    percentage: s.percentage,
    passed: s.passed,
    violations: s.violations,
    timeTakenSeconds: s.timeTakenSeconds
  }));
  res.json({ success: true, data: summary });
});

// GET single submission details
app.get('/api/submissions/:id', (req, res) => {
  const submissions = readData(SUBMISSIONS_FILE, []);
  const sub = submissions.find(s => s.id === req.params.id);
  if (!sub) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }
  res.json({ success: true, data: sub });
});

// RESET TO DEMO DATA
app.post('/api/reset-demo', (req, res) => {
  // Can be called to reset sample data
  res.json({ success: true, message: 'Demo data is active' });
});

app.listen(PORT, () => {
  console.log(`CBT Exam Portal is running on http://localhost:${PORT}`);
});
