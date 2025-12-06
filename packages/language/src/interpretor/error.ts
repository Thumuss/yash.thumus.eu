enum TypeErrors {
  Parser,
  Eval,
  Lexer,
}

// faire text;

class ErrorYASH {
  type: TypeErrors;
  position: Position;
  description?: string;
  text: string | undefined;
  constructor(type: TypeErrors, position: Position, description?: string) {
    this.type = type;
    this.position = position;
    this.description = description;
  }
}

export { ErrorYASH, TypeErrors };
