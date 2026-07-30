type TokenType = 'number' | 'ident' | 'plus' | 'minus' | 'star' | 'slash' | 'lparen' | 'rparen' | 'dot';

interface Token {
  type: TokenType;
  value: string;
}

export class ExpressionEvaluator {
  evaluate(expression: string, resolveField: (path: string) => unknown): number | string {
    const tokens = this.tokenize(expression);
    const ast = this.parse(tokens);
    return this.compute(ast, resolveField);
  }

  private tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < input.length) {
      if (input[i] === ' ') { i++; continue; }
      if ('+-'.includes(input[i])) {
        tokens.push({ type: input[i] === '+' ? 'plus' : 'minus', value: input[i] });
        i++;
        continue;
      }
      if ('*/'.includes(input[i])) {
        tokens.push({ type: input[i] === '*' ? 'star' : 'slash', value: input[i] });
        i++;
        continue;
      }
      if (input[i] === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
      if (input[i] === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }
      if (input[i] === '.') { tokens.push({ type: 'dot', value: '.' }); i++; continue; }

      if (/[0-9]/.test(input[i])) {
        let num = '';
        while (i < input.length && /[0-9.]/.test(input[i])) { num += input[i]; i++; }
        tokens.push({ type: 'number', value: num });
        continue;
      }

      if (/[a-zA-Z_]/.test(input[i])) {
        let ident = '';
        while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) { ident += input[i]; i++; }
        tokens.push({ type: 'ident', value: ident });
        continue;
      }

      throw new Error(`Unexpected character: ${input[i]}`);
    }
    return tokens;
  }

  private parse(tokens: Token[]): ASTNode {
    let pos = 0;

    function peek(): Token | undefined { return tokens[pos]; }
    function consume(type?: TokenType): Token {
      const t = tokens[pos];
      if (!t) throw new Error('Unexpected end of expression');
      if (type && t.type !== type) throw new Error(`Expected ${type}, got ${t.type} ('${t.value}')`);
      pos++;
      return t;
    }

    function parsePrimary(): ASTNode {
      const t = peek();
      if (!t) throw new Error('Unexpected end');
      if (t.type === 'number') {
        consume('number');
        return { type: 'number', value: parseFloat(t.value) } as ASTNode;
      }
      if (t.type === 'ident') {
        const path = parsePath();
        return { type: 'field', value: path } as ASTNode;
      }
      if (t.type === 'lparen') {
        consume('lparen');
        const node = parseExpr();
        consume('rparen');
        return node;
      }
      if (t.type === 'minus') {
        consume('minus');
        return { type: 'unary_minus', child: parsePrimary() } as ASTNode;
      }
      throw new Error(`Unexpected token: ${t.value}`);
    }

    function parsePath(): string {
      const parts: string[] = [];
      parts.push(consume('ident').value);
      while (peek()?.type === 'dot') {
        consume('dot');
        parts.push(consume('ident').value);
      }
      return parts.join('.');
    }

    function parseMultiplicative(): ASTNode {
      let left = parsePrimary();
      while (peek()?.type === 'star' || peek()?.type === 'slash') {
        const op = consume().type === 'star' ? '*' : '/';
        const right = parsePrimary();
        left = { type: 'binary', operator: op, left, right } as ASTNode;
      }
      return left;
    }

    function parseExpr(): ASTNode {
      let left = parseMultiplicative();
      while (peek()?.type === 'plus' || peek()?.type === 'minus') {
        const op = consume().type === 'plus' ? '+' : '-';
        const right = parseMultiplicative();
        left = { type: 'binary', operator: op, left, right } as ASTNode;
      }
      return left;
    }

    const ast = parseExpr();
    if (pos < tokens.length) throw new Error(`Unexpected token after expression: ${tokens[pos].value}`);
    return ast;
  }

  private compute(node: ASTNode, resolveField: (path: string) => unknown): number | string {
    switch (node.type) {
      case 'number':
        return node.value as number;
      case 'field': {
        const value = resolveField(node.value as string);
        if (value === undefined || value === null) return 0;
        const n = Number(value);
        return isNaN(n) ? 0 : n;
      }
      case 'binary': {
        const left = this.compute(node.left!, resolveField) as number;
        const right = this.compute(node.right!, resolveField) as number;
        switch (node.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return right !== 0 ? left / right : 0;
        }
      }
      case 'unary_minus':
        return -(this.compute(node.child!, resolveField) as number);
    }
    return 0;
  }
}

interface ASTNode {
  type: 'number' | 'field' | 'binary' | 'unary_minus';
  value?: number | string;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
  child?: ASTNode;
}
