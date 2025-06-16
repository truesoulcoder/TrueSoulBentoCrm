// next-sitemap.js
const sitemapConfig = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://truesoulpartners.vercel.app',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [{ userAgent: '*', allow: '/' }]
  }
};

export default sitemapConfig;
