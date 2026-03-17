/*!
 * 整合覆写脚本
 * 基于 powerfullz/override-rules 的节点自动分类机制
 * 整合 zuluion/Clash-Template-Config 的配置结构
 *
 * 支持的传入参数：
 * - loadbalance: 启用负载均衡（url-test/load-balance，默认 false）
 * - landing: 启用落地节点功能（默认 false）
 * - ipv6: 启用 IPv6 支持（默认 false）
 * - full: 输出完整配置（适合纯内核启动，默认 false）
 * - keepalive: 启用 tcp-keep-alive（默认 false）
 * - fakeip: DNS 使用 FakeIP 模式（默认 true）
 * - quic: 允许 QUIC 流量（UDP 443，默认 false）
 * - threshold: 国家节点数量小于该值时不显示分组（默认 0）
 * - regex: 使用正则过滤模式（默认 false）
 * - dialer: 启用 ProxyDialer 链式代理（默认 false）
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

const loadBalance    = parseBool(rawArgs.loadbalance);
const landing        = parseBool(rawArgs.landing);
const ipv6Enabled    = parseBool(rawArgs.ipv6);
const fullConfig     = parseBool(rawArgs.full);
const keepAlive      = parseBool(rawArgs.keepalive);
const fakeIPEnabled  = rawArgs.fakeip !== undefined ? parseBool(rawArgs.fakeip) : true; // 默认 true
const quicEnabled    = rawArgs.quic !== undefined ? parseBool(rawArgs.quic) : true; // 默认允许 QUIC
const regexFilter    = parseBool(rawArgs.regex);
const dialerEnabled  = parseBool(rawArgs.dialer);
const countryThreshold = parseNumber(rawArgs.threshold, 0);

// ─── 国家/地区元数据 ──────────────────────────────────────────────────────────

const countriesMeta = {
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
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_Kingdom.png",
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
  "俄罗斯": {
    weight: 110,
    pattern: "俄罗斯|俄|RU|Russia|莫斯科|🇷🇺",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Russia.png",
  },
  "印度": {
    weight: 120,
    pattern: "印度|IN|India|🇮🇳",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/India.png",
  },
  "泰国": {
    weight: 130,
    pattern: "泰国|泰|TH|Thailand|🇹🇭",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Thailand.png",
  },
  "马来西亚": {
    weight: 140,
    pattern: "马来西亚|马来|MY|Malaysia|🇲🇾",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Malaysia.png",
  },
};

const LANDING_REGEX = /家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地/i;
const LANDING_PATTERN = "(?i)家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地";
const LOW_COST_REGEX = /0\.[0-5]|低倍率|省流|大流量|实验性/i;

// ─── 节点解析 ──────────────────────────────────────────────────────────────────

function parseCountries(proxies) {
  const result = {};
  const regexMap = {};
  for (const [name, meta] of Object.entries(countriesMeta)) {
    regexMap[name] = new RegExp(meta.pattern);
  }
  for (const proxy of proxies) {
    const nodeName = proxy.name || "";
    if (LANDING_REGEX.test(nodeName) || LOW_COST_REGEX.test(nodeName)) continue;
    for (const [country, regex] of Object.entries(regexMap)) {
      if (regex.test(nodeName)) {
        if (!result[country]) result[country] = [];
        result[country].push(nodeName);
        break;
      }
    }
  }
  return result;
}

function parseLandingNodes(proxies) {
  return proxies.filter(p => LANDING_REGEX.test(p.name || "")).map(p => p.name);
}

function parseLowCostNodes(proxies) {
  return proxies.filter(p => LOW_COST_REGEX.test(p.name || "")).map(p => p.name);
}

function getCountryGroupNames(countryMap) {
  return Object.entries(countryMap)
    .filter(([, nodes]) => nodes.length >= countryThreshold)
    .sort(([a], [b]) => (countriesMeta[a]?.weight ?? 999) - (countriesMeta[b]?.weight ?? 999))
    .map(([country]) => country + "节点");
}

// ─── DNS 配置 ──────────────────────────────────────────────────────────────────

const dnsConfigBase = {
  enable: true,
  listen: "0.0.0.0:53",
  ipv6: ipv6Enabled,
  "default-nameserver": ["114.114.114.114", "223.5.5.5", "8.8.8.8"],
  "enhanced-mode": fakeIPEnabled ? "fake-ip" : "redir-host",
  nameserver: [
    "https://doh.pub/dns-query",
    "https://dns.alidns.com/dns-query",
  ],
  "fallback-filter": {
    geoip: false,
    ipcidr: [
      "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
      "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
      "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
      "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4", "255.255.255.255/32",
    ],
    domain: [
      "+.google.com", "+.facebook.com", "+.youtube.com",
      "+.githubusercontent.com", "+.googlevideo.com",
    ],
  },
};

const fakeIpFilter = [
  "*.lan", "*.localdomain", "*.example", "*.invalid", "*.localhost",
  "*.test", "*.local", "*.home.arpa",
  "time.*.com", "time.*.gov", "time.*.edu.cn", "time.*.apple.com",
  "time1.*.com", "time2.*.com", "time3.*.com", "time4.*.com",
  "time5.*.com", "time6.*.com", "time7.*.com",
  "ntp.*.com", "ntp1.*.com", "ntp2.*.com", "ntp3.*.com",
  "ntp4.*.com", "ntp5.*.com", "ntp6.*.com", "ntp7.*.com",
  "*.time.edu.cn", "*.ntp.org.cn", "+.pool.ntp.org",
  "time1.cloud.tencent.com",
  "music.163.com", "*.music.163.com", "*.126.net",
  "musicapi.taihe.com", "music.taihe.com",
  "songsearch.kugou.com", "trackercdn.kugou.com", "*.kuwo.cn",
  "api-jooxtt.sanook.com", "api.joox.com", "joox.com",
  "y.qq.com", "*.y.qq.com", "streamoc.music.tc.qq.com",
  "mobileoc.music.tc.qq.com", "isure.stream.qqmusic.qq.com",
  "dl.stream.qqmusic.qq.com", "aqqmusic.tc.qq.com", "amobile.music.tc.qq.com",
  "*.xiami.com", "*.music.migu.cn", "music.migu.cn",
  "*.msftconnecttest.com", "*.msftncsi.com", "msftconnecttest.com", "msftncsi.com",
  "localhost.ptlogin2.qq.com", "localhost.sec.qq.com",
  "+.srv.nintendo.net", "+.stun.playstation.net",
  "xbox.*.microsoft.com", "*.*.xboxlive.com",
  "+.battlenet.com.cn", "+.wotgame.cn", "+.wggames.cn", "+.wowsgame.cn", "+.wargaming.net",
  "proxy.golang.org",
  "stun.*.*", "stun.*.*.*", "+.stun.*.*", "+.stun.*.*.*", "+.stun.*.*.*.*",
  "heartbeat.belkin.com", "*.linksys.com", "*.linksyssmartwifi.com", "*.router.asus.com",
  "mesu.apple.com", "swscan.apple.com", "swquery.apple.com",
  "swdownload.apple.com", "swcdn.apple.com", "swdist.apple.com",
  "lens.l.google.com", "stun.l.google.com",
  "+.nflxvideo.net", "*.square-enix.com", "*.finalfantasyxiv.com", "*.ffxiv.com",
  "*.mcdn.bilivideo.cn", "WORKGROUP",
];

function buildDnsConfig() {
  const dns = { ...dnsConfigBase };
  if (fakeIPEnabled) {
    dns["fake-ip-range"] = "198.18.0.1/16";
    dns["fake-ip-filter"] = fakeIpFilter;
  }
  return dns;
}

// ─── 规则集 ────────────────────────────────────────────────────────────────────

const ruleProviders = {
  AdBlock:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/AdBlock.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/AdBlock.yaml" },
  Adobe:          { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Adobe.yaml",          url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Adobe.yaml" },
  Amazon:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Amazon.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Amazon.yaml" },
  Apple:          { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Apple.yaml",          url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Apple.yaml" },
  Bilibili:       { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Bilibili.yaml",       url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Bilibili.yaml" },
  Claude:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Claude.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Claude.yaml" },
  Copilot:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Copilot.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Copilot.yaml" },
  Direct:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Direct.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Direct.yaml" },
  Discord:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Discord.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Discord.yaml" },
  DisneyPlus:     { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/DisneyPlus.yaml",     url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/DisneyPlus.yaml" },
  DownLoadClient: { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/DownLoadClient.yaml", url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/DownLoadClient.yaml" },
  Facebook:       { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Facebook.yaml",       url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Facebook.yaml" },
  Gemini:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Gemini.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Gemini.yaml" },
  GitHub:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/GitHub.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/GitHub.yaml" },
  Google:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Google.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Google.yaml" },
  AWAvenueAds:    { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/AWAvenue-Ads-Rule.yaml", url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/AWAvenue-Ads-Rule.yaml" },
  HBO:            { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/HBO.yaml",            url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/HBO.yaml" },
  Hulu:           { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Hulu.yaml",           url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Hulu.yaml" },
  IDM:            { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/IDM.yaml",            url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/IDM.yaml" },
  JavSP:          { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/JavSP.yaml",          url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/JavSP.yaml" },
  Microsoft:      { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Microsoft.yaml",      url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Microsoft.yaml" },
  Netch:          { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Netch.yaml",          url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Netch.yaml" },
  Netflix:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Netflix.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Netflix.yaml" },
  OneDrive:       { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/OneDrive.yaml",       url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/OneDrive.yaml" },
  OpenAI:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/OpenAI.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/OpenAI.yaml" },
  OutLook:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/OutLook.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/OutLook.yaml" },
  PayPal:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/PayPal.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/PayPal.yaml" },
  Perplexity:     { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Perplexity.yaml",     url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Perplexity.yaml" },
  PikPak:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/PikPak.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/PikPak.yaml" },
  Proxy:          { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Proxy.yaml",          url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Proxy.yaml" },
  ProxyClient:    { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/ProxyClient.yaml",    url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/ProxyClient.yaml" },
  Reddit:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Reddit.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Reddit.yaml" },
  Speedtest:      { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Speedtest.yaml",      url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Speedtest.yaml" },
  Spotify:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Spotify.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Spotify.yaml" },
  Steam:          { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Steam.yaml",          url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Steam.yaml" },
  Telegram:       { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Telegram.yaml",       url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Telegram.yaml" },
  Tencent:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Tencent.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Tencent.yaml" },
  TikTok:         { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/TikTok.yaml",         url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/TikTok.yaml" },
  Twitter:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Twitter.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Twitter.yaml" },
  Ubisoft:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/Ubisoft.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/Ubisoft.yaml" },
  YouTube:        { type: "http", behavior: "classical", interval: 3600, path: "myprovider/ruleset/YouTube.yaml",        url: "https://cdn.jsdelivr.net/gh/zuluion/Clash-Template-Config@master/Filter/YouTube.yaml" },
};

// ─── 规则列表 ──────────────────────────────────────────────────────────────────

function buildRules() {
  const rules = [
    "DOMAIN-SUFFIX,smtp,DIRECT",
    "DOMAIN-KEYWORD,aria2,DIRECT",
    "DOMAIN,clash.razord.top,DIRECT",
    "DOMAIN-SUFFIX,lancache.steamcontent.com,DIRECT",
    "DOMAIN-SUFFIX,steamserver.net,DIRECT",
    "DOMAIN,yacd.haishan.me,国外流量",
    "DOMAIN-SUFFIX,appinn.com,国外流量",
    "RULE-SET,OpenAI,OpenAI",
    "RULE-SET,Claude,Claude",
    "RULE-SET,Gemini,Gemini",
    "RULE-SET,Perplexity,Perplexity",
    "RULE-SET,DownLoadClient,DIRECT",
    "RULE-SET,ProxyClient,DIRECT",
    "RULE-SET,AdBlock,REJECT",
    "RULE-SET,Apple,Apple",
    "RULE-SET,Adobe,其他流量",
    "RULE-SET,Amazon,Amazon",
    "RULE-SET,Bilibili,Bilibili",
    "RULE-SET,GitHub,国外流量",
    "RULE-SET,Google,国外流量",
    "RULE-SET,Copilot,Copilot",
    "RULE-SET,OneDrive,OneDrive",
    "RULE-SET,OutLook,OutLook",
    "RULE-SET,Microsoft,Microsoft",
    "RULE-SET,Netflix,Netflix",
    "RULE-SET,DisneyPlus,DisneyPlus",
    "RULE-SET,Hulu,Hulu",
    "RULE-SET,HBO,HBO",
    "RULE-SET,TikTok,TikTok",
    "RULE-SET,Speedtest,Speedtest",
    "RULE-SET,Steam,Steam",
    "RULE-SET,Ubisoft,Ubisoft",
    "RULE-SET,Netch,Netch",
    "RULE-SET,Spotify,Spotify",
    "RULE-SET,PikPak,PikPak",
    "RULE-SET,Telegram,Telegram",
    "RULE-SET,Twitter,国外流量",
    "RULE-SET,Tencent,直接连接",
    "RULE-SET,YouTube,YouTube",
    "RULE-SET,PayPal,PayPal",
    "RULE-SET,Discord,Discord",
    "RULE-SET,Facebook,Facebook",
    "RULE-SET,Reddit,Reddit",
    "RULE-SET,JavSP,JavSP",
    "RULE-SET,Proxy,国外流量",
    "RULE-SET,Direct,DIRECT",
    "RULE-SET,IDM,IDM",
    "DOMAIN-SUFFIX,live.cn,直接连接",
    "GEOIP,CN,DIRECT",
    "MATCH,其他流量",
  ];

  if (!quicEnabled) {
    rules.unshift("AND,((DST-PORT,443),(NETWORK,UDP)),REJECT");
  }

  return rules;
}

// ─── 代理组构建 ────────────────────────────────────────────────────────────────

function buildProxyGroups({ countryGroupNames, countryMap, landingNodes, lowCostNodes }) {
  // 国家分组 - 默认 select，loadbalance 参数开启后才自动测速
  const groupType  = loadBalance ? "url-test" : "select";
  const testConfig = loadBalance ? { url: "https://cp.cloudflare.com/generate_204", interval: 60, tolerance: 20, lazy: false } : {};

  // 判断是否有特定地区节点
  const hasUS = countryGroupNames.includes("美国节点");
  const hasHK = countryGroupNames.includes("香港节点");
  const hasTW = countryGroupNames.includes("台湾节点");
  const hasEN = countryGroupNames.includes("英国节点");
  const hasKR = countryGroupNames.includes("韩国节点");
  const hasJP = countryGroupNames.includes("日本节点");
  const hasSG = countryGroupNames.includes("新加坡节点");
  const hasIE = countryGroupNames.includes("爱尔兰节点");
  const hasCA = countryGroupNames.includes("加拿大节点");
  const hasFR = countryGroupNames.includes("法国节点");
  const hasAU = countryGroupNames.includes("澳大利亚节点");

  // 全部节点列表
  const allProxies = ["国外流量", "直接连接", ...countryGroupNames, "AIRPORT"];
  const allProxiesDirect = ["直接连接", "国外流量", ...countryGroupNames, "AIRPORT"];
  const allProxiesForeign = [...countryGroupNames, "AIRPORT"];

  // AI 专用节点优先级（英国 > 美国 > 韩国 > 日本 > 新加坡 > 爱尔兰 > 加拿大 > 法国 > 澳大利亚）
  const claudeProxies = [
    hasEN && "英国节点", hasUS && "美国节点", hasKR && "韩国节点",
    hasJP && "日本节点", hasSG && "新加坡节点", hasIE && "爱尔兰节点",
    hasCA && "加拿大节点", hasFR && "法国节点", hasAU && "澳大利亚节点",
    "AIRPORT",
  ].filter(Boolean);

  const openaiProxies = [
    hasKR && "韩国节点", hasJP && "日本节点", hasHK && "香港节点",
    hasUS && "美国节点", hasSG && "新加坡节点", hasEN && "英国节点",
    hasIE && "爱尔兰节点", hasCA && "加拿大节点", hasFR && "法国节点",
    hasAU && "澳大利亚节点", "AIRPORT",
  ].filter(Boolean);

  const geminiProxies = [
    hasUS && "美国节点", hasEN && "英国节点", hasKR && "韩国节点",
    hasJP && "日本节点", hasSG && "新加坡节点", hasIE && "爱尔兰节点",
    hasCA && "加拿大节点", hasFR && "法国节点", hasAU && "澳大利亚节点",
    "AIRPORT",
  ].filter(Boolean);

  const tiktokProxies = [
    hasUS && "美国节点", "国外流量", "AIRPORT",
    ...countryGroupNames.filter(n => n !== "美国节点"),
  ].filter(Boolean);

  const javspProxies = [
    hasJP && "日本节点", "国外流量", "直接连接",
    ...countryGroupNames.filter(n => n !== "日本节点"), "AIRPORT",
  ].filter(Boolean);

  const redditProxies = [
    hasUS && "美国节点", "国外流量", "AIRPORT",
    ...countryGroupNames.filter(n => n !== "美国节点"),
  ].filter(Boolean);

  // 故障转移组
  const fallbackProxies = [
    landing && "落地节点",
    ...countryGroupNames,
    "手动选择",
    "DIRECT",
  ].filter(Boolean);

  // 国家分组
  const countryGroups = countryGroupNames.map(groupName => {
    const country = groupName.replace(/节点$/, "");
    const meta = countriesMeta[country];
    if (!meta) return null;

    if (regexFilter) {
      const excludeLanding = landing ? `|${LANDING_PATTERN}` : "";
      return {
        name: groupName,
        icon: meta.icon,
        "include-all": true,
        filter: meta.pattern,
        "exclude-filter": `0\\.[0-5]|低倍率|省流|大流量|实验性${excludeLanding}`,
        type: groupType,
        ...testConfig,
      };
    } else {
      return {
        name: groupName,
        icon: meta.icon,
        type: groupType,
        proxies: countryMap[country] || [],
        ...testConfig,
      };
    }
  }).filter(Boolean);

  const groups = [
    // 核心选择组
    {
      name: "国外流量",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Area.png",
      type: "select",
      proxies: ["故障转移", ...countryGroupNames, lowCostNodes.length > 0 ? "低倍率节点" : null, "手动选择", "DIRECT"].filter(Boolean),
    },
    {
      name: "其他流量",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Final.png",
      type: "select",
      proxies: allProxies,
    },
    {
      name: "手动选择",
      icon: "https://gcore.jsdelivr.net/gh/shindgewongxj/WHATSINStash@master/icon/select.png",
      "include-all": true,
      type: "select",
    },

    // 落地节点（可选）
    landing && {
      name: "前置代理",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Area.png",
      type: "select",
      proxies: [...countryGroupNames, "手动选择", "DIRECT"],
    },
    landing && {
      name: "落地节点",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png",
      type: "select",
      ...(regexFilter
        ? { "include-all": true, filter: LANDING_PATTERN }
        : { proxies: landingNodes.length > 0 ? landingNodes : ["DIRECT"] }),
    },

    // 故障转移
    {
      name: "故障转移",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png",
      type: "fallback",
      url: "https://cp.cloudflare.com/generate_204",
      proxies: fallbackProxies,
      interval: 180,
      tolerance: 20,
      lazy: false,
    },

    // AI 专用
    { name: "OpenAI",     icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png",   type: "select", proxies: openaiProxies },
    { name: "Claude",     icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Claude.png",            type: "select", proxies: claudeProxies },
    { name: "Gemini",     icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AI.png",         type: "select", proxies: geminiProxies },
    { name: "Perplexity", icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Perplexity.png",        type: "select", proxies: geminiProxies },
    { name: "Copilot",    icon: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Microsoft_Copilot.png", type: "select", proxies: allProxies },

    // 媒体
    { name: "YouTube",    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png",    type: "select", proxies: allProxies },
    { name: "Netflix",    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Netflix.png",    type: "select", proxies: allProxies },
    { name: "DisneyPlus", icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Disney+_1.png",  type: "select", proxies: allProxies },
    { name: "Hulu",       icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hulu.png",       type: "select", proxies: allProxies },
    { name: "HBO",        icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/HBO_1.png",      type: "select", proxies: allProxies },
    { name: "TikTok",     icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/TikTok.png",     type: "select", proxies: tiktokProxies },
    { name: "Bilibili",   icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/bilibili.png",   type: "select", proxies: hasTW && hasHK ? ["直接连接", "台湾节点", "香港节点"] : allProxiesDirect },
    { name: "Spotify",    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Spotify.png",    type: "select", proxies: allProxies },

    // 社交
    { name: "Telegram",   icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png",   type: "select", proxies: allProxies },
    { name: "Discord",    icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Discord.png",           type: "select", proxies: allProxies },
    { name: "Facebook",   icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Facebook.png",          type: "select", proxies: allProxies },
    { name: "Reddit",     icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Reddit.png",            type: "select", proxies: redditProxies },
    { name: "Twitter",    icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Twitter.png",           type: "select", proxies: allProxies },

    // 科技/工具
    { name: "Google",     icon: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Google.png",         type: "select", proxies: allProxies },
    { name: "Microsoft",  icon: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Microsoft_Copilot.png", type: "select", proxies: allProxiesDirect },
    { name: "OneDrive",   icon: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Onedrive.png",       type: "select", proxies: allProxiesDirect },
    { name: "OutLook",    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Mail.png",                type: "select", proxies: allProxies },
    { name: "Apple",      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Apple_1.png",             type: "select", proxies: allProxiesDirect },
    { name: "Amazon",     icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Amazon_1.png",            type: "select", proxies: allProxiesDirect },
    { name: "GitHub",     icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/GitHub.png",              type: "select", proxies: allProxies },
    { name: "PayPal",     icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/PayPal.png",              type: "select", proxies: allProxies },

    // 游戏
    { name: "Steam",      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Steam.png",      type: "select", proxies: allProxies },
    { name: "Ubisoft",    icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Ubisoft.png",           type: "select", proxies: allProxies },
    { name: "Netch",      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Game.png",       type: "select", proxies: allProxies },

    // 其他
    { name: "PikPak",     icon: "https://gcore.jsdelivr.net/gh/powerfullz/override-rules@master/icons/PikPak.png", type: "select", proxies: allProxies },
    { name: "Speedtest",  icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Speedtest.png",   type: "select", proxies: allProxiesDirect },
    { name: "JavSP",      icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/JavSP.png",              type: "select", proxies: javspProxies },
    { name: "IDM",        icon: "https://gcore.jsdelivr.net/gh/zuluion/Qure/IconSet/Color/Download.png",           type: "select", proxies: ["直接连接", "国外流量"] },

    // 基础
    { name: "直接连接",   icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Direct.png",     type: "select", hidden: true, proxies: ["DIRECT"] },
    {
      name: "广告拦截",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png",
      type: "select",
      proxies: ["REJECT", "REJECT-DROP", "直接连接"],
    },

    // 低倍率（有则显示）
    lowCostNodes.length > 0 || regexFilter ? {
      name: "低倍率节点",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Lab.png",
      type: groupType,
      ...(regexFilter
        ? { "include-all": true, filter: "(?i)0\\.[0-5]|低倍率|省流|大流量|实验性" }
        : { proxies: lowCostNodes }),
      ...testConfig,
    } : null,

    // AIRPORT 总组
    {
      name: "AIRPORT",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png",
      "include-all": true,
      type: "select",
    },

    // 国家分组
    ...countryGroups,

    // ProxyDialer（可选）
    dialerEnabled ? {
      name: "ProxyDialer",
      icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
      type: "select",
      proxies: ["直接连接", ...countryGroupNames, "手动选择", "AIRPORT"],
    } : null,

  ].filter(Boolean);

  // GLOBAL 组
  const globalProxies = groups.map(g => g.name);
  groups.push({
    name: "GLOBAL",
    icon: "https://gcore.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png",
    "include-all": true,
    type: "select",
    proxies: globalProxies,
  });

  return groups;
}

// ─── proxy-providers ──────────────────────────────────────────────────────────

function buildProxyProviders() {
  const provider = {
    type: "http",
    interval: 36000,
    path: "myprovider/proxies/provider-airport.yml",
    url: "",
  };
  if (dialerEnabled) {
    provider.override = { "dialer-proxy": "ProxyDialer" };
  }
  return { airport: provider };
}

// ─── 主函数 ────────────────────────────────────────────────────────────────────

function main(params) {
  const proxies = params.proxies || [];

  const countryMap        = parseCountries(proxies);
  const landingNodes      = landing ? parseLandingNodes(proxies) : [];
  const lowCostNodes      = parseLowCostNodes(proxies);
  const countryGroupNames = getCountryGroupNames(countryMap);

  const proxyGroups    = buildProxyGroups({ countryGroupNames, countryMap, landingNodes, lowCostNodes });
  const proxyProviders = buildProxyProviders();
  const rules          = buildRules();
  const dns            = buildDnsConfig();

  const result = { proxies };

  if (fullConfig) {
    Object.assign(result, {
      "mixed-port": 7890,
      "redir-port": 7892,
      "tproxy-port": 7893,
      "routing-mark": 7894,
      "allow-lan": true,
      ipv6: ipv6Enabled,
      mode: "rule",
      "unified-delay": true,
      "tcp-concurrent": true,
      "find-process-mode": "off",
      "log-level": "info",
      "geodata-loader": "standard",
      "external-controller": ":9090",
      "disable-keep-alive": !keepAlive,
      profile: { "store-selected": true },
    });
  }

  Object.assign(result, {
    "proxy-groups":    proxyGroups,
    "proxy-providers": proxyProviders,
    "rule-providers":  ruleProviders,
    rules,
    dns,
    "geodata-mode": true,
    "geox-url": {
      geoip:   "https://gcore.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
      geosite: "https://gcore.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
      mmdb:    "https://gcore.jsdelivr.net/gh/Loyalsoldier/geoip@release/Country.mmdb",
      asn:     "https://gcore.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-ASN.mmdb",
    },
  });

  return result;
}

