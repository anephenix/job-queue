import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	{
		ignores: ['dist/**'],
	},
	...compat.extends('eslint:recommended'),
	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.mocha,
			},

			parser: babelParser,
			ecmaVersion: 2017,
			sourceType: 'module',

			parserOptions: {
				requireConfigFile: false,
			},
		},

		rules: {
			indent: ['error', 'tab'],
			'linebreak-style': ['error', 'unix'],
			semi: ['error', 'always'],
		},
	},
];
