import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Allow unused vars in type definitions
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off', // Use TypeScript version instead
      'no-useless-assignment': 'off', // Too strict for test code
    },
  },
  // Test files: more relaxed rules
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
  // Type definition files: allow unused params in interfaces
  {
    files: ['src/**/types.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
  // Vision layer: NO React, Zustand, or Game imports
  {
    files: ['src/vision/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'zustand'],
              message: 'src/vision/ MUST NOT import from React or Zustand. Vision system must be pure!',
            },
            {
              group: ['**/game/*', '../game/*', '../../game/*'],
              message: 'src/vision/ MUST NOT import from src/game/. Strict separation of concerns!',
            },
          ],
        },
      ],
    },
  },
  // Game layer: NO React, DOM, or Vision imports
  {
    files: ['src/game/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom'],
              message: 'src/game/ MUST NOT import from React or DOM. Game logic must be pure!',
            },
            {
              group: ['**/vision/*', '../vision/*', '../../vision/*'],
              message: 'src/game/ MUST NOT import from src/vision/. Strict separation of concerns!',
            },
          ],
        },
      ],
    },
  },
  // Audio layer: NO React or Zustand imports
  {
    files: ['src/audio/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'zustand'],
              message: 'src/audio/ MUST NOT import from React or Zustand. Audio system must be pure!',
            },
          ],
        },
      ],
    },
  },
];
