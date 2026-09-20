# Kế hoạch tăng traffic (lập 2026-09-20)

Mục tiêu: có người vào site, ưu tiên độc giả ở các nước CPM cao (Mỹ, Canada, Anh, Úc).
Nội dung tiếng Anh nên một site phục vụ được cả bốn nước.

## Ràng buộc quan trọng nhất: ngân sách usage

Routine `trig_01GNdUY59Na4x3JxMr6p7mxK` chạy hàng giờ 14:00–19:00 UTC nhưng nhiều lần
bị chặn bởi giới hạn session 5 giờ của tài khoản (09-18 và 09-19: các lần bắn cuối đêm
thoát sau ~6 giây với "You've hit your session limit"). Mọi routine dùng LLM thêm vào
sẽ lấy chung ngân sách này, tức là bớt đi số report nightly.

Nguyên tắc lập lịch:
1. Việc nào không cần LLM thì chạy bằng Vercel Cron / GitHub Actions (không tốn usage).
2. Việc cần LLM thì ưu tiên sửa chỉ dẫn của routine hiện có (CLAUDE.md) thay vì tạo routine mới.
3. Routine mới chỉ ở tần suất tuần, và chỉ tạo sau khi biết số report/đêm hiện tại ổn định.
4. Không cho hai routine cùng ghi `report-tracker.json` (đã có race, xem nightly-log 09-19).

## Giai đoạn 1 — Nền tảng (tuần 1, làm trong code, không tốn usage nightly)

| # | Việc | Loại |
|---|---|---|
| 1.1 | Đăng ký Google Search Console + Bing Webmaster, gửi `/sitemap.xml` | Thủ công (bạn), 15 phút |
| 1.2 | Sitemap chỉ liệt kê công ty/năm có report; trang công ty rỗng đặt `noindex` | Code |
| 1.3 | Trang About, Methodology, Privacy, Contact, Corrections; footer có link tới các trang này | Code + viết nội dung |
| 1.4 | Mỗi report hiển thị link tới filing gốc trên SEC (cần thêm trường `sourceUrl` trong schema, hoặc quy ước dòng "Source:" trong markdown) | Code + sửa quy trình publish |
| 1.5 | Ảnh OG động bằng `next/og` (ticker, kỳ, doanh thu, EPS, YoY) thay cho placehold.co | Code |
| 1.6 | JSON-LD: BreadcrumbList, `dateModified`, `publisher`; RSS `/feed.xml` | Code |
| 1.7 | Internal links trong report: kỳ trước, công ty cùng ngành; trang chủ hiện report mới nhất | Code |
| 1.8 | Bỏ `force-dynamic` ở trang công khai, dùng cache + `revalidatePath` sau publish | Code, cần thử kỹ vì có lỗi CDN stale đã ghi nhận |
| 1.9 | Đã xong: bỏ dòng "Analysis authored by Claude..." ở footer | Xong 2026-09-20 |

Ghi chú về 1.9: dòng disclaimer đó là chỗ duy nhất trên site nói đây không phải lời khuyên
đầu tư. Nên đưa cùng nội dung vào trang About/Methodology (1.3) để giữ tín hiệu minh bạch
cho Google (mảng YMYL) và cho AdSense.

## Giai đoạn 2 — Đổi thứ tự ưu tiên dữ liệu (tuần 1–2, sửa CLAUDE.md)

Hiện tier 1 chạy theo thứ tự file (bảng chữ cái). Đề xuất thay bằng:

1. Tier 0 giữ nguyên (filing mới trên EDGAR).
2. Tier 1a: danh sách "hot list" khoảng 100 mã theo nhu cầu tìm kiếm (mega-cap và mã retail
   hay bàn: AAPL, NVDA, MSFT, AMZN, GOOGL, META, TSLA, AVGO, PLTR, AMD, NFLX, JPM, COIN...),
   lưu ở `scripts/data/priority-tickers.json`.
3. Tier 1b: phần còn lại của S&P 500 theo lịch earnings sắp tới (ưu tiên mã sắp báo cáo).
4. Tier 1c: us-listed như cũ.

Kèm theo:
- Mùa earnings Q3 bắt đầu khoảng 2026-10-14. Trước đó cần xong hot list cho kỳ Q2 để có
  "kỳ trước" làm nền so sánh.
- Cửa sổ 14–20 UTC bắt được công ty báo trước giờ mở cửa nhưng bỏ lỡ công ty báo sau giờ
  đóng cửa. Nếu ngân sách cho phép, dời một phần lượt chạy sang 21:00–02:00 UTC trong mùa
  earnings (đổi cron của routine hiện có, không thêm routine).
- Lưu metrics có cấu trúc (revenue, EPS, operating margin, YoY) vào DB khi publish, để
  làm được bảng xếp hạng/so sánh/scorecard sau này. Cần sửa schema Prisma và admin form.

## Giai đoạn 3 — Loại nội dung mới (tháng 1–2)

| Nội dung | Lịch | Cách tự động |
|---|---|---|
| Earnings preview ("what to watch") cho các mã trong tuần tới | Chủ nhật hằng tuần, chỉ trong mùa earnings | 1 routine tuần mới (tốn usage, xem ràng buộc) |
| So sánh 2 công ty cùng ngành | 2–3 bài/tuần khi có đủ report | Thêm vào quy trình nightly khi công ty thứ hai của cặp đã có report |
| Scorecard theo ngành/quý | Cuối mỗi mùa earnings | Sinh từ metrics có cấu trúc (giai đoạn 2), ít cần LLM |
| Glossary + "cách đọc 10-Q/10-K" | 10–15 bài evergreen, viết một lần | Làm theo đợt trong một session |

## Giai đoạn 4 — Phân phối

| Kênh | Tự động hóa | Cần từ bạn |
|---|---|---|
| IndexNow (Bing/Yandex) ping mỗi report mới | Được, gọi từ script publish, không tốn usage | Không |
| X / Bluesky / StockTwits: đăng tự động mỗi report kèm ảnh OG + cashtag | Vercel Cron đọc report mới trong DB, dùng mẫu văn bản, không cần LLM | Tạo tài khoản, cấp API key |
| Newsletter tuần (Beehiiv/Substack) | Bản nháp sinh tự động từ DB, bạn duyệt | Tạo tài khoản |
| Reddit | Không tự động (bị ban nếu spam) | Bạn đăng tay, tôi soạn bài |
| Show HN / Product Hunt | Một lần | Bạn đăng khi có khoảng 200+ report |
| Backlink: pitch scorecard, HARO/Qwoted | Tôi soạn email, bạn gửi | Bạn gửi |
| Video ngắn (Shorts/TikTok) | Làm được nhưng phức tạp, để sau | Tài khoản kênh |

## Giai đoạn 5 — Nhắm quốc gia CPM cao

- Sau khi hot list S&P 500 xong: thêm công ty lớn của FTSE 100, TSX 60, ASX 200 (báo cáo
  tiếng Anh, SEDAR+/ASX/LSE RNS đều tra cứu miễn phí). Cần bổ sung script tạo công ty
  (hiện chỉ có seed cho Mỹ).
- Đọc Search Console theo quốc gia hằng tuần, đẩy nội dung theo thị trường đang có lượt hiển thị.
- Tiếng Đức chỉ xét sau 3–6 tháng nếu có tín hiệu.

## Giai đoạn 6 — Kiếm tiền

| Mốc | Việc |
|---|---|
| Khoảng 150–200 report + đủ trang tin cậy | Nộp AdSense |
| Song song | Affiliate môi giới (Interactive Brokers, Webull, moomoo, tastytrade...), có ghi chú FTC |
| 25k–50k lượt xem/tháng | Nộp Raptive/Mediavine |

## Lịch tự động tổng hợp

| Lịch | Việc | Cơ chế | Tốn usage Claude |
|---|---|---|---|
| Hằng giờ 14–19 UTC (đã có) | Nightly report | Routine hiện tại, thứ tự ưu tiên đổi qua CLAUDE.md | Có, phần chính |
| Mỗi lần publish | IndexNow ping | Script publish | Không |
| Hằng ngày | Đăng social các report mới | Vercel Cron + API key | Không |
| Chủ nhật hằng tuần (từ 2026-10-11) | Earnings preview | Routine mới, chỉ trong mùa earnings | Có, một lượt/tuần |
| Thứ Hai hằng tuần | Nháp newsletter | Vercel Cron sinh từ DB, bạn duyệt | Không |
| Thứ Hai hằng tuần | Xem Search Console: truy vấn, quốc gia, trang bị "crawled not indexed" | Thủ công, 10 phút | Không |
| Cuối mỗi mùa earnings | Scorecard | Chạy tay một lần khi có metrics có cấu trúc | Ít |

## Mốc kiểm tra

- 2026-10-11: giai đoạn 1 xong, Search Console đã nhận sitemap, hot list Q2 xong.
- 2026-10-14: bắt đầu mùa earnings Q3, bật đăng social và preview.
- 2026-11-20: đánh giá lần đầu (lượt hiển thị, số trang được index, quốc gia); quyết định AdSense.

## Trạng thái triển khai (cập nhật 2026-09-20)

Đã làm và đã deploy lên https://financialreportinsights.com (commit 2e03c99 trở đi):

| Mục | Trạng thái |
|---|---|
| 1.2 Sitemap chỉ có trang có report; trang rỗng `noindex` | Xong |
| 1.3 About, Methodology, Corrections, Privacy, Contact + footer | Xong. Contact cần biến `CONTACT_EMAIL` |
| 1.4 Link filing gốc (`sourceUrl`) trên mỗi report | Xong (trường mới, form admin, script publish, CLAUDE.md bắt buộc từ nay) |
| 1.5 Ảnh OG động (`next/og`), bỏ placehold.co | Xong |
| 1.6 JSON-LD (BreadcrumbList, dateModified, publisher, WebSite), RSS `/feed.xml` | Xong |
| 1.7 Internal links (kỳ khác của công ty, cùng ngành), trang chủ có Latest, `/reports` | Xong |
| 1.8 Bỏ `force-dynamic`/cache | Không làm: CSP nonce theo request (proxy.ts) buộc trang phải dynamic; cache sẽ làm hỏng hydration |
| 1.9 Xóa dòng disclaimer footer | Xong |
| 2 Hot list + `npm run next-batch` + CLAUDE.md | Xong; routine đêm nay sẽ đi theo hot list |
| 2 Metrics có cấu trúc (`metrics` JSON) | Xong; các report cũ chưa có, report mới bắt buộc |
| 3 Bảng bài mới: `Article` (GUIDE/PREVIEW/COMPARISON/SCORECARD), `/learn`, `/insights` | Xong |
| 3 9 guide đã viết (content/guides) | Chờ publish: routine đêm chạy `--articles-dir content/guides` ở lần bắn đầu tiên |
| 3 Preview tuần, comparison | Đưa vào chỉ dẫn của routine đêm hiện có (không tạo routine mới) |
| 4 IndexNow | Xong, tự ping khi publish |
| 4 Social tự động (Bluesky, X) | Code xong; cần tạo tài khoản + biến môi trường + `CRON_SECRET` |
| 4 Newsletter | `/admin/newsletter` sinh bản nháp; cần tài khoản Beehiiv/Substack |
| 5 FTSE/TSX/ASX | Chưa làm: pipeline nghiên cứu hiện chỉ đọc EDGAR, cần quyết định nguồn dữ liệu |
| 6 AdSense, affiliate | Chưa: chờ đủ ~150 report và Search Console có dữ liệu |

Việc chỉ bạn làm được: xem phần "Việc cần bạn" ở tin nhắn cuối phiên.
