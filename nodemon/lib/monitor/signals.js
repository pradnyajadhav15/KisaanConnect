// Mapping of Unix/Posix signals to their numeric values
module.exports = {
  SIGHUP: 1,     // Hangup detected on controlling terminal or death of controlling process
  SIGINT: 2,     // Interrupt from keyboard (Ctrl+C)
  SIGQUIT: 3,    // Quit from keyboard
  SIGILL: 4,     // Illegal Instruction
  SIGTRAP: 5,    // Trace/breakpoint trap
  SIGABRT: 6,    // Abort signal from abort(3)
  SIGBUS: 7,     // Bus error
  SIGFPE: 8,     // Floating point exception
  SIGKILL: 9,    // Kill signal
  SIGUSR1: 10,   // User-defined signal 1
  SIGSEGV: 11,   // Invalid memory reference
  SIGUSR2: 12,   // User-defined signal 2
  SIGPIPE: 13,   // Broken pipe: write to pipe with no readers
  SIGALRM: 14,   // Timer signal from alarm(2)
  SIGTERM: 15,   // Termination signal
  SIGSTKFLT: 16, // Stack fault on coprocessor (unused on most systems)
  SIGCHLD: 17,   // Child stopped or terminated
  SIGCONT: 18,   // Continue if stopped
  SIGSTOP: 19,   // Stop process
  SIGTSTP: 20,   // Stop typed at terminal
  SIGTTIN: 21,   // Terminal input for background process
  SIGTTOU: 22,   // Terminal output for background process
  SIGURG: 23,    // Urgent condition on socket
  SIGXCPU: 24,   // CPU time limit exceeded
  SIGXFSZ: 25,   // File size limit exceeded
  SIGVTALRM: 26, // Virtual alarm clock
  SIGPROF: 27,   // Profiling timer expired
  SIGWINCH: 28,  // Window resize signal
  SIGIO: 29,     // I/O now possible
  SIGPWR: 30,    // Power failure
  SIGSYS: 31,    // Bad system call
  SIGRTMIN: 35,  // Real-time signal minimum (Linux-specific)
};
