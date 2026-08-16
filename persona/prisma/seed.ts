import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_CLIENTS } from '../src/constants/clients';
import { createRepositories } from '../src/repositories';
import { ClientServiceImpl } from '../src/services/client.service';
import { hashPassword } from '../src/infrastructure/auth/password';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEVELOPER_EMAIL = 'dev@example.com';

// The seed runs on every container start, so it must never destroy anything: a
// deleted-and-recreated user would take their vault item ids with them, and
// every standing consent points at those ids.
async function main() {
  const email = 'camila@example.com';

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: await hashPassword('password123') },
    update: {},
  });

  // Only fill the vault the first time. After that it belongs to whoever is
  // using the demo.
  const alreadyFilled = await prisma.vaultItem.count({ where: { userId: user.id } });
  if (alreadyFilled === 0) {
    await prisma.vaultItem.createMany({
      data: (
        [
          {
            kind: 'name',
            label: 'Legal',
            value: 'Camila Andrea Rodríguez García',
            detail: { firstName: 'Camila Andrea', lastName: 'Rodríguez García' },
            nameContext: 'legal',
          },
          {
            kind: 'name',
            label: 'Preferred',
            value: 'Cami Rodríguez',
            detail: { firstName: 'Cami', lastName: 'Rodríguez' },
            nameContext: 'preferred',
            isDefault: true,
          },
          {
            kind: 'name',
            label: 'Public',
            value: 'Camila R.',
            detail: { firstName: 'Camila', lastName: 'R.' },
            nameContext: 'public',
          },
          { kind: 'username', value: 'camirg', isDefault: true },
          { kind: 'birth_date', value: '1994-08-23', isDefault: true },
          {
            kind: 'document',
            label: 'Cédula',
            value: '1032456789',
            detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
            isDefault: true,
          },
          {
            kind: 'document',
            label: 'Passport',
            value: 'AV1234567',
            detail: { type: 'PASSPORT', issueDate: '2021-05-18', issuePlace: 'Bogotá D.C.' },
          },
          { kind: 'email', label: 'Personal', value: 'camila@example.com', isDefault: true },
          { kind: 'email', label: 'Work', value: 'camila@acme.co' },
          {
            kind: 'phone',
            label: 'Mobile',
            value: '+57 300 555 1234',
            detail: { countryCode: '+57', number: '300 555 1234' },
            isDefault: true,
          },
          {
            kind: 'address',
            label: 'Home',
            value: 'Cra 7 # 45-10, Apto 302, Bogotá',
            detail: {
              line1: 'Cra 7 # 45-10',
              line2: 'Apto 302',
              city: 'Bogotá',
              postalCode: '110111',
              country: 'CO',
            },
            isDefault: true,
          },
          { kind: 'blood_type', value: 'O_POS', isDefault: true },
          { kind: 'eps', value: 'SANITAS', isDefault: true },
          { kind: 'allergy', value: 'Penicillin' },
          { kind: 'allergy', value: 'Peanuts' },
        ] as const
      ).map((item) => ({ ...item, userId: user.id })),
    });
  }

  // The demo apps belong to a developer account of their own, so they are never
  // caught up in anything that happens to the demo user.
  const developer = await prisma.user.upsert({
    where: { email: DEVELOPER_EMAIL },
    create: { email: DEVELOPER_EMAIL, passwordHash: await hashPassword('password123') },
    update: {},
  });

  // Registered through the same service the console uses, with fixed ids and
  // secrets so the demo apps keep working across a rebuild.
  const clients = new ClientServiceImpl(createRepositories(prisma));
  for (const client of DEMO_CLIENTS) {
    await clients.register(developer.id, client.id, client.devSecret, {
      name: client.name,
      description: client.description,
      purpose: client.purpose,
      accent: client.accent,
      allowedScopes: client.allowedScopes,
      requiredScopes: client.requiredScopes,
      redirectUris: client.redirectUris,
    });
  }

  console.log(
    `Seed complete: ${email} (vault) + ${DEVELOPER_EMAIL} (owns ${DEMO_CLIENTS.map((c) => c.id).join(', ')}).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
