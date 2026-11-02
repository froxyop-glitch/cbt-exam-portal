/**
 * CBT Exam Portal - Main Student & App Controller
 */

const App = {
  currentView: 'student-home',
  exams: [],
  selectedExam: null,
  candidate: {
    name: '',
    roll: ''
  },
  
  // Active exam session state
  examState: {
    exam: null,
    questions: [],
    currentIndex: 0,
    answers: {}, // { [questionId]: optionIndex }
    statuses: {}, // 'not-visited', 'not-answered', 'answered', 'marked-for-review', 'answered-and-marked'
    startTime: null,
    timeRemainingSeconds: 0,
    timerInterval: null,
    lockdown: null,
    violationLogs: []
  },

  async init() {
    this.setupEventListeners();
    await this.fetchExams();
    AdminApp.init();
    
    // Check url hash
    if (window.location.hash === '#admin') {
      this.switchView('admin-view');
    } else {
      this.switchView('student-home');
    }
  },

  setupEventListeners() {
    // Role switch in navbar
    const btnNavStudent = document.getElementById('nav-student-btn');
    const btnNavAdmin = document.getElementById('nav-admin-btn');

    if (btnNavStudent) {
      btnNavStudent.addEventListener('click', () => {
        if (this.examState.lockdown && this.examState.lockdown.isActive) {
          alert('You cannot leave while the exam is active! Please complete or submit the exam.');
          return;
        }
        this.switchView('student-home');
      });
    }

    if (btnNavAdmin) {
      btnNavAdmin.addEventListener('click', () => {
        if (this.examState.lockdown && this.examState.lockdown.isActive) {
          alert('You cannot leave while the exam is active! Please complete or submit the exam.');
          return;
        }
        this.switchView('admin-view');
      });
    }
  },

  switchView(viewId) {
    this.currentView = viewId;

    // Hide all view sections
    const views = ['student-home', 'student-instructions', 'student-exam', 'student-result', 'admin-view'];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(viewId);
    if (activeEl) activeEl.classList.remove('hidden');

    // Update navbar active states
    const btnNavStudent = document.getElementById('nav-student-btn');
    const btnNavAdmin = document.getElementById('nav-admin-btn');
    const navBar = document.getElementById('main-navbar');

    if (viewId === 'student-exam') {
      // In exam mode, hide standard navbar to keep zero distractions
      if (navBar) navBar.classList.add('hidden');
    } else {
      if (navBar) navBar.classList.remove('hidden');
    }

    if (viewId.startsWith('student')) {
      if (btnNavStudent) {
        btnNavStudent.className = 'px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200';
      }
      if (btnNavAdmin) {
        btnNavAdmin.className = 'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900';
      }
    } else if (viewId === 'admin-view') {
      if (btnNavAdmin) {
        btnNavAdmin.className = 'px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200';
      }
      if (btnNavStudent) {
        btnNavStudent.className = 'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900';
      }

      // Check admin auth
      if (!AdminApp.isAuthenticated) {
        document.getElementById('admin-login-overlay').classList.remove('hidden');
      } else {
        document.getElementById('admin-login-overlay').classList.add('hidden');
        AdminApp.loadDashboardData();
      }
    }

    window.scrollTo(0, 0);
  },

  async fetchExams() {
    try {
      const res = await fetch('/api/exams?role=student');
      const data = await res.json();
      if (data.success) {
        this.exams = data.data;
        this.renderExamCards();
      }
    } catch (err) {
      console.error('Error fetching exams:', err);
    }
  },

  renderExamCards() {
    const container = document.getElementById('student-exams-grid');
    if (!container) return;

    if (this.exams.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-gray-200">
          <p class="text-gray-600 font-medium">No active examinations available right now.</p>
          <p class="text-xs text-gray-400 mt-1">Please check back later or login as Admin to create an exam.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.exams.map(exam => {
      return `
        <div class="bg-white rounded-2xl p-6 border border-gray-200 hover:border-indigo-400 hover:shadow-lg transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700">
                ${exam.subject}
              </span>
              <span class="text-xs font-semibold text-gray-500 flex items-center">
                <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                ${exam.duration} Minutes
              </span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-2">${exam.title}</h3>
            <p class="text-sm text-gray-600 mb-4 line-clamp-2">${exam.description || 'Comprehensive computer-based assessment.'}</p>
            
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
              <div><span class="font-bold text-gray-900">${exam.questionCount}</span> Questions</div>
              <div><span class="font-bold text-gray-900">${exam.totalMarks}</span> Total Marks</div>
              <div>Pass Mark: <span class="font-bold text-gray-900">${exam.passPercentage}%</span></div>
              <div>Violation Limit: <span class="font-bold text-red-600">${exam.maxViolations || 3} Strikes</span></div>
            </div>
          </div>

          <button onclick="App.selectExamForRegistration('${exam.id}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition shadow-sm flex items-center justify-center">
            <span>Register & Start Test</span>
            <svg class="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      `;
    }).join('');
  },

  selectExamForRegistration(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    this.selectedExam = exam;

    // Show Registration Modal
    document.getElementById('reg-modal-exam-title').textContent = exam.title;
    document.getElementById('reg-modal-details').textContent = `${exam.subject} • ${exam.duration} Minutes • ${exam.questionCount} Questions`;
    document.getElementById('student-reg-modal').classList.remove('hidden');
  },

  closeRegModal() {
    document.getElementById('student-reg-modal').classList.add('hidden');
  },

  submitRegistration(event) {
    event.preventDefault();
    const name = document.getElementById('reg-student-name').value.trim();
    const roll = document.getElementById('reg-student-roll').value.trim();

    if (!name) {
      alert('Please enter your full name.');
      return;
    }

    this.candidate = {
      name,
      roll: roll || 'CBT-' + Math.floor(1000 + Math.random() * 9000)
    };

    this.closeRegModal();
    this.goToInstructions();
  },

  goToInstructions() {
    if (!this.selectedExam) return;

    document.getElementById('instr-exam-title').textContent = this.selectedExam.title;
    document.getElementById('instr-candidate-name').textContent = this.candidate.name;
    document.getElementById('instr-candidate-roll').textContent = this.candidate.roll;
    document.getElementById('instr-exam-duration').textContent = `${this.selectedExam.duration} Minutes`;
    document.getElementById('instr-exam-questions').textContent = `${this.selectedExam.questionCount} Questions`;
    document.getElementById('instr-exam-pass').textContent = `${this.selectedExam.passPercentage}%`;
    document.getElementById('instr-max-violations').textContent = `${this.selectedExam.maxViolations || 3}`;

    this.switchView('student-instructions');
  },

  // ----------------- EXAM EXECUTION -----------------
  async startExam() {
    const checkbox = document.getElementById('instr-rules-agree');
    if (!checkbox.checked) {
      alert('You must read and agree to the CBT Lockdown instructions before starting.');
      return;
    }

    // Fetch full student exam data (stripped of answers)
    try {
      const res = await fetch(`/api/exams/${this.selectedExam.id}?role=student`);
      const data = await res.json();
      if (!data.success) {
        alert('Failed to load examination.');
        return;
      }

      const examData = data.data;
      if (!examData.questions || examData.questions.length === 0) {
        alert('This exam has no questions configured yet. Please ask the Admin to add questions.');
        return;
      }

      // Initialize state
      this.examState = {
        exam: examData,
        questions: examData.questions,
        currentIndex: 0,
        answers: {},
        statuses: {}, // 'not-visited', 'not-answered', 'answered', 'marked-for-review', 'answered-and-marked'
        startTime: Date.now(),
        timeRemainingSeconds: (examData.duration || 15) * 60,
        timerInterval: null,
        lockdown: null,
        violationLogs: []
      };

      // Set all questions to not-visited initially
      examData.questions.forEach((q, idx) => {
        this.examState.statuses[q.id] = idx === 0 ? 'not-answered' : 'not-visited';
      });

      // Initialize Proctoring & Backtap Lockdown
      this.examState.lockdown = new ExamLockdown({
        maxViolations: examData.maxViolations || 3,
        onViolation: (count, max, reason, logs) => {
          this.examState.violationLogs = logs;
          this.updateLockdownBadge(count, max);
        },
        onAutoSubmit: (reason, logs) => {
          this.examState.violationLogs = logs;
          this.submitExam(true, reason);
        },
        onBacktapAttempt: (log) => {
          this.examState.violationLogs.push(log);
        }
      });

      this.switchView('student-exam');
      this.examState.lockdown.start();

      // Setup UI Header
      document.getElementById('exam-title-header').textContent = examData.title;
      document.getElementById('exam-candidate-display').textContent = `${this.candidate.name} (${this.candidate.roll})`;
      this.updateLockdownBadge(0, examData.maxViolations || 3);

      // Start countdown timer
      this.startTimer();

      // Render Question & Palette
      this.renderCurrentQuestion();
      this.renderQuestionPalette();

    } catch (err) {
      console.error(err);
      alert('Error initializing examination session.');
    }
  },

  updateLockdownBadge(current, max) {
    const badge = document.getElementById('anti-cheat-status-badge');
    if (!badge) return;

    if (current === 0) {
      badge.className = 'flex items-center space-x-1.5 px-3 py-1 bg-green-900/60 text-green-300 border border-green-700/50 rounded-full text-xs font-semibold';
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        <span>Back-Tap Locked • Clean (0/${max})</span>
      `;
    } else {
      badge.className = 'flex items-center space-x-1.5 px-3 py-1 bg-red-900/60 text-red-200 border border-red-600/70 rounded-full text-xs font-semibold';
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
        <span>⚠️ Violations: ${current}/${max} Strikes</span>
      `;
    }
  },

  startTimer() {
    if (this.examState.timerInterval) {
      clearInterval(this.examState.timerInterval);
    }

    const timerDisplay = document.getElementById('exam-timer-display');
    const updateTimer = () => {
      if (this.examState.timeRemainingSeconds <= 0) {
        clearInterval(this.examState.timerInterval);
        this.submitExam(true, 'Time Expired');
        return;
      }

      this.examState.timeRemainingSeconds--;

      const mins = Math.floor(this.examState.timeRemainingSeconds / 60);
      const secs = this.examState.timeRemainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      if (timerDisplay) {
        timerDisplay.textContent = formatted;
        if (this.examState.timeRemainingSeconds < 120) {
          timerDisplay.classList.add('text-red-500', 'animate-pulse');
        } else if (this.examState.timeRemainingSeconds < 300) {
          timerDisplay.classList.add('text-amber-400');
        }
      }
    };

    updateTimer();
    this.examState.timerInterval = setInterval(updateTimer, 1000);
  },

  renderCurrentQuestion() {
    const qIndex = this.examState.currentIndex;
    const question = this.examState.questions[qIndex];
    if (!question) return;

    // Update status if currently not-visited
    if (this.examState.statuses[question.id] === 'not-visited') {
      this.examState.statuses[question.id] = 'not-answered';
    }

    document.getElementById('current-q-num').textContent = `Question ${qIndex + 1} of ${this.examState.questions.length}`;
    document.getElementById('current-q-marks').textContent = `+${question.marks || 1} Marks${question.negativeMarks ? `, -${question.negativeMarks} Neg` : ''}`;
    document.getElementById('current-q-text').textContent = question.text;

    // Render options
    const selectedOption = this.examState.answers[question.id];
    const optionsContainer = document.getElementById('current-q-options');

    optionsContainer.innerHTML = question.options.map((optText, optIdx) => {
      const isSelected = selectedOption === optIdx;
      return `
        <label onclick="App.selectOption(${optIdx})" class="flex items-center p-4 rounded-xl border-2 transition cursor-pointer select-none ${isSelected ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50'}">
          <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mr-3.5 transition ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 border border-gray-300'}">
            ${String.fromCharCode(65 + optIdx)}
          </div>
          <span class="text-sm md:text-base font-medium text-gray-800 flex-1">${optText}</span>
          <input type="radio" name="cbt_answer" value="${optIdx}" ${isSelected ? 'checked' : ''} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 hidden">
        </label>
      `;
    }).join('');

    // Previous button state
    const prevBtn = document.getElementById('btn-prev-question');
    if (prevBtn) {
      prevBtn.disabled = qIndex === 0;
      prevBtn.className = qIndex === 0
        ? 'px-4 py-2.5 rounded-xl border border-gray-200 text-gray-300 font-semibold text-sm cursor-not-allowed'
        : 'px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition';
    }

    this.renderQuestionPalette();
  },

  selectOption(optIdx) {
    const q = this.examState.questions[this.examState.currentIndex];
    this.examState.answers[q.id] = optIdx;

    // If it was marked for review, change to answered-and-marked
    if (this.examState.statuses[q.id] === 'marked-for-review' || this.examState.statuses[q.id] === 'answered-and-marked') {
      this.examState.statuses[q.id] = 'answered-and-marked';
    } else {
      this.examState.statuses[q.id] = 'answered';
    }

    this.renderCurrentQuestion();
  },

  clearCurrentResponse() {
    const q = this.examState.questions[this.examState.currentIndex];
    delete this.examState.answers[q.id];

    if (this.examState.statuses[q.id] === 'answered-and-marked') {
      this.examState.statuses[q.id] = 'marked-for-review';
    } else {
      this.examState.statuses[q.id] = 'not-answered';
    }

    this.renderCurrentQuestion();
  },

  markForReviewAndNext() {
    const q = this.examState.questions[this.examState.currentIndex];
    const isAnswered = this.examState.answers[q.id] !== undefined;

    this.examState.statuses[q.id] = isAnswered ? 'answered-and-marked' : 'marked-for-review';

    if (this.examState.currentIndex < this.examState.questions.length - 1) {
      this.goToQuestion(this.examState.currentIndex + 1);
    } else {
      this.renderCurrentQuestion();
    }
  },

  saveAndNext() {
    const q = this.examState.questions[this.examState.currentIndex];
    const isAnswered = this.examState.answers[q.id] !== undefined;

    if (!isAnswered && this.examState.statuses[q.id] !== 'marked-for-review') {
      this.examState.statuses[q.id] = 'not-answered';
    }

    if (this.examState.currentIndex < this.examState.questions.length - 1) {
      this.goToQuestion(this.examState.currentIndex + 1);
    }
  },

  previousQuestion() {
    if (this.examState.currentIndex > 0) {
      this.goToQuestion(this.examState.currentIndex - 1);
    }
  },

  goToQuestion(index) {
    if (index >= 0 && index < this.examState.questions.length) {
      this.examState.currentIndex = index;
      this.renderCurrentQuestion();
    }
  },

  renderQuestionPalette() {
    const grid = document.getElementById('question-palette-grid');
    if (!grid) return;

    let countAnswered = 0;
    let countNotAnswered = 0;
    let countNotVisited = 0;
    let countMarked = 0;
    let countAnsweredMarked = 0;

    grid.innerHTML = this.examState.questions.map((q, idx) => {
      const status = this.examState.statuses[q.id] || 'not-visited';
      const isCurrent = idx === this.examState.currentIndex;

      let btnClass = '';
      if (status === 'answered') {
        countAnswered++;
        btnClass = 'bg-emerald-500 text-white hover:bg-emerald-600';
      } else if (status === 'not-answered') {
        countNotAnswered++;
        btnClass = 'bg-rose-500 text-white hover:bg-rose-600';
      } else if (status === 'marked-for-review') {
        countMarked++;
        btnClass = 'bg-purple-600 text-white hover:bg-purple-700';
      } else if (status === 'answered-and-marked') {
        countAnsweredMarked++;
        btnClass = 'bg-purple-600 text-white ring-2 ring-emerald-400 font-extrabold';
      } else {
        countNotVisited++;
        btnClass = 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200';
      }

      if (isCurrent) {
        btnClass += ' ring-2 ring-indigo-500 ring-offset-2';
      }

      return `
        <button onclick="App.goToQuestion(${idx})" class="w-9 h-9 rounded-lg font-bold text-xs flex items-center justify-center transition shadow-sm ${btnClass}">
          ${idx + 1}
        </button>
      `;
    }).join('');

    // Update legend counts
    const elAns = document.getElementById('palette-count-answered');
    const elNotAns = document.getElementById('palette-count-not-answered');
    const elNotVis = document.getElementById('palette-count-not-visited');
    const elMarked = document.getElementById('palette-count-marked');
    const elAnsMarked = document.getElementById('palette-count-ans-marked');

    if (elAns) elAns.textContent = countAnswered;
    if (elNotAns) elNotAns.textContent = countNotAnswered;
    if (elNotVis) elNotVis.textContent = countNotVisited;
    if (elMarked) elMarked.textContent = countMarked;
    if (elAnsMarked) elAnsMarked.textContent = countAnsweredMarked;
  },

  openSubmitConfirmation() {
    let answered = 0;
    let notAnswered = 0;
    let marked = 0;

    this.examState.questions.forEach(q => {
      const isAns = this.examState.answers[q.id] !== undefined;
      const status = this.examState.statuses[q.id];
      if (isAns) answered++;
      else notAnswered++;

      if (status === 'marked-for-review' || status === 'answered-and-marked') {
        marked++;
      }
    });

    document.getElementById('sum-total-q').textContent = this.examState.questions.length;
    document.getElementById('sum-ans-q').textContent = answered;
    document.getElementById('sum-unans-q').textContent = notAnswered;
    document.getElementById('sum-marked-q').textContent = marked;

    document.getElementById('exam-submit-modal').classList.remove('hidden');
  },

  closeSubmitConfirmation() {
    document.getElementById('exam-submit-modal').classList.add('hidden');
  },

  async submitExam(isAutoSubmit = false, autoSubmitReason = '') {
    if (this.examState.timerInterval) {
      clearInterval(this.examState.timerInterval);
    }

    if (this.examState.lockdown) {
      this.examState.lockdown.stop();
    }

    this.closeSubmitConfirmation();

    const timeTakenSeconds = Math.round((Date.now() - this.examState.startTime) / 1000);

    const payload = {
      examId: this.examState.exam.id,
      studentName: this.candidate.name,
      studentRoll: this.candidate.roll,
      answers: this.examState.answers,
      timeTakenSeconds,
      violationLog: this.examState.violationLogs
    };

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.renderResultScreen(data.data, isAutoSubmit, autoSubmitReason);
      } else {
        alert('Submission failed: ' + (data.message || 'Unknown server error'));
      }
    } catch (err) {
      alert('Network error while submitting exam.');
    }
  },

  renderResultScreen(result, isAutoSubmit = false, autoSubmitReason = '') {
    this.switchView('student-result');

    document.getElementById('res-student-name').textContent = result.studentName;
    document.getElementById('res-student-roll').textContent = `Roll No: ${result.studentRoll || 'N/A'} • ${result.examTitle}`;
    document.getElementById('res-score-display').textContent = `${result.score} / ${result.totalMarks}`;
    document.getElementById('res-percentage').textContent = `${result.percentage}%`;

    const statusBanner = document.getElementById('res-status-banner');
    if (result.passed) {
      statusBanner.className = 'py-2 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-300 inline-block';
      statusBanner.textContent = '🎉 PASSED';
      this.triggerConfetti();
    } else {
      statusBanner.className = 'py-2 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-300 inline-block';
      statusBanner.textContent = '❌ NEEDS IMPROVEMENT (FAILED)';
    }

    if (isAutoSubmit) {
      const alertDiv = document.getElementById('res-autosubmit-notice');
      if (alertDiv) {
        alertDiv.classList.remove('hidden');
        alertDiv.innerHTML = `⚠️ <strong>Notice:</strong> Your exam was auto-submitted due to: <em>${autoSubmitReason}</em>.`;
      }
    } else {
      const alertDiv = document.getElementById('res-autosubmit-notice');
      if (alertDiv) alertDiv.classList.add('hidden');
    }

    // Performance metrics
    document.getElementById('res-metric-correct').textContent = result.correct;
    document.getElementById('res-metric-incorrect').textContent = result.incorrect;
    document.getElementById('res-metric-unanswered').textContent = result.unanswered;
    document.getElementById('res-metric-violations').textContent = result.violations;

    const timeM = Math.floor(result.timeTakenSeconds / 60);
    const timeS = result.timeTakenSeconds % 60;
    document.getElementById('res-metric-time').textContent = `${timeM}m ${timeS}s`;

    // Detailed question review list
    const reviewList = document.getElementById('res-questions-review');
    if (reviewList && result.itemizedResults) {
      reviewList.innerHTML = result.itemizedResults.map(item => {
        const isCorrect = item.isCorrect;
        const isUnanswered = !item.isAnswered;

        let badge = '';
        let cardBg = '';
        if (isUnanswered) {
          badge = '<span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-semibold">Unanswered (0)</span>';
          cardBg = 'border-gray-200 bg-white';
        } else if (isCorrect) {
          badge = `<span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">+${item.marksAwarded} Marks</span>`;
          cardBg = 'border-emerald-200 bg-emerald-50/20';
        } else {
          badge = `<span class="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold">${item.marksAwarded} Marks</span>`;
          cardBg = 'border-rose-200 bg-rose-50/20';
        }

        return `
          <div class="border rounded-2xl p-5 mb-4 shadow-sm ${cardBg}">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Question ${item.index}</span>
              ${badge}
            </div>
            <p class="text-base font-semibold text-gray-900 mb-4 whitespace-pre-wrap">${item.questionText}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-3">
              ${item.options.map((opt, optIdx) => {
                const isUserChoice = item.studentAnswer === optIdx;
                const isAnswer = item.correctAnswer === optIdx;
                let optClass = 'bg-white border-gray-200 text-gray-700';

                if (isAnswer) {
                  optClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                } else if (isUserChoice && !isAnswer) {
                  optClass = 'bg-rose-50 border-rose-300 text-rose-900 font-bold';
                }

                return `
                  <div class="p-3 rounded-xl border ${optClass} flex items-center justify-between">
                    <div>
                      <span class="w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold mr-2 ${isAnswer ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}">
                        ${String.fromCharCode(65 + optIdx)}
                      </span>
                      <span>${opt}</span>
                    </div>
                    <div>
                      ${isUserChoice ? '<span class="text-[10px] ml-1 uppercase bg-slate-800 text-white px-2 py-0.5 rounded-md font-bold">Your Choice</span>' : ''}
                      ${isAnswer ? '<span class="text-[10px] ml-1 uppercase bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold">Correct</span>' : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            ${item.explanation ? `
              <div class="mt-3 p-3 bg-blue-50/80 rounded-xl text-xs text-blue-900 border border-blue-200">
                <strong class="font-bold">Explanation:</strong> ${item.explanation}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  },

  triggerConfetti() {
    // Simple celebratory visual burst
    try {
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
      for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.className = 'fixed z-50 pointer-events-none rounded-full';
        const size = Math.random() * 8 + 6;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.top = `${Math.random() * 50}%`;
        particle.style.left = `${Math.random() * 80 + 10}%`;
        particle.style.opacity = '1';
        particle.style.transition = 'all 1.5s cubic-bezier(0.25, 1, 0.5, 1)';
        document.body.appendChild(particle);

        setTimeout(() => {
          particle.style.transform = `translate(${(Math.random() - 0.5) * 300}px, ${Math.random() * 400 + 100}px) rotate(${Math.random() * 360}deg)`;
          particle.style.opacity = '0';
        }, 50);

        setTimeout(() => particle.remove(), 1600);
      }
    } catch (e) {}
  },

  notifySuccess(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center space-x-2 animate-bounce';
    toast.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
      <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
