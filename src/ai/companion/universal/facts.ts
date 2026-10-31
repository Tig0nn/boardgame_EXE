import {stockCatalog} from '../../../data/stock-catalog.ts'
const STOCKS = [...stockCatalog('vn-v1'),...stockCatalog('fictional-v1')]
import {BOND_ISSUERS} from '../../../data/bond-issuers.ts'
import {MULTI_COURSES} from '../../../data/courses.ts'
import type {GameplayFact,GameplayDomain} from './types.ts'
export const FACTS = {
 owned:['Đã sở hữu khóa học','boolean'], creditState:['Trạng thái tín dụng hiện tại','credit'],
 cash:['Tiền mặt hiện có','money'], debt:['Gốc nợ hiện tại','money'], obligations:['Nghĩa vụ đã cam kết','money'],
 worth:['Giá trị ròng theo selector','money'], liquid:['Tiền có thể thanh lý sau nợ/nghĩa vụ','money'], target:['Mục tiêu trong game','money'],
 salary:['Thu nhập định kỳ hiện tại / START','money'], living:['Sinh hoạt định kỳ tại START','money'],
 rate:['Lãi suất tiết kiệm mỗi START','rate'], maturity:['Vòng đáo hạn của khoản đang có','count'], principal:['Gốc khoản tiết kiệm đang hoạt động','money'],
 interest:['Lãi danh nghĩa nếu giữ đủ kỳ hạn','money'], lost:['Lãi danh nghĩa mất nếu rút sớm khoản này','money'],
 change:['Thay đổi giá đã xảy ra trong sự kiện','money'], beforePrice:['Giá trước sự kiện đã ghi nhận','money'], observed:['Có bản ghi tác động đã công bố','count'],
 price:['Giá hiện tại được công bố','money'], holding:['Giá trị tài sản hiện có (trước phí)','money'],
 gross:['Báo giá bán toàn phần khả dụng: giá gộp','money'], fee:['Báo giá: phí giao dịch','money'], spread:['Báo giá: chênh lệch mua bán','money'], net:['Báo giá: tiền nhận sau phí và spread','money'],
 coupon:['Coupon theo hợp đồng, không bảo đảm được trả','rate'], outstanding:['Gốc/coupon còn chậm trả của lô','money'], loss:['Gốc/coupon đã ghi nhận mất của lô','money'],
 businessIncome:['Thu nhập quán theo trạng thái hiện tại / START','money'], capital:['Vốn quán đang khóa','money'], recovery:['Báo giá thu hồi toàn quán','money'],
 upgradeCost:['Chi phí nâng cấp quán','money'], incremental:['Thu nhập tăng thêm theo chuyên môn đang phù hợp','money'],
 purchaseCost:['Giá mua cơ sở kinh doanh','money'], courseCost:['Học phí niêm yết (khóa đã sở hữu không mua lại)','money'], courseBoost:['Tăng lương từ START kế tiếp','money'],
 courseNominal:['Phần tăng lương của khóa nếu đến đủ START còn lại','money'], courseNet:['Phần tăng lương danh nghĩa trừ học phí niêm yết (không bảo đảm)','money'],
 immediate:['Thanh toán ngay theo lựa chọn','money'], future:['Khoản hẹn tại START nếu hoàn tất thanh toán ban đầu','money'], total:['Tổng chi phí lựa chọn, chưa gồm huy động vốn','money'],
 after:['Tiền mặt sau chi phí ngay nếu đủ','money'], shortfall:['Thiếu tiền mặt cho chi phí ngay','money'],
 paymentTotal:['Tổng khoản thanh toán bắt buộc','money'], remaining:['Khoản bắt buộc còn thiếu','money'], headroom:['Hạn mức vay còn lại','money'],
 received:['Thu nhập định kỳ dùng tại START này','money'], debtPaid:['Gốc nợ đã trả tại START này','money'],
} as const
export const SUBJECTS = ['overall','stocks','bonds','gold','business','pay','defer','full','temporary','upgrade','skip','term-1','term-2','term-3',
 ...STOCKS.map(x=>x.id),...BOND_ISSUERS.map(x=>x.id),...MULTI_COURSES.map(x=>x.id)]
export function validSubject(s:string) { return SUBJECTS.includes(s)||/^lot-[1-9][0-9]{0,2}$/.test(s) }
export function subjectLabel(s:string):string {
 const found=STOCKS.find(x=>x.id===s)?.name??BOND_ISSUERS.find(x=>x.id===s)?.name??MULTI_COURSES.find(x=>x.id===s)?.name
 return found??({overall:'Tổng quan',stocks:'Cổ phiếu',bonds:'Trái phiếu',gold:'Vàng',business:'Quán',pay:'Trả ngay',defer:'Trả cuối vòng',full:'Sửa ngay',temporary:'Sửa tạm',upgrade:'Khóa học',skip:'Bỏ qua'} as Record<string,string>)[s]??(s.startsWith('term-')?`Kỳ hạn ${s.slice(5)} START`:`Khoản ${s.slice(4)}`)
}
export function factLabel(f:GameplayFact):string {
 if(f.subject.startsWith('lot-')){
  const kind=['principal','maturity','interest','lost'].includes(f.code)?'Khoản tiết kiệm':'Lô trái phiếu'
  return kind+' '+f.subject.slice(4)+' · '+FACTS[f.code as keyof typeof FACTS][0]
 }
 return `${subjectLabel(f.subject)} · ${FACTS[f.code as keyof typeof FACTS][0]}`}
export function factValue(f:GameplayFact):string {
 const unit=FACTS[f.code as keyof typeof FACTS][1]
 if(unit==='boolean')return f.value===1?'Đã sở hữu':'Chưa sở hữu'
 if(unit==='credit')return ['Đang trả đúng hạn','Chậm trả','Vỡ nợ','Đã xử lý'][f.value]
 return unit==='money'?`${f.value.toLocaleString('vi-VN')} đ`:unit==='rate'?`${(f.value/100).toLocaleString('vi-VN')}%`:String(f.value)
}
export function actionLabel(action:string,domain?:GameplayDomain):string {
 if(action==='upgrade'&&domain==='course')return 'Tham gia khóa học'
 return ({buy:'Mua tại ô hiện tại (cần chọn số tiền/mã hợp lệ)',sell:'Bán theo quyền tại ô hiện tại / START',upgrade:'Nâng cấp quán theo lựa chọn hợp lệ',deposit:'Mở một khoản gửi mới',skip:'Bỏ qua',pay:'Thanh toán ngay',defer:'Thanh toán tại START',full:'Sửa ngay',temporary:'Sửa tạm, còn nghĩa vụ tại START',acknowledge:'Xác nhận đã xem tin',repay:'Trả nợ chủ động tại START',continue:'Tiếp tục', 'course-basic':'Mua khóa cơ bản','course-advanced':'Mua khóa nâng cao'} as Record<string,string>)[action]??(action.startsWith('fund-')?`Huy động từ ${resourceLabel(action.slice(5))}`:action)
}
export function resourceLabel(source:string):string {return ({savings:'tiết kiệm (rút toàn khoản, mất lãi)',stocks:'cổ phiếu (sau phí)',bonds:'trái phiếu có báo giá bán',gold:'vàng (sau spread/phí)',debt:'vay trong hạn mức còn lại'} as Record<string,string>)[source]??source}