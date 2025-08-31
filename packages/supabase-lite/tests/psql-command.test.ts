import { describe, it, expect } from 'vitest';
import { createPsqlCommand } from '../src/commands/psql.js';

describe('PSQL Command Structure', () => {
  describe('Command Creation', () => {
    it('should create psql command with correct configuration', () => {
      const command = createPsqlCommand();
      
      expect(command.name()).toBe('psql');
      expect(command.description()).toContain('Connect to Supabase Lite database');
    });

    it('should have required URL option', () => {
      const command = createPsqlCommand();
      const options = command.options;
      
      const urlOption = options.find((opt: any) => opt.short === '-u');
      expect(urlOption).toBeDefined();
      expect(urlOption.long).toBe('--url');
      expect(urlOption.required).toBe(true);
    });

    it('should have optional command option', () => {
      const command = createPsqlCommand();
      const options = command.options;
      
      const commandOption = options.find((opt: any) => opt.short === '-c');
      expect(commandOption).toBeDefined();
      expect(commandOption.long).toBe('--command');
    });

    it('should have optional file option', () => {
      const command = createPsqlCommand();
      const options = command.options;
      
      const fileOption = options.find((opt: any) => opt.short === '-f');
      expect(fileOption).toBeDefined();
      expect(fileOption.long).toBe('--file');
    });

    it('should have quiet option', () => {
      const command = createPsqlCommand();
      const options = command.options;
      
      const quietOption = options.find((opt: any) => opt.short === '-q');
      expect(quietOption).toBeDefined();
      expect(quietOption.long).toBe('--quiet');
    });

    it('should have continue-on-error option', () => {
      const command = createPsqlCommand();
      const options = command.options;
      
      const continueOption = options.find((opt: any) => opt.long === '--continue-on-error');
      expect(continueOption).toBeDefined();
    });

    it('should have show-progress option', () => {
      const command = createPsqlCommand();
      const options = command.options;
      
      const progressOption = options.find((opt: any) => opt.long === '--show-progress');
      expect(progressOption).toBeDefined();
    });
  });

  describe('Command Validation', () => {
    it('should be a valid Commander.js command', () => {
      const command = createPsqlCommand();
      
      // Basic Commander.js structure validation
      expect(command.name).toBeDefined();
      expect(command.description).toBeDefined();
      expect(command.options).toBeDefined();
      expect(Array.isArray(command.options)).toBe(true);
    });
  });
});