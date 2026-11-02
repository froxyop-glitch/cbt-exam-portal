/**
 * CBT Exam Portal - Proctored Lockdown & Backtap Interception Engine
 * Handles:
 * - Browser back button / backtap / hardware gesture interception
 * - Tab switching / window blur detection
 * - Fullscreen enforcement
 * - Keyboard shortcut restrictions (F5, Alt+Left, Ctrl+R, dev tools)
 * - Context menu and text selection prevention
 * - Violation tracking and auto-submit trigger
 */

class ExamLockdown {
  constructor(options = {}) {
    this.maxViolations = options.maxViolations || 3;
    this.onViolation = options.onViolation || (() => {});
    this.onAutoSubmit = options.onAutoSubmit || (() => {});
    this.onBacktapAttempt = options.onBacktapAttempt || (() => {});
    
    this.isActive = false;
    this.violationCount = 0;
    this.violationLogs = [];
    this.warningModalOpen = false;
    
    // Bind methods
    this.handlePopState = this.handlePopState.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
  }

  /**
   * Activate exam lockdown
   */
  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.violationCount = 0;
    this.violationLogs = [];

    // 1. Trap History & Backtap
    this.initHistoryTrap();

    // 2. Add System Event Listeners
    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    // Disable text selection on body
    document.body.classList.add('cbt-lockdown-active');

    // 3. Request Fullscreen
    this.enterFullscreen();

    console.log('[CBT Lockdown] Proctored Lockdown Active: Backtap locked, Tab monitoring engaged.');
  }

  /**
   * Deactivate lockdown upon legitimate exam submission
   */
  stop() {
    this.isActive = false;

    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);

    document.body.classList.remove('cbt-lockdown-active');

    // Exit fullscreen if currently active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    console.log('[CBT Lockdown] Lockdown disengaged.');
  }

  /**
   * Pre-fills history stack to absorb backtap and back button presses
   */
  initHistoryTrap() {
    // Push multiple states to make back navigation cycle back onto the exam
    for (let i = 0; i < 5; i++) {
      window.history.pushState({ cbtExamLock: true, depth: i }, '', window.location.href);
    }
  }

  /**
   * Intercept backtap / browser back button / swipe back
   */
  handlePopState(e) {
    if (!this.isActive) return;

    // Immediately push new state to re-lock the back button
    window.history.pushState({ cbtExamLock: true, time: Date.now() }, '', window.location.href);

    const logEntry = {
      type: 'backtap_prevented',
      timestamp: new Date().toISOString(),
      detail: 'Student attempted back navigation (Backtap / Browser Back / Swipe Back)'
    };
    this.violationLogs.push(logEntry);

    // Notify listeners
    this.onBacktapAttempt(logEntry);

    // Show instant prominent notification banner
    this.showBacktapAlertToast();
  }

  /**
   * Prevent page close/refresh
   */
  handleBeforeUnload(e) {
    if (!this.isActive) return;
    const msg = 'Exam is in progress! If you leave or reload, your exam may be submitted with violations.';
    e.preventDefault();
    e.returnValue = msg;
    return msg;
  }

  /**
   * Block key combinations: F5, Ctrl+R, Alt+Left, Ctrl+W, F12, Ctrl+Shift+I, etc.
   */
  handleKeyDown(e) {
    if (!this.isActive) return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Alt + Left Arrow or Alt + Right Arrow (Browser Back/Forward)
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.keyCode === 37 || e.keyCode === 39)) {
      e.preventDefault();
      e.stopPropagation();
      this.handlePopState();
      return false;
    }

    // Backspace outside input fields (older browsers back navigation)
    if (e.key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      e.preventDefault();
      e.stopPropagation();
      this.showBacktapAlertToast();
      return false;
    }

    // F5 or Ctrl/Cmd + R (Refresh)
    if (e.key === 'F5' || (isCtrlOrCmd && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      e.stopPropagation();
      this.recordViolation('Page refresh attempted (F5 / Ctrl+R)');
      return false;
    }

    // Developer tools: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (
      e.key === 'F12' ||
      (isCtrlOrCmd && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
      (isCtrlOrCmd && e.key.toUpperCase() === 'U')
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.recordViolation('Developer tools / View source access attempted');
      return false;
    }

    // Copy / Cut / Paste / Print / Save (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+P, Ctrl+S)
    if (isCtrlOrCmd && ['c', 'v', 'x', 'p', 's', 'a'].includes(e.key.toLowerCase())) {
      // Allow nothing during exam
      e.preventDefault();
      e.stopPropagation();
      this.showToast('⚠️ Copy, Paste, Print, and Select All are disabled during the examination.');
      return false;
    }
  }

  /**
   * Block right click context menu
   */
  handleContextMenu(e) {
    if (!this.isActive) return;
    e.preventDefault();
    this.showToast('⚠️ Context menu is disabled during the exam.');
    return false;
  }

  /**
   * Detect tab switching or window minimization
   */
  handleVisibilityChange() {
    if (!this.isActive) return;
    if (document.hidden) {
      this.recordViolation('Tab switched or browser minimized');
    }
  }

  /**
   * Detect window blur (e.g. clicking outside or switching app)
   */
  handleWindowBlur() {
    if (!this.isActive) return;
    // Debounce slightly to prevent false positives when interacting with system controls
    setTimeout(() => {
      if (this.isActive && !document.hasFocus() && !this.warningModalOpen) {
        this.recordViolation('Window focus lost (switched applications or split screen)');
      }
    }, 250);
  }

  /**
   * Detect exiting fullscreen
   */
  handleFullscreenChange() {
    if (!this.isActive) return;
    if (!document.fullscreenElement) {
      this.recordViolation('Fullscreen mode was exited');
      this.showFullscreenRecoverModal();
    }
  }

  /**
   * Try to re-enter fullscreen
   */
  async enterFullscreen() {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('[CBT Lockdown] Fullscreen request could not be granted automatically:', err);
    }
  }

  /**
   * Record a security / proctoring violation strike
   */
  recordViolation(reason) {
    if (!this.isActive) return;

    this.violationCount++;
    const log = {
      type: 'security_violation',
      reason,
      strike: this.violationCount,
      maxAllowed: this.maxViolations,
      timestamp: new Date().toISOString()
    };
    this.violationLogs.push(log);

    // Call callback
    this.onViolation(this.violationCount, this.maxViolations, reason, this.violationLogs);

    if (this.violationCount >= this.maxViolations) {
      this.triggerAutoSubmit(`Maximum security violations (${this.maxViolations}) exceeded: ${reason}`);
    } else {
      this.showViolationModal(reason);
    }
  }

  /**
   * Trigger automatic submission due to repeated violations
   */
  triggerAutoSubmit(reason) {
    console.warn('[CBT Lockdown] Auto-submitting exam:', reason);
    this.stop();
    this.onAutoSubmit(reason, this.violationLogs);
  }

  /**
   * Displays high-visibility toast when student taps back
   */
  showBacktapAlertToast() {
    const existing = document.getElementById('cbt-backtap-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'cbt-backtap-toast';
    toast.className = 'fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3.5 rounded-xl shadow-2xl flex items-center space-x-3 text-sm font-semibold border-2 border-red-400 animate-bounce transition-all';
    toast.innerHTML = `
      <svg class="w-6 h-6 flex-shrink-0 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <div>
        <p class="font-bold">BACK-TAP IS LOCKED!</p>
        <p class="text-xs text-red-100 font-normal">Back navigation is disabled in CBT mode. Use on-screen Question Buttons to navigate.</p>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 4000);
  }

  /**
   * General lightweight toast
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-amber-300 px-5 py-2.5 rounded-lg shadow-xl text-xs font-medium border border-amber-500/30';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  /**
   * Modal warning when user switches tab or minimizes
   */
  showViolationModal(reason) {
    this.warningModalOpen = true;
    const modalId = 'cbt-violation-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const remaining = Math.max(0, this.maxViolations - this.violationCount);

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-4 border-amber-500 text-center animate-pulse-once">
        <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-900">Security Warning: Strike ${this.violationCount} of ${this.maxViolations}</h3>
        <p class="text-sm text-gray-600 mt-2 font-medium">
          Violation Detected: <span class="text-red-600 font-semibold">${reason}</span>
        </p>
        <div class="my-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 text-left">
          <p class="font-bold mb-1">⚠️ Proctored Exam Rules:</p>
          <ul class="list-disc list-inside space-y-1">
            <li>Do NOT switch tabs or minimize the browser window.</li>
            <li>Do NOT attempt to tap back or exit fullscreen.</li>
            <li><strong>${remaining}</strong> more strike(s) will trigger <strong>Immediate Auto-Submission</strong>.</li>
          </ul>
        </div>
        <button id="cbt-acknowledge-violation-btn" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-xl transition shadow-lg">
          I Understand & Resume Exam
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const btn = document.getElementById('cbt-acknowledge-violation-btn');
    btn.onclick = () => {
      this.warningModalOpen = false;
      modal.remove();
      this.enterFullscreen();
    };
  }

  /**
   * Modal requiring user to return to fullscreen
   */
  showFullscreenRecoverModal() {
    const modalId = 'cbt-fullscreen-modal';
    if (document.getElementById(modalId)) return;

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-red-500/50 text-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
        <div class="w-14 h-14 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-white">Fullscreen Required</h3>
        <p class="text-xs text-slate-300 mt-2">
          CBT Examination must remain in full-screen mode to prevent cheating. Exiting fullscreen is logged as a violation.
        </p>
        <button id="cbt-reenter-fs-btn" class="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition">
          Re-enter Fullscreen & Continue
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const btn = document.getElementById('cbt-reenter-fs-btn');
    btn.onclick = async () => {
      await this.enterFullscreen();
      modal.remove();
    };
  }
}

// Make accessible to app
window.ExamLockdown = ExamLockdown;
