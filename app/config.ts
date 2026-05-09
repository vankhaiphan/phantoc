const config = {
  siteName: process.env.SITE_NAME || "Phan Tộc",
  siteSubtitle: process.env.SITE_SUBTITLE || "Gia Phả Họ Phan",
  demoDomain: process.env.DEMO_DOMAIN || "",
  /**
   * The founding chi for this archive.
   * Seeded into the `branches` table by supabase/seed.sql.
   */
  foundingChi: {
    name: "Chi tộc Phan - làng Cẩm Nê",
    locality: "xã Hòa Tiến, huyện Hòa Vang, thành phố Đà Nẵng",
    country: "Việt Nam",
  },
};

export default config;
