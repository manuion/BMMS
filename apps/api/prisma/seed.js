const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bmms.com' },
    update: {},
    create: {
      email: 'admin@bmms.com',
      password: adminPassword,
      name: 'Admin User',
      phone: '+911234567890',
      isAdmin: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create organiser user
  const organiserPassword = await bcrypt.hash('organiser123', 12);
  const organiser = await prisma.user.upsert({
    where: { email: 'organiser@bmms.com' },
    update: {},
    create: {
      email: 'organiser@bmms.com',
      password: organiserPassword,
      name: 'Organiser User',
      phone: '+911234567891',
      isAdmin: false,
    },
  });
  console.log('✅ Organiser user created:', organiser.email);

  // Create member users
  const memberPassword = await bcrypt.hash('member123', 12);
  const members = [];
  for (let i = 1; i <= 5; i++) {
    const member = await prisma.user.upsert({
      where: { email: `member${i}@bmms.com` },
      update: {},
      create: {
        email: `member${i}@bmms.com`,
        password: memberPassword,
        name: `Board Member ${i}`,
        phone: `+9112345678${90 + i}`,
        isAdmin: false,
      },
    });
    members.push(member);
  }
  console.log('✅ Member users created:', members.length);

  // Create committees
  const committee1 = await prisma.committee.upsert({
    where: { id: 'committee-product-a' },
    update: {},
    create: {
      id: 'committee-product-a',
      name: 'Product A Committee',
      description: 'Committee for Product A strategic decisions',
    },
  });

  const committee2 = await prisma.committee.upsert({
    where: { id: 'committee-product-b' },
    update: {},
    create: {
      id: 'committee-product-b',
      name: 'Product B Committee',
      description: 'Committee for Product B strategic decisions',
    },
  });

  const committee3 = await prisma.committee.upsert({
    where: { id: 'committee-finance' },
    update: {},
    create: {
      id: 'committee-finance',
      name: 'Finance Committee',
      description: 'Committee for financial oversight and audit',
    },
  });
  console.log('✅ Committees created: 3');

  // Add members to committees
  // Organiser is organiser in committee 1 and member in committee 2
  await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: {
        userId: organiser.id,
        committeeId: committee1.id,
      },
    },
    update: {},
    create: {
      userId: organiser.id,
      committeeId: committee1.id,
      role: 'organiser',
    },
  });

  await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: {
        userId: organiser.id,
        committeeId: committee2.id,
      },
    },
    update: {},
    create: {
      userId: organiser.id,
      committeeId: committee2.id,
      role: 'member',
    },
  });

  // Add members to committees
  for (let i = 0; i < members.length; i++) {
    const member = members[i];

    // Add to committee 1
    if (i < 3) {
      await prisma.committeeMember.upsert({
        where: {
          userId_committeeId: {
            userId: member.id,
            committeeId: committee1.id,
          },
        },
        update: {},
        create: {
          userId: member.id,
          committeeId: committee1.id,
          role: 'member',
        },
      });
    }

    // Add to committee 2
    if (i >= 2) {
      await prisma.committeeMember.upsert({
        where: {
          userId_committeeId: {
            userId: member.id,
            committeeId: committee2.id,
          },
        },
        update: {},
        create: {
          userId: member.id,
          committeeId: committee2.id,
          role: i === 4 ? 'organiser' : 'member', // Member 5 is organiser of committee 2
        },
      });
    }

    // Add to finance committee (all members)
    await prisma.committeeMember.upsert({
      where: {
        userId_committeeId: {
          userId: member.id,
          committeeId: committee3.id,
        },
      },
      update: {},
      create: {
        userId: member.id,
        committeeId: committee3.id,
        role: 'member',
      },
    });
  }
  console.log('✅ Committee memberships created');

  // Create sample meetings
  const meeting1 = await prisma.meeting.upsert({
    where: { id: 'meeting-1' },
    update: {},
    create: {
      id: 'meeting-1',
      title: 'Q4 Product A Review',
      description: 'Quarterly review of Product A performance and roadmap',
      committeeId: committee1.id,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      location: 'Board Room A, 5th Floor',
      status: 'scheduled',
      createdBy: organiser.id,
    },
  });

  const meeting2 = await prisma.meeting.upsert({
    where: { id: 'meeting-2' },
    update: {},
    create: {
      id: 'meeting-2',
      title: 'Product B Launch Planning',
      description: 'Planning session for Product B market launch',
      committeeId: committee2.id,
      scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      location: 'Conference Room B, 3rd Floor',
      status: 'scheduled',
      createdBy: members[4].id, // Member 5 is organiser of committee 2
    },
  });
  console.log('✅ Sample meetings created: 2');

  // Create meeting responses
  const committee1Members = [organiser, members[0], members[1], members[2]];
  for (const member of committee1Members) {
    await prisma.meetingResponse.upsert({
      where: {
        meetingId_userId: {
          meetingId: meeting1.id,
          userId: member.id,
        },
      },
      update: {},
      create: {
        meetingId: meeting1.id,
        userId: member.id,
        status: 'pending',
      },
    });
  }
  console.log('✅ Meeting responses created');

  console.log('\n🎉 Seeding completed!');
  console.log('\n📝 Test credentials:');
  console.log('   Admin: admin@bmms.com / admin123');
  console.log('   Organiser: organiser@bmms.com / organiser123');
  console.log('   Member: member1@bmms.com / member123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
