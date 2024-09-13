module.exports = {
	env: {
		es6: true,
		node: true,
		jest: true,
	},
	extends: 'eslint:recommended',
	parser: '@babel/eslint-parser',
	parserOptions: {
		ecmaVersion: 2017,
		requireConfigFile: false,
	},
	rules: {
		indent: ['error', 'tab'],
		'linebreak-style': ['error', 'unix'],
		semi: ['error', 'always'],
	},
};
