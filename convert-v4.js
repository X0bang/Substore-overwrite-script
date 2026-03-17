/*!
 * 整合覆写脚本 v2.1 (Performance & Residential Optimization)
 * * 功能亮点：
 * 1. 自动识别家宽/住宅节点并建立专项分组。
 * 2. AI 策略组（Gemini/OpenAI/Claude）强制家宽优先。
 * 3. 增强型 DNS 过滤与规则分流。
 * 4. 自动剔除普通国家组中的家宽节点，节省昂贵流量。
 */

// ─── 参数解析 ────────────────────────────────────────────────────────────────

function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
}

function parseNumber(v, def = 0) {
  if (v == null) return def;
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

const rawArgs = typeof $arguments !== "undefined" ? $arguments : {};

const loadBalance     = parseBool(rawArgs.loadbalance);
const landing         = parseBool(rawArgs.landing);
const ipv6Enabled     = parseBool(rawArgs.ipv6);
const fullConfig      = parseBool(rawArgs.full);
const keepAlive       = parseBool(rawArgs.keepalive);
const fakeIPEnabled   = rawArgs.fakeip !== undefined ? parseBool(rawArgs.fakeip) : true;
const quicEnabled     = rawArgs.quic !== undefined ? parseBool(rawArgs.quic) : true;
const regexFilter     = parseBool(rawArgs.regex);
const dialerEnabled   = parseBool(rawArgs.dialer);
const countryThreshold = parseNumber(rawArgs.threshold, 0);

// ─── 国家/地区元数据 ──────────────────────────────────────────────────────────

const countriesMeta = {
  "家宽": {
    weight: 0,
    pattern: "家宽|家庭|住宅|Residential|Residential IP|ISP",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Home.png",
  },
  "香港": {
    weight: 10,
    pattern: "香港|港|HK|hk|Hong Kong|HongKong|hongkong|🇭🇰",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png",
  },
  "台湾": {
    weight: 20,
    pattern: "台|新北|彰化|TW|Taiwan|🇹🇼",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png",
  },
  "新加坡": {
    weight: 30,
    pattern: "新加坡|坡|狮城|SG|Singapore|🇸🇬",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png",
  },
  "日本": {
    weight: 40,
    pattern: "日本|川日|东京|大阪|泉日|埼玉|沪日|深日|JP|Japan|🇯🇵",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png",
  },
  "韩国": {
    weight: 45,
    pattern: "KR|Korea|KOR|首尔|韩|韓|🇰🇷",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Korea.png",
  },
  "美国": {
    weight: 50,
    pattern: "美国|美|US|United States|洛杉矶|LA|旧金山|圣何塞|San|Seattle|西雅图|芝加哥|Chicago|纽约|New York|达拉斯|Dallas|🇺🇸",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png",
  },
  "英国": {
    weight: 60,
    pattern: "英国|United Kingdom|UK|伦敦|London|🇬🇧",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_Kingdom.png",
  },
  "爱尔兰": {
    weight: 65,
    pattern: "爱尔兰|Ireland|🇮🇪",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Ireland.png",
  },
  "加拿大": {
    weight: 70,
    pattern: "加拿大|Canada|CA|🇨🇦",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Canada.png",
  },
  "法国": {
    weight: 80,
    pattern: "法国|法|FR|France|🇫🇷",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/France.png",
  },
  "澳大利亚": {
    weight: 90,
    pattern: "澳洲|澳大利亚|AU|Australia|🇦🇺",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Australia.png",
  },
  "德国": {
    weight: 100,
    pattern: "德国|德|DE|Germany|🇩🇪",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Germany.png",
  },
};

const RESIDENTIAL_PATTERN = "(?i)家宽|家庭|住宅|Residential|ISP";
const LOW_COST_PATTERN = "(?i)0\\.[0-5]|低倍率|省流|大流量|实验性";

// ─── 节点解析 ──────────────────────────────────────────────────────────────────

function parseNodes(proxies) {
  const countryMap = {};
  const lowCostNodes = [];
  const regexMap = {};
  
  for (const [name, meta] of Object.entries(countriesMeta)) {
    regexMap[name] = new RegExp(meta.pattern, "i");
  }

  for (const proxy of proxies) {
    const nodeName = proxy.name || "";
    
    // 识别低倍率
    if (new RegExp(LOW_COST_PATTERN).test(nodeName)) {
      lowCostNodes.push(nodeName);
    }

    // 分拣到国家组
    for (const [country, regex] of Object.entries(regexMap)) {
      if (regex.test(nodeName)) {
        if (!countryMap[country]) countryMap[country] = [];
        countryMap[country].push(nodeName);
        break; 
      }
    }
  }
  return { countryMap, lowCostNodes };
}

// ─── DNS 配置 ──────────────────────────────────────────────────────────────────

const dnsConfigBase = {
  enable: true,
  listen: "0.0.0.0:53",
  ipv6: ipv6Enabled,
  "default-nameserver": ["223.5.5.5", "119.29.29.29", "8.8.8.8"],
  "enhanced-mode": fakeIPEnabled ? "fake-ip" : "redir-host",
  "fake-ip-range": "198.18.0.1/16",
  nameserver: [
    "https://doh.pub/dns-query",
    "https://dns.alidns.com/dns-query",
  ],
  "fallback": [
    "https://8.8.8.8/dns-query",
    "https://1.1.1.1/dns-query",
    "tls://dns.google",
  ],
  "nameserver-policy": {
    "geosite:cn": "https://dns.alidns.com/dns-query",
    "geosite:google": "https://8.8.8.8/dns-query",
    "domain:ncbi.nlm.nih.gov,domain:uzh.ch,domain:zju.edu.cn": "https://dns.alidns.com/dns-query"
  }
};

// ... [此处省略冗长的 fakeIpFilter 数组，建议保留你原稿中的数组] ...

// ─── 规则列表 ──────────────────────────────────────────────────────────────────

function buildRules() {
  const rules = [
    // 基础直连
    "DOMAIN-SUFFIX,smtp,DIRECT",
    "DOMAIN-KEYWORD,aria2,DIRECT",
    "DOMAIN,clash.razord.top,DIRECT",
    "DOMAIN,yacd.haishan.me,国外流量",
    
    // 专项 AI (家宽优先)
    "RULE-SET,OpenAI,OpenAI",
    "RULE-SET,Claude,Claude",
    "RULE-SET,Gemini,Gemini",
    "RULE-SET,Perplexity,Perplexity",
    "RULE-SET,Copilot,Copilot",

    // 生物信息/学术流量 (建议直连或走高质量香港)
    "DOMAIN-SUFFIX,ncbi.nlm.nih.gov,DIRECT",
    "DOMAIN-SUFFIX,embl.org,国外流量",
    "DOMAIN-SUFFIX,nature.com,国外流量",
    "DOMAIN-SUFFIX,science.org,国外流量",

    // 常用分流
    "RULE-SET,AdBlock,REJECT",
    "RULE-SET,Apple,Apple",
    "RULE-SET,Bilibili,Bilibili",
    "RULE-SET,GitHub,国外流量",
    "RULE-SET,Google,国外流量",
    "RULE-SET,Telegram,Telegram",
    "RULE-SET,YouTube,YouTube",
    "RULE-SET,Netflix,Netflix",
    "RULE-SET,Steam,Steam",
    "RULE-SET,Direct,DIRECT",

    "GEOIP,CN,DIRECT",
    "MATCH,其他流量",
  ];

  if (!quicEnabled) {
    rules.unshift("AND,((DST-PORT,443),(NETWORK,UDP)),REJECT");
  }
  return rules;
}

// ─── 代理组构建 ────────────────────────────────────────────────────────────────

function buildProxyGroups({ countryMap, lowCostNodes }) {
  const groupType = loadBalance ? "url-test" : "select";
  const testConfig = loadBalance ? { url: "https://cp.cloudflare.com/generate_204", interval: 60, tolerance: 20 } : {};

  // 获取有效的国家组名
  const countryGroupNames = Object.keys(countryMap)
    .filter(name => countryMap[name].length >= countryThreshold)
    .sort((a, b) => (countriesMeta[a]?.weight ?? 999) - (countriesMeta[b]?.weight ?? 999))
    .map(name => name + "节点");

  const hasResidential = countryGroupNames.includes("家宽节点");

  // AI 专项：家宽 > 目标国家 > 兜底
  const aiProxies = (prefCountry) => {
    const list = [];
    if (hasResidential) list.push("家宽节点");
    if (countryGroupNames.includes(prefCountry + "节点")) list.push(prefCountry + "节点");
    list.push("国外流量", "AIRPORT");
    return [...new Set(list)];
  };

  const groups = [
    {
      name: "国外流量",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Area.png",
      type: "select",
      // 此处排除家宽，防止日常浏览误刷昂贵流量
      proxies: ["故障转移", ...countryGroupNames.filter(n => n !== "家宽节点"), "手动选择", "DIRECT"],
    },
    {
      name: "其他流量",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Final.png",
      type: "select",
      proxies: ["国外流量", "直接连接", ...countryGroupNames, "AIRPORT"],
    },
    
    // 专项 AI
    { name: "Gemini", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AI.png", type: "select", proxies: aiProxies("美国") },
    { name: "OpenAI", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png", type: "select", proxies: aiProxies("美国") },
    { name: "Claude", icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Claude.png", type: "select", proxies: aiProxies("英国") },
    
    // 社交/媒体
    { name: "YouTube", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png", type: "select", proxies: ["国外流量", ...countryGroupNames] },
    { name: "Telegram", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png", type: "select", proxies: ["国外流量", "故障转移"] },
    { name: "Bilibili", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/bilibili.png", type: "select", proxies: ["DIRECT", "台湾节点", "香港节点"] },

    // 核心工具
    { name: "故障转移", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png", type: "fallback", url: "https://cp.cloudflare.com/generate_204", proxies: countryGroupNames.filter(n => n !== "家宽节点"), interval: 180 },
    { name: "手动选择", icon: "https://gcore.jsdelivr.net/gh/shindgewongxj/WHATSINStash@master/icon/select.png", type: "select", "include-all": true },
    { name: "直接连接", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Direct.png", type: "select", proxies: ["DIRECT"] },

    // 自动生成的国家分组
    ...countryGroupNames.map(gName => {
      const country = gName.replace("节点", "");
      const meta = countriesMeta[country];
      // 关键逻辑：如果不是家宽组，则在过滤中剔除家宽节点名
      const excludeFilter = country === "家宽" ? LOW_COST_PATTERN : `${LOW_COST_PATTERN}|${RESIDENTIAL_PATTERN}`;
      
      return {
        name: gName,
        icon: meta.icon,
        type: groupType,
        "include-all": true,
        filter: meta.pattern,
        "exclude-filter": excludeFilter,
        ...testConfig,
      };
    }),

    { name: "AIRPORT", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png", type: "select", "include-all": true },
  ];

  return groups.filter(Boolean);
}

// ─── 主函数 ────────────────────────────────────────────────────────────────────

function main(params) {
  const proxies = params.proxies || [];
  const { countryMap, lowCostNodes } = parseNodes(proxies);

  return {
    ...params,
    dns: dnsConfigBase,
    "proxy-groups": buildProxyGroups({ countryMap, lowCostNodes }),
    rules: buildRules(),
  };
}