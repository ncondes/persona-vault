import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, NameVariantKind, ProfileFieldKey } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'mara@example.com';

  // Reset the demo user (cascades to its variants, fields, consents, audit).
  await prisma.user.deleteMany({ where: { email } });

  await prisma.user.create({
    data: {
      email,
      passwordHash: 'seed-placeholder', // a real hash is set once auth (Stage 4) lands
      nameVariants: {
        create: [
          { kind: NameVariantKind.legal, value: 'María de los Ángeles Pérez Ruiz' },
          { kind: NameVariantKind.preferred, value: 'Mara' },
          { kind: NameVariantKind.professional, value: 'Dr. M. Pérez Ruiz' },
          { kind: NameVariantKind.public, value: 'Mara P.' },
        ],
      },
      profileFields: {
        create: [
          { key: ProfileFieldKey.email, value: 'mara@example.com', sensitive: false },
          { key: ProfileFieldKey.phone, value: '+44 7700 900123', sensitive: true },
          { key: ProfileFieldKey.address, value: '12 Kings Road, London', sensitive: true },
          { key: ProfileFieldKey.dob, value: '1990-04-12', sensitive: true },
        ],
      },
    },
  });

  // Relying-party demo clients.
  const clients = [
    {
      id: 'clinic',
      name: 'City Health Clinic',
      purpose: 'healthcare',
      allowedScopes: ['name', 'email', 'phone', 'address'],
      redirectUris: ['http://localhost:4410/callback/clinic'],
      secretHash: 'seed-placeholder',
    },
    {
      id: 'forum',
      name: 'Hobbyist Forum',
      purpose: 'social',
      allowedScopes: ['name'],
      redirectUris: ['http://localhost:4410/callback/forum'],
      secretHash: 'seed-placeholder',
    },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      create: client,
      update: client,
    });
  }

  console.log('Seed complete: demo user + clinic & forum clients.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
