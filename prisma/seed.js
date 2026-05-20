import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const avatars = [
  {
    id: 'avatar-ruxia',
    name: '如夏',
    gender: '女性',
    style: '电商口播',
    previewImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=720&q=80',
    sourceImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=720&q=80',
    status: 'active',
    isDefault: true,
  },
  {
    id: 'avatar-jingyi',
    name: '静怡',
    gender: '女性',
    style: '知识讲解',
    previewImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=80',
    sourceImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=80',
    status: 'active',
    isDefault: false,
  },
  {
    id: 'avatar-chunchen',
    name: '春辰',
    gender: '男性',
    style: '企业宣传',
    previewImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&q=80',
    sourceImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=720&q=80',
    status: 'active',
    isDefault: false,
  },
];

const voices = [
  {
    id: 'voice-ruxia',
    name: '如夏 · 活力女声',
    gender: '女性',
    language: '普通话',
    style: '活力亲切',
    sampleUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    duration: '00:15',
    status: 'ready',
    isDefault: true,
  },
  {
    id: 'voice-jingyi',
    name: '静怡 · 温柔女声',
    gender: '女性',
    language: '普通话',
    style: '温暖知性',
    sampleUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    duration: '00:15',
    status: 'ready',
    isDefault: false,
  },
  {
    id: 'voice-chunchen',
    name: '春辰 · 科技男声',
    gender: '男性',
    language: '普通话',
    style: '沉稳专业',
    sampleUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    duration: '00:15',
    status: 'ready',
    isDefault: false,
  },
];

const templates = [
  {
    id: 'template-ecommerce',
    name: '新品上市种草',
    category: '电商口播',
    coverUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
    scriptPrompt: '开场介绍产品核心卖点，突出适用场景、限时权益和下单理由。',
    subtitleStyle: '关键词高亮',
    backgroundConfig: '简约直播间',
    introOutroConfig: '品牌片头 + 福利片尾',
  },
  {
    id: 'template-knowledge',
    name: '知识讲解',
    category: '知识讲解',
    coverUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80',
    scriptPrompt: '用问题引入主题，拆成三个要点说明，并用一句话总结行动建议。',
    subtitleStyle: '清爽白字',
    backgroundConfig: '书房背景',
    introOutroConfig: '标题片头 + 总结片尾',
  },
  {
    id: 'template-company',
    name: '企业宣传',
    category: '企业宣传',
    coverUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
    scriptPrompt: '介绍企业定位、核心能力、客户价值和合作邀约。',
    subtitleStyle: '商务蓝',
    backgroundConfig: '企业展厅',
    introOutroConfig: 'Logo 片头 + 联系方式片尾',
  },
  {
    id: 'template-course',
    name: '课程讲解',
    category: '课程讲解',
    coverUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
    scriptPrompt: '说明适合人群、课程大纲、学习收益和报名提醒。',
    subtitleStyle: '重点描边',
    backgroundConfig: '课堂背景',
    introOutroConfig: '课程标题片头 + 报名片尾',
  },
  {
    id: 'template-news',
    name: '新闻播报',
    category: '新闻播报',
    coverUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80',
    scriptPrompt: '按照事件背景、最新进展、影响分析和后续关注播报。',
    subtitleStyle: '新闻下三分之一',
    backgroundConfig: '新闻演播厅',
    introOutroConfig: '快讯片头 + 关注片尾',
  },
];

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: '运营小助手',
      role: 'admin',
    },
  });

  for (const avatar of avatars) {
    await prisma.avatar.upsert({
      where: { id: avatar.id },
      update: avatar,
      create: avatar,
    });
  }

  for (const voice of voices) {
    await prisma.voice.upsert({
      where: { id: voice.id },
      update: voice,
      create: voice,
    });
  }

  for (const template of templates) {
    await prisma.template.upsert({
      where: { id: template.id },
      update: template,
      create: template,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
