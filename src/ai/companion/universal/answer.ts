import {groundedConclusion,groundedCaveat,learningPrompt,missingDataExplanation} from './copy.ts'
import {canonicalJson} from '../serialization.ts'
import {invalid,object,literal,text,integer,enumeration,nullable,plainText,array} from '../schema.ts'
import {parseGameplayFact,parseGameplayRequest} from './contract.ts'
import {classifyGameplay,normalizeQuestion} from './questions.ts'
import {GAMEPLAY_POLICY} from './types.ts'
import type {GameplayDomain,GameplayIntent,GameplayRequest,GameplayResponse} from './types.ts'
const lessons:Record<GameplayDomain,string>={
 bank:'Mỗi khoản gửi có kỳ hạn riêng và không tự tái tục. Lãi chỉ nhận khi đáo hạn; kỳ hạn dài khóa tiền lâu hơn. Rút sớm chỉ được dùng khi thiếu tiền bắt buộc và mất lãi của cả khoản rút. Bản giải thích chưa nhận số tiền/kỳ hạn đang nhập trong form, nên chưa có báo giá lãi cho khoản gửi mới.',
 stocks:'Giá cổ phiếu trong game có thể giảm. Giá trị đang nắm giữ chưa phải tiền mặt; bán mới nhận tiền sau phí. Báo giá dưới đây là bán toàn phần tài sản đang có, không phải một giao dịch đã thực hiện. Mua chuyển tiền mặt thành cổ phiếu theo số tiền hợp lệ. Bản giải thích chưa nhận mã/số tiền đang nhập trong form nên chưa có báo giá mua riêng.',
 bonds:'Coupon là khoản lãi theo hợp đồng trái phiếu, không phải gốc hoặc lợi nhuận được bảo đảm. An Tâm và Bứt Phá có coupon và rủi ro tín dụng khác nhau. Coupon cao không bảo đảm trả đúng hạn. Tại START, game xử lý coupon và khoản gốc đến hạn theo trạng thái tín dụng từng lô. Chậm trả là khoản còn phải thu, không phải tiền mặt đã nhận; mất gốc hoặc coupon được ghi nhận riêng. Báo giá chỉ gồm khoản đang bán được; một số trạng thái không thể bán. Không biết kết quả tín dụng tương lai.',
 gold:'Mua vàng dùng tiền mặt để đổi lấy vàng; không tạo lương hay coupon. Giá có thể thay đổi. Spread trừ trước, rồi tính phí trên phần còn lại; vì thế mua rồi bán ngay có thể mất tiền ngay cả khi giá chưa đổi. Báo giá dưới đây áp dụng toàn bộ vàng đang sở hữu, chưa phải giao dịch.',
 business:'Quán cần vốn mua và trả thu nhập tại START theo luật và chuyên môn hiện tại. Nâng cấp tốn thêm tiền và tăng thu nhập; mức tăng dưới đây chỉ cho chuyên môn đang phù hợp, sở thích vòng sau chưa biết; không bảo đảm hòa vốn trước cuối màn. Giá thu hồi khác vốn đã bỏ ra. Nâng cấp chỉ mở từ lượt sau khi mua, theo quyền giao dịch hiện tại. Không được bán quán làm nguồn huy động bắt buộc.',
 course:'Học phí trả bằng tiền mặt, không hoàn lại; không được tính như tài sản có thể bán. Khóa đã sở hữu không mua lại; mỗi lần ghé mua tối đa một khóa. Tăng lương từ START kế tiếp. Thu nhập danh nghĩa giả định tới đủ START còn lại, không phải tiền đã nhận hoặc lợi nhuận được bảo đảm.',
 personal:'Chi phí ngay và nghĩa vụ tại START là hai khoản khác nhau. Trả sau giữ tiền mặt lúc này nhưng tăng nghĩa vụ. Nếu thiếu tiền cho khoản bắt buộc, game chuyển sang huy động vốn; phí bán, lãi vay hoặc lãi tiết kiệm mất chưa nằm trong tổng chi phí lựa chọn.',
 macro:'Cú sốc đã được áp dụng khi sự kiện xuất hiện, không áp lại khi hỏi AI hay tại START. Mỗi nhóm tài sản phản ứng khác nhau. Thay đổi giá trị tài sản không phải tiền mặt nhận được và không dự báo được giá tương lai.',
 funding:'Đây là khoản thanh toán bắt buộc chưa đủ tiền. Chỉ các nguồn đang hợp lệ mới được liệt kê. Rút tiết kiệm là rút toàn khoản và mất lãi danh nghĩa; bán tài sản chịu phí/spread; vay làm tăng gốc nợ. Quán không phải nguồn huy động bắt buộc. Bản giải thích chưa nhận nguồn và số tiền đang nhập trong form, nên chưa có tổng chi phí huy động cụ thể.',
 summary:'Các dòng dưới là thu/chi/nghĩa vụ đã ghi nhận tại START này, không phải dự báo. Lương, thu nhập quán, đáo hạn/coupon, sinh hoạt, nợ và nghĩa vụ được xử lý theo thứ tự của game. Giá trị tài sản không phải tiền mặt có thể chi ngay.',
 rebalancing:'Tại START có thể bán tài sản tài chính và trả nợ chủ động, không mua mới tài sản tại đây. Báo giá bán là toàn phần khả dụng và chưa thực hiện. Trả nợ có thể giảm tiền mặt và trả thêm lãi theo luật; bản giải thích chưa nhận số tiền đang nhập trong form nên chưa có báo giá trả nợ riêng.',
 forecast:'Bản tin mô tả xu hướng kinh tế đang công bố. Đây là thông tin định hướng quan sát; không đảm bảo giá tiếp theo. So sánh tiền mặt với thu nhập định kỳ, sinh hoạt và nghĩa vụ đã cam kết. AI không biết kết quả gieo xúc xắc hay sự kiện kế tiếp.',
 overview:'Tiền mặt là khoản chi được ngay. Giá trị ròng và tiền thanh lý là các thước đo khác, đã xét nợ/nghĩa vụ theo selector. Chúng không bảo đảm đạt mục tiêu. Hãy kiểm tra nguồn tiền cho chi phí bắt buộc trước quyết định đầu tư.',
}
const limitations=['Chỉ giải thích trò chơi B18; không khuyến nghị đầu tư ngoài đời.','Không dự báo giá, RNG hay sự kiện tương lai.','Báo giá và thu nhập danh nghĩa có điều kiện; không đọc các giá trị đang nhập trong form, không tự thực hiện giao dịch.','Dữ liệu từ phiên chơi cục bộ, chưa được máy chủ xác thực.']
function canonical(r:GameplayRequest):GameplayResponse {
 const c=r.context,n=normalizeQuestion(r.question),intent=classifyGameplay(r.question,c.domain,c.eventId)
 let reason:GameplayResponse['reason']=intent?'supported':'unsupported'
 if(/ngoai doi|tien that|dau tu that|api key|system prompt/.test(n))reason='outside-game'
 else if(/ngay mai|tuong lai|rng|seed|su kien (ke|tiep)|xuc xac (ra|bao)|gia.*(se|sap) (tang|giam)/.test(n))reason='future'
 else if(!intent&&/ va |;|dong thoi/.test(n))reason='multi-intent'
 if(reason==='supported'){
 if(intent==='compare'&&(['stocks','gold'].includes(c.domain)&&/bao gia/.test(n)||c.domain==='rebalancing')&&!c.facts.some(f=>f.code==='net'))reason='missing-data'
 if(c.domain==='bonds'&&/ban trai phieu/.test(n)&&!c.facts.some(f=>f.code==='net'))reason='missing-data'
 if(c.domain==='bank'&&/khi nao/.test(n)&&!c.facts.some(f=>f.code==='maturity'))reason='missing-data'
 if(c.domain==='business'&&/ban quan/.test(n)&&!c.facts.some(f=>f.code==='capital'&&f.value>0))reason='missing-data'
 if(c.domain==='course'&&c.profile==='core-mvp-b18-v1'&&/hai khoa/.test(n))reason='unsupported'
 if(c.domain==='personal'&&/sua/.test(n)&&c.eventId!=='repair')reason='unsupported'
 if(['personal','funding','summary','macro'].includes(c.domain)&&!c.facts.some(f=>['immediate','future','remaining','received','price'].includes(f.code)))reason='missing-data'
 }
 const answered=reason==='supported'
 const fallback={unsupported:'Chưa hỗ trợ cách hỏi này trong tình huống hiện tại. Bạn có thể chọn câu hỏi gợi ý.',future:'Không thể biết hoặc tiết lộ kết quả tương lai. Hãy hỏi về dữ kiện đã công bố.', 'outside-game':'Chỉ hỗ trợ giải thích trong trò chơi, không tư vấn đầu tư thật hoặc truy cập dữ liệu bí mật.', 'multi-intent':'Câu hỏi có nhiều ý hoặc chưa rõ. Hãy hỏi từng ý trong tình huống này.', 'missing-data':'Chưa có đủ dữ kiện cho câu hỏi này. Báo giá bán cần tài sản đang sở hữu; tác động đã xảy ra cần bản ghi công khai tương ứng.',supported:''}
 const conclusions:Record<GameplayIntent,string>={explain:'Xem cơ chế cùng dữ kiện hiện tại trước khi quyết định.',compare:'Phân biệt tiền chi ngay, tiền nhận và điều kiện của từng lựa chọn.',risk:'Kết quả có điều kiện; hãy giữ khả năng thanh toán khoản bắt buộc.',cashflow:'Dòng tiền chi được khác giá trị tài sản và khoản sẽ nhận.',learn:'Quan sát chi phí cơ hội và thanh khoản trong quyết định này.'}
 // Select exact fact records; no amount extraction, arithmetic, generated claims or model call.
 const common=new Set(['cash','debt','obligations','salary','living','liquid','target'])
 const facts=answered?c.facts.filter(f=>!common.has(f.code)||['cash','obligations'].includes(f.code)||intent==='cashflow'||intent==='learn'):[]
 return {version:1,policy:GAMEPLAY_POLICY,requestId:r.requestId,sessionEpoch:r.sessionEpoch,revision:r.revision,contextDigest:r.contextDigest,questionDigest:r.questionDigest,
 source:'deterministic',integrity:'client-state-unverified',status:answered?'answered':'fallback',reason,intent:answered?intent:null,
 conclusion:answered?groundedConclusion(c,intent!,conclusions[intent!]): 'Chưa thể trả lời câu hỏi này',explanation:answered?lessons[c.domain]+groundedCaveat(c):reason==='missing-data'?missingDataExplanation(c):fallback[reason],
 facts,entries:answered?c.entries:[],actions:answered?[...c.actions]:[],resources:answered?[...c.resources]:[],reflection:answered?learningPrompt(c.domain):null,limitations:[...limitations]}
}
export async function answerGameplay(raw:unknown):Promise<GameplayResponse>{return canonical(await parseGameplayRequest(raw))}
const responseSchema=object({version:literal(1),policy:literal(GAMEPLAY_POLICY),requestId:text(),sessionEpoch:text(48,/^[A-Za-z0-9_-]+$/),revision:integer(),
 contextDigest:text(71,/^sha256:[0-9a-f]{64}$/),questionDigest:text(71,/^sha256:[0-9a-f]{64}$/),source:literal('deterministic'),integrity:literal('client-state-unverified'),
 status:enumeration(['answered','fallback']),reason:enumeration(['supported','unsupported','future','outside-game','multi-intent','missing-data']),intent:nullable(enumeration(['explain','compare','risk','cashflow','learn'])),
 conclusion:plainText(240),explanation:plainText(2400),facts:array(parseGameplayFact,0,256),entries:array(object({label:plainText(160),amount:integer(-Number.MAX_SAFE_INTEGER)}),0,64),
 actions:array(text(),0,24),resources:array(text(),0,5),reflection:nullable(plainText(240)),limitations:array(plainText(240),4,4)})
export async function validateGameplayResponse(raw:unknown,request:unknown):Promise<GameplayResponse>{
 const expected=await answerGameplay(request)
 const parsed=responseSchema(raw)
 if(canonicalJson(parsed)!==canonicalJson(expected))invalid()
 return expected
}