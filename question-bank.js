function add(mode, category, items) {
  return items.map(([level, prompt, options, correct, explain, code = ""]) => ({
    mode, category, level, prompt, code,
    options: options.split("|"),
    correct, explain
  }));
}

const QUESTION_BANK = [
  ...add("BUG HUNT", "Python", [
    ["EASY","Which operator checks equality in Python?","=|==|===|!=",1,"== compares values; = assigns a value."],
    ["EASY","Which keyword defines a function?","func|function|def|define",2,"Python functions are defined with def."],
    ["EASY","What is the result of len([2,4,6])?","2|3|4|6",1,"The list contains three elements."],
    ["EASY","Which value represents the absence of a value?","null|None|undefined|void",1,"Python uses None."],
    ["MEDIUM","What does range(3) produce?","1, 2, 3|0, 1, 2|0, 1, 2, 3|3 only",1,"range(3) starts at zero and stops before three."],
    ["MEDIUM","What is wrong with this condition: if x = 5?","Nothing|Use == instead of =|Use := instead|Use equals()",1,"A single equals sign is assignment, not comparison."],
    ["MEDIUM","Which method adds one item to a list?","add()|push()|append()|insertEnd()",2,"append() adds an item to the end of a list."],
    ["MEDIUM","What does a dictionary store?","Only numbers|Key-value pairs|Only strings|Ordered functions",1,"Dictionaries map keys to values."],
    ["MEDIUM","What is the output of bool([])?","True|False|None|Error",1,"An empty list is falsy."],
    ["HARD","Which statement safely opens a file and closes it automatically?","open()|with open() as f|try open()|file.close()",1,"The with statement manages the file context."],
    ["HARD","What does enumerate(items) provide?","Values only|Indexes only|Index-value pairs|Sorted values",2,"enumerate yields an index and its corresponding value."],
    ["HARD","What is the result of [x*x for x in range(3)]?","[1,4,9]|[0,1,4]|[0,1,2]|[1,2,3]",1,"The values are 0², 1² and 2²."],
    ["HARD","Which exception is raised by 10 / 0?","ValueError|TypeError|ZeroDivisionError|KeyError",2,"Division by zero raises ZeroDivisionError."],
    ["EXPERT","What does a mutable default list argument risk?","Faster execution|State shared between calls|Automatic copying|Syntax error",1,"The same default list object is reused across calls."],
    ["EXPERT","Which operation creates a shallow copy of list a?","b = a|b = a.copy()|b = a.clear()|b = copy(a, deep=True)",1,"list.copy() creates a shallow copy."]
  ]),
  ...add("BUG HUNT", "JavaScript", [
    ["EASY","Which operator checks strict equality?","=|==|===|!=",2,"=== compares value and type."],
    ["EASY","Which keyword declares a block-scoped variable?","var|let|global|dim",1,"let is block-scoped."],
    ["EASY","What does typeof 42 return?","integer|number|float|Number",1,"JavaScript numbers have type number."],
    ["EASY","Which method adds an item to the end of an array?","push()|append()|add()|insert()",0,"Array.push() appends items."],
    ["MEDIUM","What does JSON.parse() do?","Creates JSON text|Parses JSON text into a value|Deletes JSON|Encodes a URL",1,"JSON.parse converts JSON text into a JavaScript value."],
    ["MEDIUM","What is the result of Boolean(0)?","true|false|null|undefined",1,"Zero is falsy."],
    ["MEDIUM","Which declaration cannot be reassigned?","let|var|const|function",2,"A const binding cannot be reassigned."],
    ["MEDIUM","What does Array.map() return?","The original array only|A new transformed array|A number|A boolean",1,"map creates a new array from callback results."],
    ["MEDIUM","What is the bug in if (x = 5)?","Strict comparison|Assignment instead of comparison|Missing braces|Invalid variable",1,"The expression assigns 5 to x."],
    ["HARD","What does Promise.all() do if one promise rejects?","Ignores it|Rejects the combined promise|Retries it|Resolves with null",1,"Promise.all rejects when an input promise rejects."],
    ["HARD","What does ...array do in an array literal?","Deletes array|Spreads its elements|Sorts array|Freezes array",1,"The spread syntax expands iterable elements."],
    ["HARD","Which method creates a shallow copy of an object?","Object.copy()|{...obj}|obj.cloneDeep()|Object.freeze()",1,"Object spread copies enumerable own properties."],
    ["HARD","What does event.preventDefault() do?","Stops propagation|Prevents the default browser action|Removes the event|Reloads the page",1,"It cancels the event's default action."],
    ["EXPERT","What is a closure?","A CSS selector|A function retaining access to its lexical scope|A loop type|A promise state",1,"A closure retains access to its surrounding lexical environment."],
    ["EXPERT","What does the optional chaining operator ?. help prevent?","All runtime errors|Errors from accessing properties of nullish values|Network errors|Syntax errors",1,"Optional chaining short-circuits on null or undefined."]
  ]),
  ...add("SPEED QUIZ", "Linux", [
    ["EASY","Which command prints the current directory?","ls|pwd|cd|whoami",1,"pwd prints the working directory."],
    ["EASY","Which command lists directory contents?","ls|pwd|cat|touch",0,"ls lists files and directories."],
    ["EASY","Which command displays a file's contents?","mkdir|cat|rm|cd",1,"cat prints file contents."],
    ["EASY","Which command changes directory?","mv|cd|cp|pwd",1,"cd changes the current directory."],
    ["MEDIUM","Which command searches text using patterns?","grep|chmod|mkdir|ps",0,"grep searches input for matching patterns."],
    ["MEDIUM","Which command shows running processes?","ps|pwd|touch|echo",0,"ps reports process status."],
    ["MEDIUM","What does chmod change?","File permissions|File contents|Hostname|Disk format",0,"chmod modifies file mode permissions."],
    ["MEDIUM","Which command creates a directory?","touch|mkdir|rmdir|grep",1,"mkdir creates directories."],
    ["MEDIUM","Which command copies files?","mv|cp|rm|ln",1,"cp copies files and directories."],
    ["HARD","What does the pipe character | do in a shell?","Runs as root|Passes output to another command|Deletes output|Starts a new terminal",1,"A pipe connects one command's standard output to another's input."],
    ["HARD","Which command displays disk space by filesystem?","free -m|df -h|du -a|lsblk -f",1,"df -h reports filesystem disk usage in readable units."],
    ["HARD","Which command displays memory usage?","free -h|df -h|pwd|uname",0,"free reports memory usage."],
    ["HARD","What does sudo do?","Deletes a user|Runs a command with elevated privileges|Changes shell|Installs every package",1,"sudo runs a command as another user, commonly root."],
    ["EXPERT","Which command follows new lines in a log file?","head -n|tail -f|grep -r|wc -l",1,"tail -f follows appended file content."],
    ["EXPERT","What does exit code 0 conventionally mean?","Failure|Success|Permission denied|Unknown command",1,"Unix commands conventionally return zero for success."]
  ]),
  ...add("SPEED QUIZ", "SQL & Databases", [
    ["EASY","Which SQL command retrieves data?","GET|SELECT|FETCH ALL|READ",1,"SELECT retrieves rows from tables."],
    ["EASY","Which clause filters rows?","ORDER BY|WHERE|GROUP BY|JOIN",1,"WHERE filters rows before grouping."],
    ["EASY","Which keyword removes duplicate result rows?","UNIQUE|DISTINCT|DIFFERENT|ONLY",1,"DISTINCT removes duplicate rows from the result."],
    ["MEDIUM","Which clause sorts query results?","SORT|ORDER BY|ARRANGE|GROUP BY",1,"ORDER BY sorts the result set."],
    ["MEDIUM","Which function counts rows?","SUM()|COUNT()|TOTAL()|NUMBER()",1,"COUNT() counts rows or non-null values."],
    ["MEDIUM","What does a PRIMARY KEY guarantee?","Duplicate values|Unique row identification|Encrypted data|Sorted rows",1,"A primary key uniquely identifies each row."],
    ["MEDIUM","Which JOIN returns only matching rows from both tables?","LEFT JOIN|INNER JOIN|FULL JOIN|CROSS JOIN",1,"INNER JOIN returns rows satisfying the join condition."],
    ["HARD","Which clause filters grouped results?","WHERE|HAVING|ORDER BY|LIMIT",1,"HAVING filters groups after aggregation."],
    ["HARD","What is a database index mainly used for?","Encrypting data|Speeding up lookups|Replacing tables|Creating backups",1,"Indexes can improve retrieval performance."],
    ["EXPERT","What does ACID consistency mean?","Transactions preserve database rules|Every query is encrypted|All reads are faster|Data is always duplicated",0,"Consistency means transactions preserve defined constraints and invariants."]
  ]),
  ...add("SPEED QUIZ", "Git & GitHub", [
    ["EASY","Which command shows the working tree status?","git check|git status|git log|git show",1,"git status reports staged and unstaged changes."],
    ["EASY","Which command creates a commit?","git push|git commit|git add|git clone",1,"git commit records staged changes."],
    ["EASY","Which command downloads a repository?","git clone|git merge|git init|git stash",0,"git clone creates a local copy of a repository."],
    ["EASY","Which command stages a file?","git stage-now|git add|git commit|git save",1,"git add stages changes."],
    ["MEDIUM","Which command uploads local commits to a remote?","git fetch|git push|git pull|git status",1,"git push sends local commits to a remote repository."],
    ["MEDIUM","Which command integrates another branch?","git merge|git status|git init|git clean",0,"git merge combines histories."],
    ["MEDIUM","What does git pull generally do?","Pushes commits|Fetches and integrates remote changes|Deletes branches|Creates a tag",1,"git pull fetches and integrates changes from a remote."],
    ["HARD","What does git stash do?","Permanently deletes commits|Temporarily shelves working changes|Publishes a release|Renames a repository",1,"git stash saves local modifications for later restoration."],
    ["HARD","Which command shows commit history?","git log|git diff|git status|git remote",0,"git log displays commit history."],
    ["EXPERT","What is a merge conflict?","A failed login|Competing changes Git cannot automatically combine|A deleted repository|A missing remote",1,"A conflict requires manual resolution when changes overlap incompatibly."]
  ]),
  ...add("SPEED QUIZ", "API & HTTP", [
    ["EASY","What does HTTP 200 mean?","Created|OK|Not Found|Forbidden",1,"200 indicates a successful request."],
    ["EASY","What does HTTP 404 mean?","Unauthorized|Not Found|Server Error|Redirect",1,"404 means the requested resource was not found."],
    ["EASY","Which HTTP method is commonly used to retrieve data?","POST|GET|PATCH|DELETE",1,"GET requests a representation of a resource."],
    ["EASY","What does API stand for?","Application Programming Interface|Automated Program Internet|Applied Protocol Input|Application Process Integration",0,"API stands for Application Programming Interface."],
    ["MEDIUM","What does HTTP 201 indicate?","Created|Accepted|No Content|Bad Request",0,"201 indicates that a resource was created."],
    ["MEDIUM","Which status code means unauthorized or unauthenticated?","200|301|401|500",2,"401 indicates missing or invalid authentication credentials."],
    ["MEDIUM","Which status code means forbidden?","403|404|302|201",0,"403 means the server understood but refuses the request."],
    ["HARD","Which HTTP method is generally idempotent?","POST|PUT|CONNECT|PATCH always",1,"PUT is defined as idempotent."],
    ["HARD","What is JSON commonly used for in APIs?","Image compression|Structured data exchange|DNS lookup|Password hashing",1,"JSON is a common lightweight data-interchange format."],
    ["EXPERT","What does HTTP 429 indicate?","Bad Gateway|Too Many Requests|Gone|Not Modified",1,"429 indicates rate limiting or too many requests."]
  ]),
  ...add("BUG HUNT", "Debugging & QA", [
    ["EASY","What is a regression bug?","A new feature|A previously working feature breaks after a change|A typo in documentation|A slow internet connection",1,"A regression is a defect introduced by a change."],
    ["EASY","What should a good bug report include?","Only a title|Steps to reproduce and expected/actual results|Only a screenshot|A guess about the developer",1,"Reproduction steps and expected versus actual behavior help diagnose defects."],
    ["EASY","What is a test case?","A production server|A set of steps and expected results|A code editor|A database backup",1,"A test case specifies inputs, actions and expected outcomes."],
    ["EASY","What does UI stand for?","User Interface|Unified Internet|User Integration|Universal Input",0,"UI means User Interface."],
    ["MEDIUM","What is an edge case?","The normal path|An unusual boundary or extreme condition|A random screenshot|A code comment",1,"Edge cases test unusual or boundary inputs."],
    ["MEDIUM","What is the purpose of a smoke test?","Exhaustive testing|Check critical basic functionality|Measure network speed|Review visual design only",1,"Smoke tests quickly check whether major functions work."],
    ["MEDIUM","What is API testing focused on?","Only page colors|Endpoints, requests and responses|Keyboard layout|Monitor resolution",1,"API tests validate endpoint behavior and data."],
    ["MEDIUM","What is a reproducible bug?","One that happens only once|One that can be triggered consistently|One without steps|One already fixed",1,"Reproducibility means the issue can be triggered again."],
    ["MEDIUM","What is expected result in a test?","What actually happened|What should happen|The developer's salary|The test duration",1,"Expected result is the specified correct behavior."],
    ["HARD","What is boundary value analysis?","Testing only average values|Testing values at and near input limits|Testing colors|Testing source control",1,"Boundary testing focuses on limits and adjacent values."],
    ["HARD","What does a 500 HTTP response usually indicate?","Client success|Server-side error|Resource created|Redirect",1,"500 indicates an internal server error."],
    ["HARD","What is a flaky test?","A test that always passes|A test with inconsistent results|A test without assertions|A manual test",1,"Flaky tests pass or fail inconsistently without relevant code changes."],
    ["HARD","What is the main purpose of automated regression tests?","Replace all developers|Detect previously fixed behavior breaking again|Generate passwords|Deploy without review",1,"Regression automation helps catch unintended breakage."],
    ["EXPERT","What is a race condition?","A syntax error|Behavior depending on unpredictable operation timing|A slow query|A missing test file",1,"Race conditions occur when timing or ordering affects the outcome."],
    ["EXPERT","What does test coverage measure?","Code or requirements exercised by tests|Number of developers|Application download size|Server uptime only",0,"Coverage measures which code or requirements are exercised."]
  ]),
  ...add("LOGIC BATTLE", "Logic & Algorithms", [
    ["EASY","What comes next: 2, 4, 6, 8, ?","9|10|12|16",1,"The sequence increases by two."],
    ["EASY","A function doubles its input. What is the output for 7?","9|12|14|49",2,"7 multiplied by 2 equals 14."],
    ["MEDIUM","What comes next: 1, 1, 2, 3, 5, ?","6|7|8|10",2,"Each Fibonacci number is the sum of the previous two."],
    ["MEDIUM","How many comparisons are needed to find a value in a sorted array of 8 items using binary search, at most approximately?","2|3|4|8",2,"Binary search halves the search range; at most four comparisons for eight items."],
    ["MEDIUM","If 3 workers finish 3 tasks in 3 hours at equal rates, how long do 6 workers need for 6 tasks?","1 hour|2 hours|3 hours|6 hours",2,"Each worker completes one task in three hours; six workers complete six in three hours."],
    ["HARD","What is the time complexity of a single loop over n items?","O(1)|O(log n)|O(n)|O(n²)",2,"The loop performs work proportional to n."],
    ["HARD","What is the next number: 2, 6, 12, 20, 30, ?","36|40|42|44",2,"The differences are 4, 6, 8, 10, then 12."],
    ["HARD","A list has 5 elements. How many index positions does it have in zero-based indexing?","4|5|6|10",1,"The valid indexes are 0 through 4: five positions."],
    ["EXPERT","What is the average time complexity of hash table lookup?","O(1)|O(log n)|O(n)|O(n log n)",0,"Average-case hash table lookup is constant time, assuming good hashing."],
    ["EXPERT","If an algorithm halves the input each step, what is its typical time complexity?","O(1)|O(log n)|O(n)|O(n²)",1,"Repeatedly halving the input takes logarithmically many steps."]
  ])
];

if (QUESTION_BANK.length !== 100) {
  throw new Error(`Expected 100 questions, found ${QUESTION_BANK.length}`);
}
for (const [i, q] of QUESTION_BANK.entries()) {
  if (q.options.length !== 4 || !Number.isInteger(q.correct) ||
      q.correct < 0 || q.correct > 3 || !q.prompt || !q.explain) {
    throw new Error(`Invalid question at index ${i}`);
  }
}
module.exports = QUESTION_BANK;
