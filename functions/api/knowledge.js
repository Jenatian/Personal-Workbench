import { jsonResponse, corsHeaders } from '../_utils';

const KNOWLEDGE_BASE = [
  {
    type: 'AI PM 知识',
    title: 'Agent（智能体）产品设计框架',
    desc: 'Agent = LLM + 工具调用 + 规划。产品设计需定义：可用工具集、任务分解策略、执行反馈机制、安全边界。典型应用：自动客服、数据分析助手、代码生成。',
    tags: ['Agent', '工具调用', '任务规划', '安全边界'],
  },
  {
    type: '行业分析',
    title: 'AI 产品合规与安全设计',
    desc: '国内外AI监管趋严。PM需关注：内容安全过滤、数据隐私合规（GDPR/个保法）、算法备案、生成内容标识、未成年人保护。合规不是阻碍，而是产品信任的基石。',
    tags: ['合规', '数据隐私', '算法备案', '内容安全'],
  },
  {
    type: 'AI PM 知识',
    title: 'Prompt Engineering 核心原则',
    desc: '好的Prompt = 角色设定 + 任务描述 + 输出格式 + 约束条件。进阶技巧：Few-shot示例、思维链（CoT）、自我一致性、结构化输出。PM要会写Prompt，更要懂Prompt的边界。',
    tags: ['Prompt', '思维链', 'Few-shot', '结构化输出'],
  },
  {
    type: '产品方法论',
    title: 'RAG（检索增强生成）产品设计要点',
    desc: 'RAG = 检索 + 生成。解决大模型幻觉和知识过时问题。设计要点：知识库结构、检索策略（关键词/向量/混合）、Chunk大小、排序重排、引用溯源。评估指标：召回率、准确率、用户满意度。',
    tags: ['RAG', '知识库', '向量检索', '评估指标'],
  },
  {
    type: 'AI PM 知识',
    title: '大模型选型与成本控制',
    desc: '选型维度：能力（基准测试）、速度（延迟）、成本（token单价）、安全（私有化部署）、生态（工具/插件）。成本优化：缓存、蒸馏、路由、提示词精简。PM要懂技术选型的trade-off。',
    tags: ['选型', '成本优化', '基准测试', '模型路由'],
  },
  {
    type: '行业分析',
    title: 'AI 产品的用户体验设计',
    desc: 'AI产品UX核心原则：透明性（说明AI能力边界）、可控性（用户可干预）、容错性（错误可修正）、渐进式引导。好的AI产品让人感觉是"助手"而非"黑盒"。',
    tags: ['UX', '透明性', '可控性', '用户信任'],
  },
  {
    type: 'AI PM 知识',
    title: 'AI 产品的核心指标体系',
    desc: '通用指标：DAU/MAU、留存、付费率。AI特有：对话轮次、任务完成率、用户纠正率、幻觉率、响应时间。A/B测试要结合客观指标（准确率）和主观指标（用户评分）。',
    tags: ['指标体系', 'A/B测试', '留存', '任务完成率'],
  },
  {
    type: '产品方法论',
    title: 'AI 产品的MVP设计思路',
    desc: 'AI产品MVP不是功能堆砌，而是验证核心价值。步骤：1.明确用户痛点 2.定义AI能力边界 3.设计最小闭环 4.快速上线收集数据 5.迭代优化。记住：先有价值，再有智能。',
    tags: ['MVP', '产品迭代', '用户价值', '快速验证'],
  },
];

export async function onRequestGet(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = 'cache:knowledge:' + today;

  const cached = await env.WORKBENCH_KV.get(cacheKey);
  if (cached) {
    return jsonResponse({ ok: true, ...JSON.parse(cached), cached: true });
  }

  const dayIndex = Math.floor(Date.now() / 86400000) % KNOWLEDGE_BASE.length;
  const item = KNOWLEDGE_BASE[dayIndex];
  const item2 = KNOWLEDGE_BASE[(dayIndex + 1) % KNOWLEDGE_BASE.length];

  const data = {
    date: today,
    items: [item, item2],
  };

  await env.WORKBENCH_KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 86400 });

  return jsonResponse({ ok: true, ...data });
}
