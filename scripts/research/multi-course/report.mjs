import {readFileSync,writeFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {systems,layouts} from './spec.mjs'
import {paired,wilson} from './stats.mjs'
const root='docs/research/multi-course',load=p=>JSON.parse(readFileSync(`${root}/${p}`)),hold=load('holdout-analysis.json'),comparisons=load('holdout-comparisons.json'),tails=load('holdout-tail-intervals.json')
const main='I2-choice__L3-bonds',backup='S3-flat__L4-original',rich='S2-rich__L2-spaced',original='A-baseline__L4-original'
const ids=[main,backup,rich],labels={[main]:'Chính: I2/3 ô',[backup]:'Dự phòng: S3/4 ô',[rich]:'Loại: S2/2 ô',[original]:'Baseline1/4 ô'}
const M=x=>x===null?'—':(x/1e6).toFixed(2),P=x=>(x*100).toFixed(1)+'%',F=x=>Number(x).toFixed(2),interval=(ci,scale=1)=>ci.map(x=>(x/scale).toFixed(scale===1?1:2)).join('…')
const cell=(id,p)=>hold.cells.find(c=>c.config===id&&c.policy===p),summary=id=>load(`holdout/${id}.summary.json`),rows=id=>JSON.parse(gunzipSync(readFileSync(`${root}/holdout/${id}.rows.json.gz`)))
const summaries=Object.fromEntries([main,backup,rich,original].map(id=>[id,summary(id)])),raw=Object.fromEntries(ids.map(id=>[id,rows(id)]))
const overview=id=>hold.arms.find(a=>a.config===id)
const allArms=[...load('screen-analysis.json').arms,...load('screen-control-analysis.json').arms].sort((a,b)=>a.config.localeCompare(b.config))
const controlConfigs=load('screen-control-lock.json').configs,allSystems=[...systems,...[...new Map(controlConfigs.map(c=>[c.course.id,c.course])).values()]]
const curriculumTable=allSystems.map(s=>`| ${s.id} | ${s.unlock==='sequential'?'Tuần tự':'Độc lập'} | ${s.courses.map(c=>`${M(c.cost)}/${M(c.boost)}`).join('; ')} | ${s.courses.map(c=>Math.ceil(c.cost/c.boost)).join('/')} |`).join('\n')
const layoutTable=layouts.map(l=>`| ${l.id} | ${l.tiles.map((t,i)=>t==='course'?i+1:null).filter(Boolean).join('/')} | ${Object.entries(l.changes).map(([i,t])=>`${Number(i)+1}→${t}`).join('; ')||'Giữ nguyên'} |`).join('\n')
const exposureTable=[original,main,backup,rich].map(id=>{const a=overview(id),s=summaries[id].policies['cash-roi'];return `| ${labels[id]} | ${F(s.courseVisits.mean)} | ${P(a.available)} | ${P(a.affordable)} | ${P(a.exhausted)} | ${P(a.profitable)} | ${F(a.bought)} |`}).join('\n')
const selectedPolicies=['cash-roi','cash-all','savings-roi','savings-all','diversified-roi','business-roi','novice']
const strategyTable=ids.flatMap(id=>selectedPolicies.map(p=>{const c=cell(id,p);return `| ${labels[id]} | ${p} | ${P(c.win)} [${interval([c.winLow*100,c.winHigh*100])}] | ${M(c.mean)} | ${M(c.median)} | ${M(c.p10)} | ${M(c.worstDecile)} |`})).join('\n')
const noCourseTable=['cash-none','savings-none','stocks-none','business-none','diversified-none'].map(p=>{const c=cell(main,p);return `| ${p} | ${P(c.win)} | ${M(c.mean)} | ${M(c.p10)} | ${M(c.worstDecile)} |`}).join('\n')
const distributionTable=ids.flatMap(id=>['cash-roi','savings-roi','novice'].map(p=>{const s=summaries[id].policies[p];return `| ${labels[id]} | ${p} | ${[0,1,2,3,4].map(n=>P(s.coursesDistribution[n])).join(' | ')} | ${M(s.courseSpend.mean)} | ${M(s.courseSalaryReceived.mean)} | ${M(s.courseNet.mean)} |`})).join('\n')
const roiTable=[...systems.find(s=>s.id==='I2-choice').courses.map(c=>({name:`Chính/${c.id}`,...c})),{name:'Dự phòng/mỗi cấp',cost:8e6,boost:3e6}].map(c=>`| ${c.name} | ${M(c.cost)} | ${M(c.boost)} | ${[4,3,2,1].map(n=>M(c.boost*n-c.cost)).join(' | ')} |`).join('\n')
const learningContrasts=ids.map(id=>{const a=raw[id].filter(r=>r.policy==='savings-roi'),b=raw[id].filter(r=>r.policy==='savings-all'),d=paired(a,b,'proceeds');return `| ${labels[id]} | ${M(d.mean)} [${interval(d.ci95,1e6)}] | ${P(cell(id,'savings-roi').win)} / ${P(cell(id,'savings-all').win)} |`}).join('\n')
const reserveTable=['savings-course-reserve0','savings-course-reserve5','savings-roi','savings-course-reserve15'].map(p=>{const c=cell(main,p);return `| ${p==='savings-roi'?'10':p.replace('savings-course-reserve','')}M | ${M(c.mean)} | ${P(c.win)} | ${M(c.cashAfterCourse)} | ${M(c.courseNet)} | ${P(c.funding)} | ${P(c.borrow)} |`}).join('\n')
const mc=cell(main,'savings-roi'),bc=cell(backup,'savings-roi'),rc=cell(rich,'savings-all'),rt=tails.find(t=>t.config===main&&t.policy==='savings-roi')
const direct=raw[main].filter(r=>r.policy==='savings-roi'),none=raw[main].filter(r=>r.policy==='savings-none'),gain=paired(direct,none,'proceeds')
const reserve0=comparisons.find(c=>c.config===main&&c.policy==='savings-course-reserve0'&&c.control.includes('reserve10')&&c.metric==='proceeds')
const adverse=summaries[main].policies['savings-roi'].personalAdverse,zeroUpper=wilson(0,448)[1]
const assetTable=['stocks-roi','gold-roi','bond-a-roi','bond-b-roi','business-roi','diversified-roi','risk-aware-roi','savings-roi'].map(p=>{const c=cell(main,p);return `| ${p} | ${P(c.win)} | ${M(c.mean)} | ${M(c.worstDecile)} | ${M(c.investmentSpend)} | ${M(c.fees+c.spread)} |`}).join('\n')
const allTable=allArms.map(a=>`| ${a.system} | ${a.layout} | ${a.courses}/${a.courseTiles} | ${M(a.mean)} | ${P(a.win)} | ${P(a.exhausted)} | ${P(a.profitable)} |`).join('\n')
writeFileSync(`${root}/ALL_ARMS.md`,`# Toàn bộ119 tổ hợp screening\n\nMỗi tổ hợp:32 seed ×14 policy. Chỉ bảng này dùng trung bình đều của cash-roi/savings-roi/diversified-roi/risk-aware-roi/novice; không phải tỷ lệ người chơi thật. Mean/win không dùng một mình để chọn. Dữ liệu từng policy và CI nằm trong CSV/JSON phase tương ứng.\n\n| Curriculum | Layout | Khóa/ô học | Mean(M) | Win suite | Hết khóa | Có khóa ROI dương đủ cash |\n|---|---|---:|---:|---:|---:|---:|\n${allTable}\n`)
const text=`# Core MVP B18 — nghiên cứu nhiều khóa học

**Đề xuất chính:** 2 khóa **độc lập**: **6M/+2M** và **10M/+4M**, giữ **3 ô học tại5/8/13**, đổi ô16 thành **Trái phiếu** (I2-choice/L3-bonds). **Dự phòng:** 3 cấp tuần tự, mỗi cấp **8M/+3M**, giữ4 ô học gốc (S3-flat/L4-original). Đây là đề xuất để Owner review, chưa triển khai.

**Giới hạn quan trọng:** cả hai cải thiện cơ hội cân nhắc học, nhưng Savings + Course vẫn mạnh nhất trong tập heuristic và thiếu tiền quá hiếm để chứng minh bài học dự phòng. Chưa có phương án được chứng minh thỏa trọn vẹn mọi mục tiêu giáo dục. Không gọi đây là tối ưu toàn cục hoặc bằng chứng người chơi đã học.

## Nguồn và thiết kế thực nghiệm

Base **00e77a19691c109e8cb7079b83591463c3eb6136**, nhánh B18 đã push trước nghiên cứu. Nhánh nghiên cứu **codex/mvp-b18-course-balance-lab**; policy/kế toán tài sản tái dùng từ **d04b8ad** trong bản sao tạm. Production engine/UI và replay lịch sử không sửa. 18 ô/4 START,50M vốn,14M lương,5M sinh hoạt,90M mục tiêu, tài sản/phí/credit/market/Business/personal/funding giữ nguyên.

**167.972 ván:** screening53.312 (14 hệ ×7 bàn +3 hệ đối chứng cùng tổng economics); shortlist50.148 (6 thiết kế triển vọng +baseline theo layout và đối chứng2/3/4 khóa); holdout64.512 (3 ứng viên +3 baseline ×448 seed ×24 policy). Holdout lock commit **ce24f64**, trước mọi lần chạy holdout; không tinh chỉnh sau kết quả. Seed các phase rời nhau; paired cùng seed/policy khi so curriculum, đồng thời kiểm tra RNG/path khi đổi bàn. Không full-grid khổng lồ, không chạy lại nghiên cứu400.800 ván.

Tất cả setup thí nghiệm0M savings/term3; không phải luật ép người chơi.14/21/24 heuristic theo phase gồm không học, học sớm, học tất cả, ROI theo START còn lại, reserve0/5/10/15, savings, Stocks, Gold, Bonds AA/B, Business, diversified, risk-aware và novice synthetic. Điều kiện ngoài khóa học giữ cùng nhau trong từng cặp. [Phương pháp/định nghĩa/tái lập](research/multi-course/README.md), [kiểm chứng](research/multi-course/verification.json).

## Tất cả phương án

Mỗi cặp dưới là **học phí/tăng lương mỗi START**, đơn vịM. Phạm vi6–12M/1–4M là screening, không phải thông số Owner đã chốt. Rationale từng hệ lưu trong config; các hệ rich/costly/never-payback là đối chứng để nhận diện cực đoan, không mặc định là thiết kế tốt.

| Hệ | Mở khóa | Các khóa: cost/boost(M) | START để hoàn vốn từng khóa |
|---|---|---|---|
${curriculumTable}

M2/M3/M4 cùng **24M tổng phí, +8M tổng lương**, mọi khóa hoàn vốn sau3 START; so độ chia nhỏ và số encounter cần thiết, thay vì lẫn tổng độ hào phóng với số khóa. Các khóa độc lập giống economics trong M4 không tạo4 lựa chọn tài chính khác nhau, chỉ thêm các lần mua.

| Layout | Ô học (1-based) | Thay thế so B18 |
|---|---|---|
${layoutTable}

Mọi layout có18 ô/4 START và đúng9 loại. Ô16 là repeat kém hữu ích đã thử trong nghiên cứu trước. Không mặc định thay bằng Personal: screening so Bank/Bonds/Personal ở cùng vị trí; hai layout L2-bond-bank/L2-spaced giữ cùng số lượng tile để tách một phần spacing. [Bảng đủ119 tổ hợp](research/multi-course/ALL_ARMS.md), [toàn bộ policy screening](research/multi-course/screen-policy-results.csv), [đối chứng cùng economics](research/multi-course/screen-control-policy-results.csv).

## Dữ liệu thực nghiệm: chất lượng ô học

Bảng sau dùng trung bình đều5 heuristic đã nêu trong phương pháp; gặp ô dựa trên path thực, các tỷ lệ khả dụng phụ thuộc policy. “Hết khóa” khác “còn khóa nhưng không đủ cash/không kịp hoàn vốn”. ROI dương chỉ xét course đang đủ cash và lương thực hiện trong START còn lại; không phải chứng minh quyết định tối ưu cho người thật.

| Arm | Lần ghé/ván | Còn khóa | Đủ cash mua | Hết khóa | Có ROI dương đủ cash | Khóa mua/ván |
|---|---:|---:|---:|---:|---:|---:|
${exposureTable}

Baseline còn nhiều popup sau khi mua duy nhất một khóa. S3/4 ô ít hết khóa nhất trong holdout, nhưng không thắng mặc định vì cần nhiều vốn và dễ học quá muộn. I2/3 ô tạo lựa chọn chi6M hoặc10M và được chọn thứ tự; vẫn còn khoảng29% encounter hết khóa trong suite. S2/2 ô cho nhiều cơ hội lợi nhuận dễ đạt hơn, nhưng rủi ro “cứ học rồi gửi Bank” cao hơn, nên không chọn chính.

| Arm | Policy | 0 khóa | 1 | 2 | 3 | 4 | Học phí/ván(M) | Tăng lương thực nhận(M) | Net trực tiếp(M) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${distributionTable}

## Win, proceeds và rủi ro — holdout

448 seed/policy. Win kèm Wilson95%; mean/median/P10/worst10 đơn vịM. Worst10 là mean nhóm10% proceeds thấp nhất. Các dòng là heuristic tổng hợp, không phải nhóm người chơi. Mean CI và tail CI đầy đủ trong [CSV](research/multi-course/holdout-policy-results.csv), [tail bootstrap400 lần](research/multi-course/holdout-tail-intervals.json).

| Arm | Policy | Win% [CI95%] | Mean | Median | P10 | Worst10 |
|---|---|---:|---:|---:|---:|---:|
${strategyTable}

Ví dụ chính Savings+ROI: mean **${M(mc.mean)}M** (CI95 ${interval([mc.meanLow,mc.meanHigh],1e6)}M), P10 **${M(mc.p10)}M** (bootstrap95 ${interval(rt.p10CI95,1e6)}M), worst10 **${M(mc.worstDecile)}M** (bootstrap95 ${interval(rt.worstDecileCI95,1e6)}M). Dự phòng Savings+ROI mean **${M(bc.mean)}M**. Các khác biệt nhỏ cần đọc CI, không chỉ thứ hạng point estimate.

Đối chứng không học tại layout chính:

| Policy không học | Win | Mean(M) | P10(M) | Worst10(M) |
|---|---:|---:|---:|---:|
${noCourseTable}

Học tăng proceeds so no-course trong các cặp, nhưng net salary không bằng hiệu quả tổng. Chính Savings+ROI có course net trực tiếp **${M(mc.courseNet)}M**, paired proceeds so Savings không học **+${M(gain.mean)}M** (CI95 ${interval(gain.ci95,1e6)}M), do chi phí cơ hội và lựa chọn sau học. [Paired contrasts](research/multi-course/holdout-paired.csv).

## ROI học sớm/học muộn và chiến lược học tất cả

Bảng lý thuyết dùng số START còn lại, giả định sống tới cuối ván; không dự báo giá/RNG. Lương bắt đầu ở START tiếp theo và học phí không hoàn trả. Kết quả thực nhận từng khóa/thời điểm mua có trong [course ROI CSV](research/multi-course/holdout-course-roi.csv) và raw rows.

| Khóa | Phí(M) | Boost(M) | Còn4 START: net | Còn3 | Còn2 | Còn1 |
|---|---:|---:|---:|---:|---:|---:|
${roiTable}

Ở thiết kế chính, cả hai khóa cần tối thiểu3 START để hoàn vốn; với2 START còn lại, việc học đã lỗ trực tiếp trước cả chi phí cơ hội. Policy ROI vì thế không mua sau vòng2. Khóa6M/+2M hoàn vốn đúng3 START nhưng có thể kém gửi tiết kiệm nếu chỉ hòa vốn; policy ROI không chiết khấu yield thay thế, nên kết quả chưa phải optimum.

| Arm | Savings+ROI trừ Savings+học tất cả, mean paired(M) [CI95] | Win ROI / học tất cả |
|---|---:|---:|
${learningContrasts}

Đây là lý do không chọn S2-rich dù dễ thắng hơn: Savings+học tất cả đạt **${P(rc.win)}**, mean **${M(rc.mean)}M**, gần Savings+ROI; paired delta chỉ0,10M và CI chứa0. Việc học theo thời gian gần như không cần thiết với heuristic này. Chính I2 tạo chi phí đáng kể khi học thiếu cân nhắc; S3 cũng có chi phí cơ hội và tail xấu hơn khi học tất cả.

## Dự phòng, thanh khoản và seed nhiều Personal

Holdout thay riêng learning reserve0/5/10/15M tại thiết kế chính, giữ financial reserve/Bank behavior10M:

| Learning reserve | Mean proceeds(M) | Win | Cash tối thiểu sau học, mean có điều kiện(M) | Course net(M) | Funding | Vay |
|---|---:|---:|---:|---:|---:|---:|
${reserveTable}

Reserve0 so10 tăng mean **${M(reserve0.mean)}M** (paired95 ${interval(reserve0.ci95,1e6)}M) nhưng không phát sinh funding trong mẫu. Cash-only reserve0/5/10/15 không ràng buộc việc học ở các seed này. Ở cả ba ứng viên, policy có chủ đích không funding/rút sớm/vay/phá sản; novice S2 có1/448 funding, chính và dự phòng0/448. Với0/448, Wilson upper95 vẫn **${P(zeroUpper)}**, không phải rủi ro bằng0.

Có **${adverse.n}/448 seed gặp ít nhất3 Personal** (cùng nhóm seed ở ba layout holdout). Chính Savings+ROI trong nhóm này mean **${M(adverse.proceeds.mean)}M**, win **${P(adverse.won.rate)}**, so mean **${M(mc.mean)}M** toàn mẫu; bị hao tiền rõ nhưng vẫn không funding. Nhóm34 seed có CI rộng và được chọn theo exposure, không phải biến cố thực nghiệm ngẫu nhiên riêng. Giữ nguyên ba sự kiện/lựa chọn, kể cả quyền hoãn trả.

**Vấn đề thiết kế chưa giải quyết:** thu nhập14M nhận trước sinh hoạt5M, vốn50M, quyền hoãn Personal và guard của heuristic làm thiếu thanh khoản rất hiếm. Nghiên cứu này không chứng minh giữ reserve là bắt buộc hoặc người chơi đã hiểu reserve. Không sửa lương/sinh hoạt/event/market để ép ra kết quả.

## Vai trò tài sản và nguy cơ áp đảo

Tại thiết kế chính, cùng ROI course guard10M và policy tài sản hiện có:

| Policy | Win | Mean(M) | Worst10(M) | Vốn đầu tư giao dịch cộng dồn(M) | Phí+spread(M) |
|---|---:|---:|---:|---:|---:|
${assetTable}

**Có dấu hiệu Savings+Course áp đảo trong tập heuristic**: dẫn đầu win, mean và tail ở các ứng viên. Không đạt ngưỡng “gần chắc chắn” đã đăng ký (win≥95%, Wilson lower≥90%); nhưng không nên vì thế bỏ qua sự mất cân đối tương đối. Baseline B18 cũng có Savings+học tất cả thắng83,7%, nên không quy toàn bộ ưu thế này cho multi-course. S2 còn thêm Bank ở layout, càng phải tách hiệu ứng course và layout.

Stocks/AA/Business/diversified vẫn cải thiện mean so Cash+Course, nhưng tails và vốn khóa khác nhau. Bond B coupon cao có tail kém hơn AA; Gold phí/spread làm lợi ích mean nhỏ. Không suy ra đây là xếp hạng đầu tư ngoài đời hoặc asset vô dụng: đây là những policy/ticket/exit cụ thể, không phải người chơi tối ưu. Cần giữ cảnh báo thiết kế về sức hấp dẫn tương đối của Bank, không giả vờ diversified thắng nhiều nhất hay mọi chiến lược ngang nhau.

## So2/3/4 khóa và2/3/4 ô

Đối chứng cùng tổng24M/+8M,128 seed/policy ở shortlist: trên4 ô, suite mean2/3/4 khóa =85,73/85,59/84,80M; hết khóa30,0/13,1/4,8%, nhưng cơ hội ROI dương chỉ20,9/22,0/22,0%. 4 khóa không tạo thêm nhiều cơ hội lợi nhuận; cần nhiều encounter sớm để nhận đủ hiệu ứng. Cash+ROI4 so2 giảm **1,86M** (paired95 -2,09…-1,62M); Savings+ROI giảm0,59M (-0,89…-0,30M). Không kết luận mọi hệ4 khóa đều kém; đây là các package được thử, gồm đối chứng economics bằng nhau.

Đổi4→3→2 ô giảm số popup học nhưng thay bằng cơ hội Bank/Bond/Stocks/Personal, không rút số roll/vòng. Spacing được tách bằng cặp cùng counts L2-bond-bank/L2-spaced. Trong holdout, toàn bộ cặp kiểm tra giữ dice/main RNG đồng bộ100%; riêng đối chứng layout của baseline chỉ4,5–23,4% cặp giữ nguyên encounter hash. Cùng seed không đồng nghĩa cùng trải nghiệm. Không gọi chênh layout là tác động nhân quả thuần của số ô, vì loại/vị trí ô thay thế cũng khác.

Giữ3 ô với2 khóa độc lập là thỏa hiệp cơ hội/độ lặp. Giữ4 ô với3 cấp là dự phòng nếu Owner ưu tiên board gốc và ít encounter hết khóa hơn. Phút chơi/cognitive load chưa đo; cùng sample mean khoảng21,07 roll/ván không chứng minh thời lượng UI/người thật bằng nhau.

## Khuyến nghị và lý do loại

- **Chính: I2-choice/L3-bonds.** Hai khóa độc lập6M/+2M và10M/+4M, mỗi khóa một lần, tối đa một khóa/encounter. Giữ ô5/8/13; ô16→Trái phiếu, không thêm Bank hoặc Personal. Ít khóa và không cần prerequisite; có lựa chọn giữa chi phí nhỏ/giữ cash và boost lớn/chi nhiều hơn. Hết khóa suite29,2% so baseline gốc71,7%; ROI/đủ cash34,1% so24,2%. Học tất cả kém hơn ROI rõ về proceeds, nên lựa chọn thời điểm vẫn có hậu quả. Nhược điểm: vẫn lặp lại, lợi nhuận mean/novice thấp hơn baseline, Bank còn mạnh, chưa tạo áp lực reserve.
- **Dự phòng: S3-flat/L4-original.** Ba cấp8M/+3M, cần cấp trước, giữ4 ô. Economics đồng nhất dễ giải thích, hết khóa14,0%, ROI dương46,7%; mua quá muộn lỗ rõ. Nhược điểm: thêm một cấp/prerequisite, cần vốn lớn hơn, novice mất nhiều tuition, chưa cải thiện tail hoặc reserve; không chọn chỉ vì ít popup vô nghĩa.
- **Không chọn S2-rich/L2-spaced** dù win/mean cao: học tất cả+Bank gần ROI, điều kiện học quá dễ, layout thêm Bank, chưa bảo vệ vai trò tài sản/risk management. Có thể xem như comparator dễ, không làm khuyến nghị MVP chính.
- **I3-moderate**: ba lựa chọn/ba economics nhưng nhiều course hòa vốn hoặc không kịp trả phí; menu phức tạp hơn2 khóa, novice tuition/tail kém. **S3-flat/3 ô** thiếu cơ hội dùng cấp3 so4 ô. **I2/2 ô** giảm lặp nhưng bỏ lỡ khả năng tiếp cận khóa và learning interaction; không tốt hơn3 ô đủ rõ để ưu tiên.
- **S2-extension/S2-costly, S3-rich/S3-decay/S4-decay**: một số khóa cuối không thể hoàn vốn ngay cả mua sớm trong4 START (ví dụ10M/+2M cần5 START,10–12M/+1M cần10–12); “còn khóa” không thành quyết định có ích. S2-even vẫn thử nhưng không tạo ưu thế giáo dục rõ so hai lựa chọn độc lập.
- **I3-choice/I4-even và matched4**: nhiều cấp hoặc phí cho boost quá nhỏ tạo vốn sunk/ordering/menu burden;4 khóa không được mặc định tốt hơn. Các đối chứng matched2/3/4 giúp thấy giảm hết khóa không tự cải thiện economics hay chất lượng quyết định. **L3-personal** tăng hao tiền nhưng không cho thêm khóa/cơ hội tài sản; không chọn chỉ để tăng độ khó. Các layout thêm Bank/Stocks/Bonds vẫn có bảng đủ, không suy ra một replacement tối ưu toàn cục.

## Giả thuyết, bất định và bàn giao

**Giả thuyết chưa kiểm chứng:** hai lựa chọn độc lập có thể giúp người mới giải thích cash/tuition/future income; ba cấp giống nhau có thể dễ nhớ nhưng dễ mua máy móc. Simulation chỉ đo exposure, hành vi heuristic và hậu quả tài chính; không đo kiến thức, chất lượng giải thích hay phút chơi. Không thực hiện Human Playtest trong task này.

Nominal CI chưa hiệu chỉnh hàng nghìn so sánh; shortlist là exploratory và chỉ448 holdout seed. Novice uniform-menu bị ảnh hưởng bởi số option, không đại diện người mới thật. ROI policy không định giá đầy đủ chi phí cơ hội/sự sống sót; policy assets/ticket/exit chưa tối ưu.17 curricula/7 layout là vùng khảo sát hữu hạn, không bằng chứng tối ưu toàn cục. Main/backup là ưu tiên thiết kế có điều kiện, không chứng nhận đáp ứng toàn bộ mục tiêu giáo dục.

**Kiểm chứng nghiên cứu:**6 unit tests đạt,48 foundation replay (12 baseline production),245 replay đã lưu khớp full state và metrics; mọi167.972 ván có audit cash/course salary/Bond/trading. Một arm448 ván được tái lập từ source frozen, khớp byte/hash của cả raw gzip và replay. Các phase seed rời nhau, holdout lock còn nguyên; production/source lịch sử không đổi. [Verification](research/multi-course/verification.json), [tái lập frozen](research/multi-course/frozen-reproduction.json), [manifest artifact/source](research/multi-course/artifact-manifest.json), [raw/config/replay/source bundles](research/multi-course/README.md), [bảng119 arms](research/multi-course/ALL_ARMS.md).

Không triển khai multi-course vào production, không merge/deploy/Final QA. Owner review hai đề xuất và hai vấn đề còn mở: Bank tương đối mạnh và pressure dự phòng quá yếu.
`
const readable=text.replace(/(giữ|tại|sau|trước|chỉ|có|với|thêm|cần|gồm|mỗi|đủ|dùng|gặp|đạt|thắng|khoảng|screening|shortlist|holdout|reserve|vòng|ô|cấp|khóa|seed|policy|heuristic|bảng|mọi|mua|thí nghiệm|đối chứng|phương án|kiểm chứng nghiên cứu:)(?=\d)/gu,'$1 ')
  .replaceAll('chơi.14/21/24','chơi. 14/21/24').replaceAll('START,50M','START, 50M').replaceAll('vốn,14M','vốn, 14M').replaceAll('lương,5M','lương, 5M').replaceAll('hoạt,90M','hoạt, 90M')
writeFileSync('docs/CORE_MVP_MULTI_COURSE_RESEARCH.md',readable)
writeFileSync(`${root}/recommendations.json`,JSON.stringify({main:{id:main,costs:[6e6,10e6],boosts:[2e6,4e6],unlock:'independent',courseTiles1Based:[5,8,13],replace:{tile16:'bonds'}},backup:{id:backup,costs:[8e6,8e6,8e6],boosts:[3e6,3e6,3e6],unlock:'sequential',courseTiles1Based:[5,8,13,16]},rejectedHoldout:rich,conditional:true,unresolved:['Savings+Course dominance within tested heuristics','Insufficient observed liquidity pressure to validate reserve education'],implemented:false,productionChanges:false},null,2)+'\n')
console.log(JSON.stringify({report:'docs/CORE_MVP_MULTI_COURSE_RESEARCH.md',systems:allSystems.length,layouts:layouts.length,screenArms:allArms.length,main,backup}))
