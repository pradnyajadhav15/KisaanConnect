// 1️⃣ Function type that checks a string and returns true/false
type AnymatchFn = (testString: string) => boolean;


// 2️⃣ A pattern can be:
// - a simple string
// - a regular expression
// - OR a function
type AnymatchPattern =
  | string
  | RegExp
  | AnymatchFn;


// 3️⃣ A matcher can be:
// - a single pattern
// - OR an array of patterns
type AnymatchMatcher =
  | AnymatchPattern
  | AnymatchPattern[];


// 4️⃣ This defines how the tester function behaves
type AnymatchTester = {

  // ✅ If returnIndex is true → it returns a number (index)
  (testString: string | any[], returnIndex: true): number;

  // ✅ Normal usage → it returns true or false
  (testString: string | any[]): boolean;
};


// 5️⃣ Extra options used internally by matching library
type PicomatchOptions = {
  dot: boolean;   // allows matching hidden files like .env
};


// 6️⃣ Main anymatch function definition
declare const anymatch: {

  // ✅ Only provide matchers → returns a tester function
  (matchers: AnymatchMatcher): AnymatchTester;

  // ✅ With null testString and index return
  (
    matchers: AnymatchMatcher,
    testString: null,
    returnIndex: true | PicomatchOptions
  ): AnymatchTester;

  // ✅ Direct test and return index
  (
    matchers: AnymatchMatcher,
    testString: string | any[],
    returnIndex: true | PicomatchOptions
  ): number;

  // ✅ Direct test and return true/false
  (
    matchers: AnymatchMatcher,
    testString: string | any[]
  ): boolean;
};


// 7️⃣ Exporting types and main function
export { AnymatchMatcher as Matcher };
export { AnymatchTester as Tester };
export default anymatch;
