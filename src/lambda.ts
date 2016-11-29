module lamdda {
  type Exp = Apply | Var | Lambda;

  class Apply {
    k: "Apply" = "Apply";
    constructor(
      public fun: Exp,
      public arg: Exp,
    ) { }
  }

  class Var {
    k: "Var" = "Var";
    constructor(
      public name: string,
    ) { }
  }

  class Lambda {
    k: "Lambda" = "Lambda";
    constructor(
      public arg: Var,
      public exp: Exp,
    ) { }
  }

  function equal(a: Exp, b: Exp): boolean {
    if (a.k === "Var" && b.k === "Var") {
      return a.name === b.name;
    } else if (a.k === "Apply" && b.k === "Apply") {
      return equal(a.fun, b.fun) && equal(a.arg, b.arg);
    } else if (a.k === "Lambda" && b.k === "Lambda") {
      return equal(a.exp, replace(b.exp, b.arg, a.arg));
    }
    return false;
  }

  function replace(e: Exp, v: Var, replaceE: Exp): Exp {
    if (e.k === "Var") {
      return e.name === v.name ? replaceE : e;
    } else if (e.k === "Apply") {
      return new Apply(replace(e.fun, v, replaceE), replace(e.arg, v, replaceE));
    } else if (e.k === "Lambda") {
      return e.arg.name === v.name ? e : new Lambda(e.arg, replace(e.exp, v, replaceE));
    }
    throw "invliad node in expression";
  }

  function simplify(e: Exp, n = 500): Exp {
    let curE = e;
    for (let i = 0; i < n; i++) {
      let oldE = curE;
      curE = simplifyOnce(curE);
      if (equal(oldE, curE)) { return curE; }
    }
    console.log("unable to simplify")
    return e;
  }

  function simplifyOnce(e: Exp): Exp {
    if (e.k === "Var") {
      return e;
    } else if (e.k === "Apply") {
      if (e.fun.k === "Lambda") {
        return replace(e.fun.exp, e.fun.arg, e.arg);
      } else {
        return new Apply(simplifyOnce(e.fun), simplifyOnce(e.arg));
      }
    } else if (e.k === "Lambda") {
      return new Lambda(e.arg, simplifyOnce(e.exp));
    }
    throw "invliad node in expression";
  }

  function pprint(e: Exp): string {
    const ob = "([{<";
    const cb = ")]}>";
    let bi = 0;
    return p(e);
    function p(e: Exp): string {
      if (e.k === "Var") {
        return e.name;
      } else if (e.k === "Apply") {
        let fun = p(e.fun);
        if (e.fun.k === "Lambda") {
          fun = ob[bi] + fun + cb[bi];
          bi = (bi + 1) % ob.length;
        }
        let arg = p(e.arg);
        if (e.arg.k !== "Var") {
          arg = ob[bi] + arg + cb[bi];
          bi = (bi + 1) % ob.length;
        }
        return fun + " " + arg;
      } else if (e.k === "Lambda") {
        return "λ" + e.arg.name + " " + p(e.exp);
      }
      throw "invliad node in expression";
    }
  }

  function print(e: Exp): string {
    if (e.k === "Var") {
      return e.name;
    } else if (e.k === "Apply") {
      return "(" + print(e.fun) + " " + print(e.arg) + ")";
    } else if (e.k === "Lambda") {
      return "(λ" + e.arg.name + " " + print(e.exp) + ")";
    }
    throw "invliad node in expression";
  }

  function parse(s: string, scope: Map<string, Exp> = new Map<string, Exp>()) {
    const nonChars = `\0\\() `;
    const len = s.length;
    let i = 0;
    s = s.replace(new RegExp("λ", "g"), "\\") + "\0";
    ws();
    {
      let e = p0();
      if (s[i] !== "\0") { throw "not consumend"; }
      return e;
    }
    function p0(): Exp {
      let e = p1();
      while (i < len && s[i] !== ")") {
        e = new Apply(e, p1());
      }
      return e;
    }
    function p1(): Exp {
      if (s[i] === "\\") {
        i++;
        ws();
        let arg = new Var(id());
        let old = scope.get(arg.name);
        scope.set(arg.name, arg);
        let exp = p0();
        if (typeof old === "undefined") {
          scope.delete(arg.name);
        } else {
          scope.set(arg.name, old);
        }
        return new Lambda(arg, exp);
      }
      if (s[i] === "(") {
        i++;
        ws();
        let e = p0();
        if (s[i] !== ")") { throw "missing closing paren"; }
        i++;
        ws()
        return e;
      }
      let varName = id();
      let exp = scope.get(varName);
      if (typeof exp === "undefined") { throw "invalid name " + varName; }
      return exp;
    }
    function id(): string {
      let r = ""
      for (; i < len && isLetter(s[i]); i++) {
        r += s[i];
      }
      if (r.length === 0) { throw "expected id"; };
      ws();
      return r;
    }
    function isLetter(s: string) {
      // assert(s.length === 1);
      return nonChars.indexOf(s) === -1;
    }
    function ws() {
      while (i < len && (s[i] === " " || s[i] === "\n")) {
        i++;
      }
    }
  }

  function parseDef(s: string, scope: Map<string, Exp> = new Map<string, Exp>()): Map<string, Exp> {
    s = s.split(new RegExp("//[^\n]*\n", "g")).join("");  // remove comments
    for (let def of s.split(";")) {
      let varNameAndExprStr = def.trim().split("=", 2);
      if (varNameAndExprStr.length === 1 && varNameAndExprStr[0].length === 0) { continue; }
      if (varNameAndExprStr.length !== 2) { throw "too many or too little '='"; }
      let [varName, exprString] = varNameAndExprStr;
      // TODO: error if varName contains whitespace other special char
      scope.set(varName.trim(), simplify(parse(exprString, scope)));
    }
    return scope;
  }

  function out(s: string) {
    console.log(s);
  }

  export function test() {
    let definitions = `
0 = λf λn n;
1 = λf λn f n;
2 = λf λn f (f n);
3 = λf λn f (f (f n));
4 = λf λn f (f (f (f n)));
5 = λf λn f (f (f (f (f n))));

+1 = λa λf λn f (a f n); // next
+ = λa λb λf λn a f (b f n); // add
* = λa λb λf λn a (b f) n; // mul

6 = +1 5;
7 = +1 6;
8 = + 4 4;
9 = + 4 5;
10 = + 5 5;

pair = λa λb λf f a b;
1. = λp p (λa λb a); // fst
2. = λp p (λa λb b); // snd
tup = λp pair (+1 (1. p)) (1. p);
-1 = λa 2. (a tup (pair 0 0)); // prev
- = λa λb b -1 a; // sub
Y = λf (λx f (x x)) (λx f (x x));
`;
    let defs = parseDef(definitions);
    //for (let [v, e] of defs) {
    //  out(v + " = " + pprint(e));
    //}
    //out(pprint(simplifyN(parse("pair 0 1", defs), 100)));
    //out(pprint(simplifyN(parse("pair 0 (+1 (+1 (+1 0)))", defs), 100)));
    //out(pprint(simplifyN(parse("2. (pair 0 1)", defs), 100)));
    //out(pprint(simplifyN(parse("(3 tup (pair 0 0))", defs), 100)));
    //out(pprint(simplifyN(parse("2. (3 tup (pair 0 0))", defs), 100)));
    //out(pprint(simplifyN(parse("-1 3", defs), 100)));
    //simplifyPrintSteps(parse("(5 tup (pair 0 0))", defs));
    parseSimplifyPrint("- 7 9", defs);
    parseSimplifyPrint("- 10 7", defs);
    function parseSimplifyPrint(s: string, scope: Map<string, Exp>) {
      out(pprint(simplify(parse(s, scope))));
    }
    function simplifyPrintSteps(e: Exp) {
      let i = 1;
      out("init: " + pprint(e));
      while (true) {
        let newE = simplifyOnce(e);
        if (equal(newE, e)) { break; }
        e = newE;
        out(i + ": " + pprint(e));
        i++;
      }
      out("final: " + pprint(e));
    }
  }
}

lamdda.test();