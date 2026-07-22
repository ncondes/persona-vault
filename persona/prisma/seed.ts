import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_CLIENTS } from '../src/constants/clients';
import { hashPassword } from '../src/infrastructure/auth/password';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'camila@example.com';

  // Reset the demo user (cascades to vault items, consents, audit entries).
  await prisma.user.deleteMany({ where: { email } });

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword('password123'),
      vaultItems: {
        create: [
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
        ],
      },
    },
  });

  // Relying-party demo clients, registered from the shared list.
  for (const client of DEMO_CLIENTS) {
    const data = {
      id: client.id,
      name: client.name,
      purpose: client.purpose,
      allowedScopes: client.allowedScopes,
      requiredScopes: client.requiredScopes,
      redirectUris: client.redirectUris,
      secretHash: await hashPassword(client.devSecret),
    };
    await prisma.client.upsert({ where: { id: client.id }, create: data, update: data });
  }

  console.log('Seed complete: demo user camila@example.com + clinic, forum & store clients.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
