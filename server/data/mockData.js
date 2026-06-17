export const mockLeads = [
  {
    id: "1",
    name: "Arnaldo Leon Caprai",
    company: "Arnaldo Caprai S.R.L.",
    revenueTier: "$100K+/MO",
    tierKey: "100k",
    booked: true,
    marketing: "I have no consistent marketing system at all",
    business: "We just produce and sell wine products.",
    receivedAt: "Jun 2, 07:12 PM",
    callScheduled: "Call Tue Jun 9, 2026 4:30PM - 5PM (MDT)"
  },
  {
    id: "2",
    name: "SAEED",
    company: "Ran-Zo",
    revenueTier: "$100K+/MO",
    tierKey: "100k",
    booked: false,
    marketing: "I'm doing all my marketing manually and it's not keeping up",
    business: "Weapons Dealers + Fashion",
    receivedAt: "Jun 1, 01:56 PM",
    callScheduled: null
  },
  {
    id: "3",
    name: "Remus",
    company: "Penguin Swim Sch...",
    revenueTier: "$30K-$100K/MO",
    tierKey: "30k",
    booked: true,
    marketing: "I've tried tools or agencies and nothing compounded",
    business: "Running a premium swim school in Singapore, planning to do more automation",
    receivedAt: "Jun 5, 03:50 AM",
    callScheduled: "Call Sat Jun 6, 2026 8:30AM - 9AM (MDT)"
  },
  {
    id: "4",
    name: "Sean",
    company: "Test",
    revenueTier: "$30K-$100K/MO",
    tierKey: "30k",
    booked: true,
    marketing: "I'm doing all my marketing manually and it's not keeping up",
    business: "3e[oneiweknrf;lerferfwerf",
    receivedAt: "Jun 4, 11:53 PM",
    callScheduled: null
  },
  {
    id: "5",
    name: "Ethan",
    company: "Comfort Pros",
    revenueTier: "$30K-$100K/MO",
    tierKey: "30k",
    booked: false,
    marketing: "I have no consistent marketing system at all",
    business: "HVAC, general contracting sales. First full month in business. I'm solo and sub out all wor...",
    receivedAt: "Jun 4, 11:40 AM",
    callScheduled: null
  },
  {
    id: "6",
    name: "Sean",
    company: "Test",
    revenueTier: "$10K-$30K/MO",
    tierKey: "10k",
    booked: false,
    marketing: "I have a team or contractor but output is inconsistent",
    business: "test test test test",
    receivedAt: "Jun 4, 11:00 AM",
    callScheduled: null
  },
  {
    id: "7",
    name: "Marcus",
    company: "VeloCore Labs",
    revenueTier: "$10K-$30K/MO",
    tierKey: "10k",
    booked: true,
    marketing: "I'm doing all my marketing manually and it's not keeping up",
    business: "SaaS tool for gym owners, B2B model",
    receivedAt: "Jun 3, 09:15 AM",
    callScheduled: "Call Mon Jun 8, 2026 2:00PM - 2:30PM (MDT)"
  },
  {
    id: "8",
    name: "Priya",
    company: "Bloom Wellness",
    revenueTier: "$2K-$10K/MO",
    tierKey: "2k",
    booked: false,
    marketing: "I've tried ads but nothing converts",
    business: "Online coaching for women's hormonal health",
    receivedAt: "Jun 5, 04:20 PM",
    callScheduled: null
  }
];

export const mockTasks = [
  { id: "t1", title: "Research competitor content strategy", agentId: "researcher", status: "completed", priority: "high", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "t2", title: "Draft LinkedIn post series for Q3", agentId: "cmo", status: "in_progress", priority: "high", createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: "t3", title: "Qualify 3 new inbound leads", agentId: "sales_rep", status: "in_progress", priority: "medium", createdAt: new Date(Date.now() - 21600000).toISOString() },
  { id: "t4", title: "Analyze engagement metrics for last 7 reels", agentId: "data_analyst", status: "pending", priority: "medium", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "t5", title: "Set up Zapier automation for lead routing", agentId: "dev", status: "pending", priority: "low", createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "t6", title: "Identify top 5 ICP signals from lead form data", agentId: "researcher", status: "completed", priority: "high", createdAt: new Date(Date.now() - 172800000).toISOString() }
];

export const mockContentPosts = [
  {
    id: "c1",
    shortId: "DZHSGzrxuYZ",
    title: 'comment "system"...',
    thumbnail: null,
    views: 9031,
    likes: 749,
    comments: 389,
    er: 12.60,
    type: "reel"
  },
  {
    id: "c2",
    shortId: "DZEzQ7XxFEP",
    title: "This one agent did the work of an entire marketing team all before 9am It's a CMO agent inside this agentic grow...",
    thumbnail: null,
    views: 5963,
    likes: 403,
    comments: 45,
    er: 7.51,
    type: "reel"
  },
  {
    id: "c3",
    shortId: "DZE2XLERZ1R",
    title: 'comment "system" or dm me to learn more...',
    thumbnail: null,
    views: 61180,
    likes: 3584,
    comments: 3584,
    er: 13.70,
    type: "reel",
    featured: true
  }
];

export const mockContentGraph = {
  topics: [
    { id: "t_dashboard", label: "Dashboard Proof" },
    { id: "t_agentic", label: "Agentic Systems" },
    { id: "t_multiagent", label: "Multi-Agent OS" },
    { id: "t_cmo", label: "CMO / Content Engine" },
    { id: "t_sales", label: "Sales / Funnel" },
    { id: "t_founder", label: "Founder Ops" },
    { id: "t_memory", label: "Shared Memory" }
  ],
  reels: [
    { id: "r1", label: 'comment "system" or de...' },
    { id: "r2", label: "Here is our 6 Agent, Ag..." },
    { id: "r3", label: "A CEO, a CMO, a researc..." },
    { id: "r4", label: 'comment "system"...' },
    { id: "r5", label: "This one agent did the..." },
    { id: "r6", label: "Agentic Systems are the..." },
    { id: "r7", label: "Check my calendar and b..." },
    { id: "r8", label: "This client's agentic s..." },
    { id: "r9", label: "This is my own AI Agent..." },
    { id: "r10", label: "Most of the agentic ope..." }
  ],
  metrics: ["Views", "Comments", "Engagement Rate"],
  edges: [
    { from: "t_dashboard", to: "r1" }, { from: "t_dashboard", to: "r2" },
    { from: "t_agentic", to: "r2" }, { from: "t_agentic", to: "r3" }, { from: "t_agentic", to: "r4" },
    { from: "t_multiagent", to: "r3" }, { from: "t_multiagent", to: "r5" },
    { from: "t_cmo", to: "r5" }, { from: "t_cmo", to: "r6" }, { from: "t_cmo", to: "r7" },
    { from: "t_sales", to: "r6" }, { from: "t_sales", to: "r8" },
    { from: "t_founder", to: "r8" }, { from: "t_founder", to: "r9" },
    { from: "t_memory", to: "r9" }, { from: "t_memory", to: "r10" },
    { from: "r1", to: "Views" }, { from: "r3", to: "Views" }, { from: "r5", to: "Views" },
    { from: "r2", to: "Comments" }, { from: "r6", to: "Comments" }, { from: "r10", to: "Comments" },
    { from: "r4", to: "Engagement Rate" }, { from: "r7", to: "Engagement Rate" }, { from: "r9", to: "Engagement Rate" }
  ]
};

export const mockKnowledgeNodes = [
  { id: "ceo", label: "CEO / Orchestrator", type: "agent", description: "Routes work, maintains system context, and coordinates specialist agents.", x: 400, y: 300 },
  { id: "researcher", label: "Researcher", type: "agent", description: "Intel Gatherer — finds market signals and strategic context.", x: 200, y: 200 },
  { id: "cmo", label: "CMO", type: "agent", description: "Market Voice — turns strategy into content campaigns.", x: 600, y: 200 },
  { id: "sales_rep", label: "Sales Rep", type: "agent", description: "Revenue Ops — qualifies leads and tracks follow-up.", x: 150, y: 400 },
  { id: "dev", label: "Dev", type: "agent", description: "Build System — builds dashboards and integrations.", x: 650, y: 400 },
  { id: "data_analyst", label: "Data Analyst", type: "agent", description: "Signal Layer — analyzes performance and trends.", x: 400, y: 500 },
  { id: "mem_leads", label: "Lead Memory", type: "memory", description: "Cached lead qualification patterns and ICP data.", x: 100, y: 300 },
  { id: "mem_content", label: "Content Memory", type: "memory", description: "Historical content performance and topic clusters.", x: 700, y: 300 },
  { id: "mem_pipeline", label: "Pipeline Config", type: "data", description: "Sales pipeline stages and automation rules.", x: 300, y: 150 },
  { id: "mem_shared", label: "Shared Memory", type: "memory", description: "Cross-agent shared context and task history.", x: 500, y: 500 },
  { id: "topic_systems", label: "Agentic Systems", type: "topic", description: "Core topic hub for agentic OS content.", x: 550, y: 150 },
  { id: "topic_growth", label: "Growth Ops", type: "topic", description: "Business growth operations topic cluster.", x: 250, y: 450 },
  { id: "doc_dashboard", label: "Dashboard Proof", type: "content", description: "Dashboard proof-of-concept content series.", x: 700, y: 500 },
  { id: "doc_model_dev", label: "Models Dev Cache", type: "data", description: "Model development cache and configuration.", x: 150, y: 150 },
  { id: "artifact_writing", label: "Stage 3 Writing Prompt", type: "data", description: "Writing stage prompt artifact.", x: 350, y: 350 }
];
