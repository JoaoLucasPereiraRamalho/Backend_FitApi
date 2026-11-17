import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Lê o schema.prisma como texto: as regras valem para todo modelo que entrar nas próximas partes.
const SCHEMA = readFileSync(
  join(import.meta.dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

interface Field {
  model: string;
  name: string;
  type: string;
  attributes: string;
}

function parseFields(schema: string): Field[] {
  const fields: Field[] = [];
  const models = schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const [, model, body] of models) {
    for (const rawLine of body!.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      const match = /^(\w+)\s+(\w+)(\[\])?\??\s*(.*)$/.exec(line);
      if (!match || line.startsWith('@@')) continue;
      const [, name, type, , attributes] = match;
      fields.push({ model: model!, name: name!, type: type!, attributes: attributes! });
    }
  }
  return fields;
}

const fields = parseFields(SCHEMA);
const label = (f: Field) => `${f.model}.${f.name}`;

describe('schema do Prisma', () => {
  it('encontra os modelos do schema', () => {
    expect(new Set(fields.map((f) => f.model)).size).toBeGreaterThan(0);
  });

  it('grava todo instante como timestamptz (datas de calendário usam @db.Date)', () => {
    const wrong = fields
      .filter((f) => f.type === 'DateTime')
      .filter((f) => !/@db\.(Timestamptz|Date)\b/.test(f.attributes))
      .map(label);
    expect(wrong).toEqual([]);
  });

  it('usa UUID em todo campo id e em toda chave estrangeira para ele', () => {
    const wrong = fields
      .filter((f) => f.type === 'String' && (f.name === 'id' || /Id$/.test(f.name)))
      .filter((f) => !f.attributes.includes('@db.Uuid'))
      .map(label);
    expect(wrong).toEqual([]);
  });

  it('não deixa o banco gerar identificadores (eles vêm do IdGenerator)', () => {
    const wrong = fields
      .filter((f) =>
        /@default\((uuid|cuid|nanoid|ulid|autoincrement|dbgenerated)\b/.test(f.attributes),
      )
      .map(label);
    expect(wrong).toEqual([]);
  });
});
