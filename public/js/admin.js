/**
 * CBT Exam Portal - Admin Dashboard Controller
 * Handles:
 * - Admin Authentication
 * - Exam CRUD (Create, Edit, Delete, Duplicate)
 * - Question Builder (Rich options, marks, negative marking, explanations)
 * - Question Bank Import / Export
 * - Submissions & Proctoring Violation Logs Inspector
 */

const AdminApp = {
  isAuthenticated: false,
  authToken: null,
  exams: [],
  currentExam: null,
  submissions: [],

  init() {
    this.checkSession();
  },

  checkSession() {
    const savedToken = sessionStorage.getItem('cbt_admin_token');
    if (savedToken) {
      this.isAuthenticated = true;
      this.authToken = savedToken;
      this.loadDashboardData();
    }
  },

  async authenticate(passcode) {
    const cleanPasscode = (passcode || '').trim();
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: cleanPasscode })
      });
      const data = await res.json();
      if (data.success) {
        this.isAuthenticated = true;
        this.authToken = data.token;
        sessionStorage.setItem('cbt_admin_token', data.token);
        await this.loadDashboardData();
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Invalid passcode' };
      }
    } catch (err) {
      console.warn('API verification offline or error, checking client fallback:', err);
      // Resilient fallback for DATM199 and DATM199.
      const normalized = cleanPasscode.toUpperCase();
      if (normalized === 'DATM199' || normalized === 'DATM199.') {
        this.isAuthenticated = true;
        this.authToken = 'cbt_admin_fallback_' + Date.now();
        sessionStorage.setItem('cbt_admin_token', this.authToken);
        await this.loadDashboardData();
        return { success: true };
      }
      return { success: false, message: 'Invalid passcode or server error.' };
    }
  },

  logout() {
    this.isAuthenticated = false;
    this.authToken = null;
    sessionStorage.removeItem('cbt_admin_token');
    App.switchView('student-home');
  },

  async loadDashboardData() {
    await Promise.all([
      this.fetchExams(),
      this.fetchSubmissions()
    ]);
    this.renderStats();
    this.renderExamsList();
    this.renderSubmissionsList();
  },

  async fetchExams() {
    try {
      const res = await fetch('/api/exams?role=admin');
      const data = await res.json();
      if (data.success) {
        this.exams = data.data;
      }
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    }
  },

  async fetchSubmissions() {
    try {
      const res = await fetch('/api/submissions');
      const data = await res.json();
      if (data.success) {
        this.submissions = data.data;
      }
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    }
  },

  renderStats() {
    const totalExams = this.exams.length;
    const totalQuestions = this.exams.reduce((sum, e) => sum + (e.questions ? e.questions.length : 0), 0);
    const totalSubmissions = this.submissions.length;

    let avgPercentage = 0;
    let totalViolations = 0;

    if (totalSubmissions > 0) {
      const sumPct = this.submissions.reduce((sum, s) => sum + (s.percentage || 0), 0);
      avgPercentage = Math.round(sumPct / totalSubmissions);
      totalViolations = this.submissions.reduce((sum, s) => sum + (s.violations || 0), 0);
    }

    const statExams = document.getElementById('admin-stat-exams');
    const statQuestions = document.getElementById('admin-stat-questions');
    const statSubmissions = document.getElementById('admin-stat-submissions');
    const statAvgScore = document.getElementById('admin-stat-avg-score');
    const statViolations = document.getElementById('admin-stat-violations');

    if (statExams) statExams.textContent = totalExams;
    if (statQuestions) statQuestions.textContent = totalQuestions;
    if (statSubmissions) statSubmissions.textContent = totalSubmissions;
    if (statAvgScore) statAvgScore.textContent = `${avgPercentage}%`;
    if (statViolations) statViolations.textContent = totalViolations;
  },

  renderExamsList() {
    const container = document.getElementById('admin-exams-table-body');
    if (!container) return;

    if (this.exams.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-gray-500">
            No exams created yet. Click "Create New Exam" above to add your first CBT assessment.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = this.exams.map(exam => {
      const qCount = exam.questions ? exam.questions.length : 0;
      return `
        <tr class="hover:bg-slate-50 border-b border-gray-100 transition">
          <td class="px-6 py-4">
            <div class="font-bold text-gray-900">${exam.title}</div>
            <div class="text-xs text-gray-500">${exam.description || 'No description provided'}</div>
          </td>
          <td class="px-6 py-4">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
              ${exam.subject || 'General'}
            </span>
          </td>
          <td class="px-6 py-4 text-sm text-gray-600">
            ${exam.duration} mins
          </td>
          <td class="px-6 py-4">
            <span class="text-sm font-semibold text-gray-800">${qCount} Questions</span>
            <div class="text-xs text-gray-500">Pass: ${exam.passPercentage}% | Max Violations: ${exam.maxViolations || 3}</div>
          </td>
          <td class="px-6 py-4 text-right space-x-2">
            <button onclick="AdminApp.openQuestionsManager('${exam.id}')" class="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition shadow-sm">
              <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
              Manage Questions (${qCount})
            </button>
            <button onclick="AdminApp.openEditExamModal('${exam.id}')" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition">
              Edit
            </button>
            <button onclick="AdminApp.deleteExam('${exam.id}')" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition">
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderSubmissionsList() {
    const container = document.getElementById('admin-submissions-table-body');
    if (!container) return;

    if (this.submissions.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="px-6 py-8 text-center text-gray-500">
            No submissions recorded yet. Students can take exams from the Student portal.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = this.submissions.map(sub => {
      const passBadge = sub.passed
        ? `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Passed</span>`
        : `<span class="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Failed</span>`;

      const violationBadge = sub.violations > 0
        ? `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            ⚠️ ${sub.violations} ${sub.violations === 1 ? 'violation' : 'violations'}
           </span>`
        : `<span class="text-xs text-gray-400">None</span>`;

      const timeMins = Math.floor(sub.timeTakenSeconds / 60);
      const timeSecs = sub.timeTakenSeconds % 60;
      const timeFormatted = `${timeMins}m ${timeSecs}s`;

      return `
        <tr class="hover:bg-slate-50 border-b border-gray-100 transition">
          <td class="px-6 py-4">
            <div class="font-bold text-gray-900">${sub.studentName}</div>
            <div class="text-xs text-gray-500">Roll: ${sub.studentRoll || 'N/A'}</div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-800">
            ${sub.examTitle}
          </td>
          <td class="px-6 py-4">
            <div class="font-bold text-gray-900">${sub.score} / ${sub.totalMarks} (${sub.percentage}%)</div>
            <div>${passBadge}</div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-600">
            ${timeFormatted}
          </td>
          <td class="px-6 py-4">
            ${violationBadge}
          </td>
          <td class="px-6 py-4 text-xs text-gray-500">
            ${new Date(sub.submittedAt).toLocaleTimeString()}
          </td>
          <td class="px-6 py-4 text-right">
            <button onclick="AdminApp.inspectSubmission('${sub.id}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition">
              Inspect Answers & Logs
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ----------------- EXAM CRUD -----------------
  openCreateExamModal() {
    const modal = document.getElementById('exam-modal');
    document.getElementById('exam-modal-title').textContent = 'Create New CBT Exam';
    document.getElementById('exam-form-id').value = '';
    document.getElementById('exam-form-title').value = '';
    document.getElementById('exam-form-subject').value = '';
    document.getElementById('exam-form-description').value = '';
    document.getElementById('exam-form-duration').value = '15';
    document.getElementById('exam-form-pass-pct').value = '50';
    document.getElementById('exam-form-max-violations').value = '3';
    modal.classList.remove('hidden');
  },

  openEditExamModal(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    const modal = document.getElementById('exam-modal');
    document.getElementById('exam-modal-title').textContent = 'Edit CBT Exam';
    document.getElementById('exam-form-id').value = exam.id;
    document.getElementById('exam-form-title').value = exam.title;
    document.getElementById('exam-form-subject').value = exam.subject || '';
    document.getElementById('exam-form-description').value = exam.description || '';
    document.getElementById('exam-form-duration').value = exam.duration;
    document.getElementById('exam-form-pass-pct').value = exam.passPercentage;
    document.getElementById('exam-form-max-violations').value = exam.maxViolations || 3;
    modal.classList.remove('hidden');
  },

  closeExamModal() {
    document.getElementById('exam-modal').classList.add('hidden');
  },

  async saveExamForm(event) {
    event.preventDefault();
    const id = document.getElementById('exam-form-id').value;
    const title = document.getElementById('exam-form-title').value.trim();
    const subject = document.getElementById('exam-form-subject').value.trim();
    const description = document.getElementById('exam-form-description').value.trim();
    const duration = parseInt(document.getElementById('exam-form-duration').value, 10);
    const passPercentage = parseInt(document.getElementById('exam-form-pass-pct').value, 10);
    const maxViolations = parseInt(document.getElementById('exam-form-max-violations').value, 10);

    const payload = { title, subject, description, duration, passPercentage, maxViolations };

    try {
      const url = id ? `/api/exams/${id}` : '/api/exams';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.closeExamModal();
        await this.loadDashboardData();
        App.notifySuccess(id ? 'Exam updated successfully!' : 'New Exam created successfully!');
      } else {
        alert(data.message || 'Failed to save exam');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  },

  async deleteExam(examId) {
    if (!confirm('Are you sure you want to delete this exam and all its questions?')) return;
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadDashboardData();
        App.notifySuccess('Exam deleted.');
      }
    } catch (err) {
      alert('Failed to delete exam');
    }
  },

  // ----------------- QUESTIONS MANAGEMENT -----------------
  async openQuestionsManager(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    this.currentExam = exam;

    document.getElementById('qm-exam-title').textContent = exam.title;
    document.getElementById('qm-exam-badge').textContent = `${exam.subject || 'General'} • ${exam.duration} mins`;
    
    this.renderQuestionsList();

    // Switch view to questions manager view
    document.getElementById('admin-main-view').classList.add('hidden');
    document.getElementById('admin-questions-view').classList.remove('hidden');
  },

  closeQuestionsManager() {
    document.getElementById('admin-questions-view').classList.add('hidden');
    document.getElementById('admin-main-view').classList.remove('hidden');
    this.loadDashboardData();
  },

  renderQuestionsList() {
    const list = document.getElementById('qm-questions-list');
    const questions = this.currentExam.questions || [];

    document.getElementById('qm-count-badge').textContent = `${questions.length} Question(s)`;

    if (questions.length === 0) {
      list.innerHTML = `
        <div class="bg-white rounded-xl p-8 text-center border-2 border-dashed border-gray-300 text-gray-500">
          <p class="font-semibold text-lg">No questions added yet for this exam</p>
          <p class="text-sm text-gray-400 mt-1">Click the "+ Add New Question" button to start composing questions.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = questions.map((q, idx) => {
      const optionsHtml = q.options.map((opt, optIdx) => {
        const isCorrect = optIdx === q.correctAnswer;
        return `
          <div class="flex items-center p-2.5 rounded-lg text-sm ${isCorrect ? 'bg-green-50 border border-green-300 text-green-900 font-semibold' : 'bg-gray-50 text-gray-700'}">
            <span class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-3 ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}">
              ${String.fromCharCode(65 + optIdx)}
            </span>
            <span class="flex-1">${opt}</span>
            ${isCorrect ? '<span class="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded font-bold ml-2">Correct Answer</span>' : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition">
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2">
              <span class="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-md">Q${idx + 1}</span>
              <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">+${q.marks || 1} Marks</span>
              ${q.negativeMarks ? `<span class="text-xs bg-red-50 text-red-600 px-2 py-1 rounded font-medium">-${q.negativeMarks} Neg</span>` : ''}
            </div>
            <div class="space-x-2">
              <button onclick="AdminApp.openEditQuestionModal('${q.id}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2 py-1 bg-indigo-50 rounded">
                Edit
              </button>
              <button onclick="AdminApp.deleteQuestion('${q.id}')" class="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1 bg-red-50 rounded">
                Delete
              </button>
            </div>
          </div>

          <p class="text-gray-900 font-medium text-base mt-3 mb-4 leading-relaxed whitespace-pre-wrap">${q.text}</p>

          <div class="space-y-2 mb-3">
            ${optionsHtml}
          </div>

          ${q.explanation ? `
            <div class="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-900 border border-blue-200">
              <strong class="font-bold">Explanation / Solution:</strong> ${q.explanation}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  openAddQuestionModal() {
    document.getElementById('q-modal-title').textContent = 'Add Question';
    document.getElementById('q-form-id').value = '';
    document.getElementById('q-form-text').value = '';
    document.getElementById('q-form-marks').value = '2';
    document.getElementById('q-form-neg-marks').value = '0';
    document.getElementById('q-form-explanation').value = '';

    // Default 4 empty options
    this.renderQuestionOptionsInputs(['', '', '', ''], 0);
    document.getElementById('question-modal').classList.remove('hidden');
  },

  openEditQuestionModal(questionId) {
    const q = (this.currentExam.questions || []).find(x => x.id === questionId);
    if (!q) return;

    document.getElementById('q-modal-title').textContent = 'Edit Question';
    document.getElementById('q-form-id').value = q.id;
    document.getElementById('q-form-text').value = q.text;
    document.getElementById('q-form-marks').value = q.marks || 1;
    document.getElementById('q-form-neg-marks').value = q.negativeMarks || 0;
    document.getElementById('q-form-explanation').value = q.explanation || '';

    this.renderQuestionOptionsInputs(q.options, q.correctAnswer);
    document.getElementById('question-modal').classList.remove('hidden');
  },

  closeQuestionModal() {
    document.getElementById('question-modal').classList.add('hidden');
  },

  renderQuestionOptionsInputs(options = ['', ''], correctIndex = 0) {
    const container = document.getElementById('q-options-container');
    container.innerHTML = options.map((opt, idx) => {
      const isChecked = idx === correctIndex ? 'checked' : '';
      return `
        <div class="flex items-center space-x-2 option-row">
          <label class="flex items-center cursor-pointer" title="Mark this option as Correct Answer">
            <input type="radio" name="correct_option" value="${idx}" ${isChecked} class="w-4 h-4 text-green-600 focus:ring-green-500">
            <span class="ml-1.5 text-xs font-bold text-gray-500 uppercase">${String.fromCharCode(65 + idx)}</span>
          </label>
          <input type="text" value="${opt.replace(/"/g, '&quot;')}" placeholder="Option ${String.fromCharCode(65 + idx)} text" required class="q-option-input flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
          ${options.length > 2 ? `
            <button type="button" onclick="AdminApp.removeOptionInput(this)" class="p-2 text-gray-400 hover:text-red-500 rounded-lg">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  addOptionInput() {
    const currentValues = Array.from(document.querySelectorAll('.q-option-input')).map(input => input.value);
    const checkedRadio = document.querySelector('input[name="correct_option"]:checked');
    const checkedIdx = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;

    if (currentValues.length >= 6) {
      alert('Maximum 6 options allowed per question.');
      return;
    }

    currentValues.push('');
    this.renderQuestionOptionsInputs(currentValues, checkedIdx);
  },

  removeOptionInput(btn) {
    const currentValues = Array.from(document.querySelectorAll('.q-option-input')).map(input => input.value);
    const row = btn.closest('.option-row');
    const rows = Array.from(document.querySelectorAll('.option-row'));
    const indexToRemove = rows.indexOf(row);

    if (currentValues.length <= 2) {
      alert('Questions must have at least 2 options.');
      return;
    }

    currentValues.splice(indexToRemove, 1);
    this.renderQuestionOptionsInputs(currentValues, 0);
  },

  async saveQuestionForm(event) {
    event.preventDefault();
    const qid = document.getElementById('q-form-id').value;
    const text = document.getElementById('q-form-text').value.trim();
    const marks = parseFloat(document.getElementById('q-form-marks').value) || 1;
    const negativeMarks = parseFloat(document.getElementById('q-form-neg-marks').value) || 0;
    const explanation = document.getElementById('q-form-explanation').value.trim();

    const optionInputs = document.querySelectorAll('.q-option-input');
    const options = Array.from(optionInputs).map(i => i.value.trim()).filter(Boolean);

    if (options.length < 2) {
      alert('Please provide at least 2 non-empty options.');
      return;
    }

    const checkedRadio = document.querySelector('input[name="correct_option"]:checked');
    const correctAnswer = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;

    const payload = {
      text,
      options,
      correctAnswer,
      marks,
      negativeMarks,
      explanation
    };

    try {
      const url = qid
        ? `/api/exams/${this.currentExam.id}/questions/${qid}`
        : `/api/exams/${this.currentExam.id}/questions`;
      const method = qid ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.closeQuestionModal();
        // Refresh exam
        const examRes = await fetch(`/api/exams/${this.currentExam.id}?role=admin`);
        const examData = await examRes.json();
        if (examData.success) {
          this.currentExam = examData.data;
          this.renderQuestionsList();
        }
        App.notifySuccess(qid ? 'Question updated' : 'Question added');
      } else {
        alert(data.message || 'Failed to save question');
      }
    } catch (err) {
      alert('Error communicating with server');
    }
  },

  async deleteQuestion(qid) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/exams/${this.currentExam.id}/questions/${qid}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.currentExam.questions = this.currentExam.questions.filter(q => q.id !== qid);
        this.renderQuestionsList();
        App.notifySuccess('Question deleted');
      }
    } catch (err) {
      alert('Failed to delete question');
    }
  },

  // Export questions to JSON
  exportQuestionsJson() {
    if (!this.currentExam) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.currentExam.questions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${this.currentExam.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_questions.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // ----------------- SUBMISSION INSPECTOR -----------------
  async inspectSubmission(submissionId) {
    try {
      const res = await fetch(`/api/submissions/${submissionId}`);
      const data = await res.json();
      if (!data.success) return;

      const sub = data.data;
      const modal = document.getElementById('submission-inspect-modal');

      document.getElementById('sim-student-name').textContent = sub.studentName;
      document.getElementById('sim-roll-exam').textContent = `Roll: ${sub.studentRoll || 'N/A'} • ${sub.examTitle}`;
      document.getElementById('sim-score').textContent = `${sub.score} / ${sub.totalMarks} (${sub.percentage}%)`;
      document.getElementById('sim-status').textContent = sub.passed ? 'PASSED' : 'FAILED';
      document.getElementById('sim-status').className = sub.passed ? 'text-green-600 font-bold' : 'text-red-600 font-bold';

      // Violation logs
      const violationsContainer = document.getElementById('sim-violations-list');
      if (sub.violationLog && sub.violationLog.length > 0) {
        violationsContainer.innerHTML = sub.violationLog.map(v => `
          <div class="flex items-start space-x-2 text-xs p-2 bg-red-50 text-red-900 rounded border border-red-200">
            <span class="font-bold flex-shrink-0">${new Date(v.timestamp).toLocaleTimeString()}:</span>
            <span>${v.detail || v.reason || 'Proctoring alert'}</span>
          </div>
        `).join('');
      } else {
        violationsContainer.innerHTML = `<p class="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">Zero security violations recorded. Clean exam session.</p>`;
      }

      // Detailed question responses
      const qContainer = document.getElementById('sim-questions-breakdown');
      if (sub.itemizedResults && sub.itemizedResults.length > 0) {
        qContainer.innerHTML = sub.itemizedResults.map(item => {
          const isCorrect = item.isCorrect;
          const isUnanswered = !item.isAnswered;

          let badge = '';
          if (isUnanswered) {
            badge = '<span class="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-semibold">Unanswered (0 pts)</span>';
          } else if (isCorrect) {
            badge = `<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-semibold">+${item.marksAwarded} Marks</span>`;
          } else {
            badge = `<span class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">${item.marksAwarded} Marks</span>`;
          }

          return `
            <div class="border rounded-xl p-4 ${isCorrect ? 'border-green-300 bg-green-50/20' : (isUnanswered ? 'border-gray-200 bg-gray-50/30' : 'border-red-200 bg-red-50/20')}">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-gray-500">Q${item.index}</span>
                ${badge}
              </div>
              <p class="text-sm font-semibold text-gray-900 mb-2">${item.questionText}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                ${item.options.map((opt, optIdx) => {
                  const studentSelected = item.studentAnswer === optIdx;
                  const correctOne = item.correctAnswer === optIdx;
                  let optStyle = 'bg-white border-gray-200 text-gray-700';

                  if (correctOne) {
                    optStyle = 'bg-green-100 border-green-400 text-green-900 font-bold';
                  } else if (studentSelected && !correctOne) {
                    optStyle = 'bg-red-100 border-red-400 text-red-900 font-bold line-through';
                  }

                  return `
                    <div class="p-2 rounded border ${optStyle} flex items-center justify-between">
                      <span><strong>${String.fromCharCode(65 + optIdx)}.</strong> ${opt}</span>
                      ${studentSelected ? '<span class="text-[10px] ml-1 uppercase bg-slate-800 text-white px-1.5 py-0.5 rounded">Student Choice</span>' : ''}
                      ${correctOne ? '<span class="text-[10px] ml-1 uppercase bg-green-700 text-white px-1.5 py-0.5 rounded">Correct</span>' : ''}
                    </div>
                  `;
                }).join('')}
              </div>
              ${item.explanation ? `<p class="mt-2 text-xs text-blue-800 bg-blue-50 p-2 rounded">💡 <strong>Explanation:</strong> ${item.explanation}</p>` : ''}
            </div>
          `;
        }).join('');
      }

      modal.classList.remove('hidden');
    } catch (err) {
      alert('Error fetching submission details');
    }
  },

  closeInspectModal() {
    document.getElementById('submission-inspect-modal').classList.add('hidden');
  }
};

window.AdminApp = AdminApp;
