import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

// `eslint-config-next` 16 flat config dizileri yayınlıyor; FlatCompat/eslintrc
// köprüsü bu nesneleri şemaya çeviremiyor ("Converting circular structure").
const eslintConfig = [
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
      // Next 16 flat config, react-hooks v7'nin derleyici kurallarını da açıyor.
      // Kod tabanı bunlardan önce yazıldı; yalnız rules-of-hooks/exhaustive-deps kuralı geçerliydi.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    ignores: [
      '.next/',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'video/hyperframes/vendor/**',
    ],
  },
]

export default eslintConfig
