import { PrismaClient, ReportPeriod } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.reportImage.deleteMany();
  await prisma.report.deleteMany();
  await prisma.company.deleteMany();
  await prisma.industry.deleteMany();

  const banking = await prisma.industry.create({
    data: { slug: "tai-chinh-ngan-hang", name: "Tài chính - Ngân hàng" },
  });

  const tech = await prisma.industry.create({
    data: { slug: "cong-nghe", name: "Công nghệ" },
  });

  const vcb = await prisma.company.create({
    data: {
      slug: "vcb",
      name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)",
      ticker: "VCB",
      country: "Việt Nam",
      exchange: "HOSE",
      industryId: banking.id,
    },
  });

  const aapl = await prisma.company.create({
    data: {
      slug: "aapl",
      name: "Apple Inc.",
      ticker: "AAPL",
      country: "Hoa Kỳ",
      exchange: "NASDAQ",
      industryId: tech.id,
    },
  });

  await prisma.report.create({
    data: {
      companyId: vcb.id,
      year: 2026,
      period: ReportPeriod.Q2,
      title: "VCB - Phân tích báo cáo tài chính Quý 2/2026",
      contentMd:
        "Tóm tắt: Lợi nhuận trước thuế tăng trưởng so với cùng kỳ nhờ tăng trưởng tín dụng và kiểm soát tốt chi phí dự phòng rủi ro.\n\nCác điểm chính:\n- Thu nhập lãi thuần tăng trưởng ổn định.\n- Tỷ lệ nợ xấu (NPL) được kiểm soát ở mức thấp.\n- Biên lãi ròng (NIM) duy trì ổn định so với quý trước.",
      author: "Claude",
      images: {
        create: [{ url: "https://placehold.co/800x400?text=VCB+Q2+2026", caption: "Biểu đồ lợi nhuận theo quý", order: 0 }],
      },
    },
  });

  await prisma.report.create({
    data: {
      companyId: aapl.id,
      year: 2026,
      period: ReportPeriod.Q2,
      title: "AAPL - Financial Report Analysis Q2 2026",
      contentMd:
        "Summary: Revenue growth driven by Services and iPhone segments.\n\nKey points:\n- Gross margin expanded year over year.\n- Services revenue continues double-digit growth.\n- Strong operating cash flow supports continued buybacks.",
      author: "Claude",
      images: {
        create: [{ url: "https://placehold.co/800x400?text=AAPL+Q2+2026", caption: "Revenue by segment", order: 0 }],
      },
    },
  });

  await prisma.report.create({
    data: {
      companyId: aapl.id,
      year: 2025,
      period: ReportPeriod.ANNUAL,
      title: "AAPL - Annual Report Analysis FY2025",
      contentMd:
        "Summary: Full year results showed resilient demand across product lines.\n\nKey points:\n- Full-year revenue at record levels.\n- Continued investment in R&D.\n- Strong balance sheet with significant cash returns to shareholders.",
      author: "Claude",
    },
  });

  console.log("Seed data created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
