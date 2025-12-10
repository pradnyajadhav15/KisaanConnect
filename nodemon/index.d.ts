import type { WatchOptions } from 'chokidar';

/**
 * List of events that Nodemon can emit
 */
export type NodemonEventHandler =
  | 'start'
  | 'crash'
  | 'exit'
  | 'quit'
  | 'restart'
  | 'config:update'
  | 'log'
  | 'readable'
  | 'stdout'
  | 'stderr';

/**
 * Nodemon event listener definitions
 */
export type NodemonEventListener = {
  on(event: 'start' | 'crash' | 'readable', listener: () => void): Nodemon;
  on(event: 'log', listener: (e: NodemonEventLog) => void): Nodemon;
  on(event: 'stdout' | 'stderr', listener: (e: string) => void): Nodemon;
  on(event: 'restart', listener: (e?: NodemonEventRestart) => void): Nodemon;
  on(event: 'quit', listener: (e?: NodemonEventQuit) => void): Nodemon;
  on(event: 'exit', listener: (e?: number) => void): Nodemon;
  on(event: 'config:update', listener: (e?: NodemonEventConfig) => void): Nodemon;
};

/**
 * Main Nodemon type
 */
export type Nodemon = {
  removeAllListeners(event: NodemonEventHandler): Nodemon;
  emit(type: NodemonEventHandler, event?: any): Nodemon;
  reset(callback: Function): Nodemon;
  restart(): Nodemon;
  config: NodemonSettings;
} & NodemonEventListener & {
  [K in keyof NodemonEventListener as 'addListener']: NodemonEventListener[K];
} & {
  [K in keyof NodemonEventListener as 'once']: NodemonEventListener[K];
};

/**
 * Log event type
 */
export type NodemonEventLog = {
  type: 'detail' | 'log' | 'status' | 'error' | 'fail';
  message: string;
  colour: string;
};

/**
 * Restart event type
 */
export interface NodemonEventRestart {
  matched?: {
    result: string[];
    total: number;
  };
}

/**
 * Quit event type
 */
export type NodemonEventQuit = 143 | 130;

/**
 * Nodemon configuration event type
 */
export type NodemonEventConfig = {
  run: boolean;
  system: { cwd: string };
  required: boolean;
  dirs: string[];
  timeout: number;
  options: NodemonConfig;
  lastStarted: number;
  loaded: string[];
  load: (settings: NodemonSettings, ready: (config: NodemonEventConfig) => void) => void;
  reset: () => void;
};

/**
 * Execution options for scripts
 */
export interface NodemonExecOptions {
  script: string;
  scriptPosition?: number;
  args?: string[];
  ext?: string; // e.g., "js,mjs"
  exec?: string; // e.g., node, python
  execArgs?: string[];
  nodeArgs?: string[];
}

/**
 * Nodemon configuration options
 */
export interface NodemonConfig {
  restartable?: false | string;
  colours?: boolean;
  execMap?: { [key: string]: string };
  ignoreRoot?: string[];
  watch?: string[];
  ignore?: string[];
  stdin?: boolean;
  runOnChangeOnly?: boolean;
  verbose?: boolean;
  signal?: string;
  stdout?: boolean;
  watchOptions?: WatchOptions;
  help?: string;
  version?: boolean;
  cwd?: string;
  dump?: boolean;
  monitor?: string[];
  spawn?: boolean;
  noUpdateNotifier?: boolean;
  legacyWatch?: boolean;
  pollingInterval?: number;
  js?: boolean; // deprecated
  quiet?: boolean;
  configFile?: string;
  exitCrash?: boolean;
  execOptions?: NodemonExecOptions;
}

/**
 * Nodemon settings including exec options and additional env/events
 */
export interface NodemonSettings extends NodemonConfig, NodemonExecOptions {
  events?: { [key: string]: string };
  env?: { [key: string]: string };
}

/**
 * Nodemon function stub
 */
const nodemon: Nodemon = (settings: NodemonSettings): Nodemon => {
  // Implementation goes here
  return {} as Nodemon;
};

export = nodemon;
