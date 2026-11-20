// Regras de dependência de docs/ESTRUTURA.md, seção 5. A regra 6 (Clock e IdGenerator) fica no ESLint.

/** Quem pode importar quem entre os módulos; todo o resto é proibido. */
const MODULE_MATRIX = {
  identity: [],
  linking: ['identity'],
  files: ['linking'],
  library: ['identity', 'files'],
  notifications: ['identity'],
  prescription: ['linking', 'library', 'notifications'],
  execution: ['identity', 'library', 'prescription'],
  students: ['identity', 'linking', 'execution'],
  gamification: ['identity', 'execution', 'notifications'],
  progress: ['students', 'prescription', 'execution', 'gamification'],
  messaging: ['linking', 'notifications'],
};

const PERSISTENCE = [
  'node_modules/@prisma/',
  'node_modules/prisma/',
  '^src/generated/prisma/',
  '^src/platform/database/',
];
const NEST = ['node_modules/@nestjs/'];

const matrixRules = Object.entries(MODULE_MATRIX).map(([module, allowed]) => ({
  name: `module-matrix-${module}`,
  severity: 'error',
  comment:
    allowed.length === 0
      ? `${module} não importa outros módulos.`
      : `${module} só importa ${allowed.join(', ')}. Para subir na hierarquia, use porta ou evento.`,
  from: { path: `^src/modules/${module}/` },
  to: {
    path: '^src/modules/',
    pathNot: `^src/modules/(${[module, ...allowed].join('|')})/`,
  },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'module-public-api',
      severity: 'error',
      comment: 'Outro módulo só é acessado pelo index.ts dele.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    ...matrixRules,
    {
      name: 'no-module-cycles',
      severity: 'error',
      comment: 'Ciclo entre arquivos; entre módulos ele quebra a hierarquia.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'domain/ não importa NestJS, Prisma, application/, api/ nem infrastructure/.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [...NEST, ...PERSISTENCE, '^src/modules/[^/]+/(application|api|infrastructure)/'],
      },
    },
    {
      name: 'api-without-infrastructure',
      severity: 'error',
      comment: 'api/ não importa infrastructure/ nem Prisma.',
      from: { path: '^src/modules/[^/]+/api/' },
      to: { path: [...PERSISTENCE, '^src/modules/[^/]+/infrastructure/'] },
    },
    {
      name: 'controller-without-persistence',
      severity: 'error',
      comment:
        'Controller não importa repository nem Prisma; ele chama o service ou o caso de uso.',
      from: { path: '^src/modules/.+\\.controller\\.ts$' },
      to: {
        path: [...PERSISTENCE, '\\.repository\\.ts$'],
      },
    },
    {
      name: 'platform-and-kernel-without-modules',
      severity: 'error',
      comment: 'platform/ e shared-kernel/ nunca importam modules/.',
      from: { path: '^src/(platform|shared-kernel)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'kernel-without-platform',
      severity: 'error',
      comment: 'shared-kernel/ não importa platform/.',
      from: { path: '^src/shared-kernel/' },
      to: { path: '^src/platform/' },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment: 'Import que a ferramenta não resolve passaria pelas outras regras sem ser checado.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '^src/generated/'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
