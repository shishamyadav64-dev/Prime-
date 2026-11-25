export function evaluateMathExpression(expression: string): {value: number; formatted: string} {
  const clean = expression.replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').trim();
  if (!clean) {
    throw new Error('Expression cannot be empty.');
  }

  let pos = 0;

  const skipWhitespace = () => {
    while (pos < clean.length && /\s/.test(clean[pos])) {
      pos++;
    }
  };

  const eat = (ch: string): boolean => {
    skipWhitespace();
    if (pos < clean.length && clean[pos] === ch) {
      pos++;
      return true;
    }
    return false;
  };

  const parseExpression = (): number => {
    let x = parseTerm();
    while (true) {
      if (eat('+')) {
        x += parseTerm();
      } else if (eat('-')) {
        x -= parseTerm();
      } else {
        return x;
      }
    }
  };

  const parseTerm = (): number => {
    let x = parsePower();
    while (true) {
      if (eat('*')) {
        x *= parsePower();
      } else if (eat('/')) {
        const denom = parsePower();
        if (denom === 0) throw new Error('Division by zero.');
        x /= denom;
      } else if (eat('%')) {
        const denom = parsePower();
        if (denom === 0) throw new Error('Modulo by zero.');
        x %= denom;
      } else {
        return x;
      }
    }
  };

  const parsePower = (): number => {
    const base = parseUnary();
    if (eat('^')) {
      return Math.pow(base, parsePower());
    }
    return base;
  };

  const parseUnary = (): number => {
    if (eat('+')) return parseUnary();
    if (eat('-')) return -parseUnary();
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    skipWhitespace();
    if (eat('(')) {
      const x = parseExpression();
      if (!eat(')')) throw new Error("Missing closing parenthesis ')'.");
      return x;
    }

    const start = pos;
    if (pos < clean.length && (/[0-9.]/.test(clean[pos]))) {
      while (pos < clean.length && /[0-9.]/.test(clean[pos])) {
        pos++;
      }
      const num = Number(clean.slice(start, pos));
      if (Number.isNaN(num)) throw new Error('Invalid numeric literal.');
      return num;
    }

    if (pos < clean.length && /[a-zA-Z]/.test(clean[pos])) {
      while (pos < clean.length && /[a-zA-Z]/.test(clean[pos])) {
        pos++;
      }
      const name = clean.slice(start, pos).toLowerCase();
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      if (!eat('(')) throw new Error(`Unknown identifier '${name}'.`);
      const arg = parseExpression();
      if (!eat(')')) throw new Error(`Missing ')' after ${name}(...).`);
      switch (name) {
        case 'sqrt':
          if (arg < 0) throw new Error('Square root of negative number.');
          return Math.sqrt(arg);
        case 'abs':
          return Math.abs(arg);
        case 'sin':
          return Math.sin((arg * Math.PI) / 180);
        case 'cos':
          return Math.cos((arg * Math.PI) / 180);
        case 'tan':
          return Math.tan((arg * Math.PI) / 180);
        case 'log':
          if (arg <= 0) throw new Error('Logarithm domain error.');
          return Math.log10(arg);
        case 'ln':
          if (arg <= 0) throw new Error('Natural logarithm domain error.');
          return Math.log(arg);
        default:
          throw new Error(`Unsupported function '${name}'.`);
      }
    }

    throw new Error(`Unexpected token at position ${pos}.`);
  };

  const value = parseExpression();
  skipWhitespace();
  if (pos < clean.length) {
    throw new Error(`Unexpected character '${clean[pos]}' at position ${pos}.`);
  }
  if (!Number.isFinite(value)) {
    throw new Error('Math result is undefined or infinite.');
  }

  const formatted =
    Number.isInteger(value) && Math.abs(value) < 1e15
      ? String(value)
      : Number(value.toFixed(6)).toString();

  return {value, formatted};
}
