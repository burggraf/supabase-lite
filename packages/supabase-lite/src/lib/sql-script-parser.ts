export interface ParsedStatement {
  sql: string;
  lineNumber: number;
  originalText: string;
}

export interface ParseOptions {
  removeComments?: boolean;
  skipEmptyStatements?: boolean;
}

export class SqlScriptParser {
  /**
   * Parse a SQL script into individual executable statements
   */
  static parseScript(script: string, options: ParseOptions = {}): ParsedStatement[] {
    const {
      removeComments = true,
      skipEmptyStatements = true
    } = options;

    // Normalize line endings and split into lines for tracking
    const lines = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const statements: ParsedStatement[] = [];
    
    let currentStatement = '';
    let currentStartLine = 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBlockComment = false;
    let inLineComment = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      let processedLine = '';
      let i = 0;

      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        // Handle block comments
        if (!inSingleQuote && !inDoubleQuote && !inLineComment) {
          if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            i += 2;
            if (!removeComments) {
              processedLine += '/*';
            }
            continue;
          }
        }

        if (inBlockComment) {
          if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            i += 2;
            if (!removeComments) {
              processedLine += '*/';
            }
            continue;
          }
          if (!removeComments) {
            processedLine += char;
          }
          i++;
          continue;
        }

        // Handle line comments
        if (!inSingleQuote && !inDoubleQuote && !inBlockComment) {
          if (char === '-' && nextChar === '-') {
            inLineComment = true;
            if (!removeComments) {
              processedLine += line.slice(i);
            }
            break;
          }
        }

        if (inLineComment) {
          if (!removeComments) {
            processedLine += char;
          }
          i++;
          continue;
        }

        // Handle string literals
        if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        }

        // Handle statement terminators
        if (!inSingleQuote && !inDoubleQuote && !inBlockComment && !inLineComment) {
          if (char === ';') {
            processedLine += char;
            
            // We found a statement terminator
            const fullStatement = (currentStatement + '\n' + processedLine).trim();
            
            if (!skipEmptyStatements || this.isNonEmptyStatement(fullStatement)) {
              statements.push({
                sql: fullStatement.slice(0, -1).trim(), // Remove the semicolon
                lineNumber: currentStartLine,
                originalText: fullStatement
              });
            }

            // Reset for next statement
            currentStatement = '';
            currentStartLine = lineNumber + 1;
            processedLine = '';
            i++;
            continue;
          }
        }

        processedLine += char;
        i++;
      }

      // End of line processing
      inLineComment = false; // Reset line comment flag
      
      if (processedLine.trim() || !skipEmptyStatements) {
        if (currentStatement) {
          currentStatement += '\n' + processedLine;
        } else {
          currentStatement = processedLine;
          if (!currentStatement.trim()) {
            currentStartLine = lineNumber + 1;
          }
        }
      }
    }

    // Handle any remaining statement (without semicolon)
    if (currentStatement.trim()) {
      const trimmedStatement = currentStatement.trim();
      if (!skipEmptyStatements || this.isNonEmptyStatement(trimmedStatement)) {
        statements.push({
          sql: trimmedStatement,
          lineNumber: currentStartLine,
          originalText: trimmedStatement
        });
      }
    }

    return statements;
  }

  /**
   * Check if a statement contains actual SQL (not just comments/whitespace)
   */
  private static isNonEmptyStatement(statement: string): boolean {
    // Remove all comments and whitespace
    const cleaned = statement
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return cleaned.length > 0;
  }

  /**
   * Validate that a SQL script has balanced quotes and comments
   */
  static validateScript(script: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBlockComment = false;
    let lineNumber = 1;

    for (let i = 0; i < script.length; i++) {
      const char = script[i];
      const nextChar = script[i + 1];

      if (char === '\n') {
        lineNumber++;
        continue;
      }

      // Handle block comments
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++; // Skip the next character
          continue;
        }
      }

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++; // Skip the next character
        }
        continue;
      }

      // Handle quotes
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    if (inSingleQuote) {
      errors.push('Unmatched single quote in SQL script');
    }
    
    if (inDoubleQuote) {
      errors.push('Unmatched double quote in SQL script');
    }
    
    if (inBlockComment) {
      errors.push('Unmatched block comment (/* without */) in SQL script');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract just the SQL statements as strings (convenience method)
   */
  static extractStatements(script: string, options?: ParseOptions): string[] {
    return this.parseScript(script, options).map(stmt => stmt.sql);
  }

  /**
   * Count the number of statements in a script
   */
  static countStatements(script: string, options?: ParseOptions): number {
    return this.parseScript(script, options).length;
  }
}