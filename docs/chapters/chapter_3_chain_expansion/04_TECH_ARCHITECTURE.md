# CHƯƠNG 3: MỞ RỘNG CHUỖI & NHƯỢNG QUYỀN (COFFEE CHAIN & FRANCHISE)
## TÀI LIỆU KIẾN TRÚC KỸ THUẬT & MÔ HÌNH DỮ LIỆU (TECH ARCHITECTURE)
**Môi trường:** TypeScript 5.6+, React 19, Multi-Store Engine  
**Tác giả:** Senior Game Manager Creator 2026  

---

## 1. MÔ HÌNH DỮ LIỆU (DATA MODELS)

```typescript
// Trạng Thái Chuỗi Doanh Nghiệp (ChainState)
export interface ChainState {
  quarter: number;               // 1..4 (Tương ứng 4 Quý mở rộng)
  cash: number;                  // Tiền mặt tại tài khoản công ty mẹ
  brandReputation: number;       // Điểm uy tín thương hiệu (0..100)
  hasCentralKitchen: boolean;    // Đã đầu tư Bếp trung tâm hay chưa
  stores: BranchStore[];         // Danh sách các chi nhánh
  capTable: CapTableEntry[];     // Cơ cấu bảng sở hữu cổ phần
  investorOffers: InvestorOffer[];
  monthlyChainRevenue: number;   // Tổng doanh thu toàn chuỗi/tháng
  monthlyChainProfit: number;    // Tổng lợi nhuận ròng toàn chuỗi/tháng
}

export type StoreType = 'company_owned' | 'franchise';

export interface BranchStore {
  id: string;
  name: string;
  type: StoreType;
  openedQuarter: number;
  monthlyRevenue: number;        // Doanh thu chi nhánh
  monthlyFixedCost: number;      // Định phí (Mặt bằng + Lương)
  monthlyVariableRatio: number;  // Tỷ lệ biến phí (0.30 gốc; 0.20 nếu có Central Kitchen)
  
  // Dành riêng cho chi nhánh nhượng quyền
  franchiseContract?: {
    partnerName: string;
    franchiseFeePaid: number;    // Phí nhượng quyền thu ban đầu (100M - 150M)
    royaltyPercent: number;      // 0.03..0.05 (3% - 5%)
    supplyMarkupPercent: number; // 0.15 (15% biên lãi cung ứng)
  };
}

export interface CapTableEntry {
  holder: 'Founder' | 'Angel_Investor' | 'ESOP_Pool';
  sharesCount: number;
  ownershipPercent: number;      // Tỷ lệ sở hữu (ví dụ: 80% = 0.8)
}

export interface InvestorOffer {
  id: string;
  fundName: string;
  investmentAmount: number;      // Số tiền đề xuất rót vốn (VND)
  preMoneyValuation: number;     // Định giá công ty trước đầu tư
  postMoneyValuation: number;    // Pre-money + Investment
  equityRequestedPercent: number;// Tỷ lệ cổ phần yêu cầu (ví dụ: 0.20 = 20%)
  specialTerms: string[];        // Các điều khoản kèm theo
}
```

---

## 2. CỖ MÁY TỔNG HỢP DOANH THU & DÒNG TIỀN CHUỖI (MULTI-STORE AGGREGATION ENGINE)

```typescript
export function aggregateChainQuarter(chain: ChainState): ChainState {
  let totalChainRevenue = 0;
  let totalChainCompanyProfit = 0;
  
  // Áp dụng chiết khấu biến phí nếu có Bếp trung tâm
  const effectiveVarRatio = chain.hasCentralKitchen ? 0.20 : 0.30;
  
  for (const store of chain.stores) {
    totalChainRevenue += store.monthlyRevenue;
    
    if (store.type === 'company_owned') {
      // Quán trực thuộc: Công ty hưởng trọn Doanh thu - Biến phí - Định phí
      const storeCOGS = store.monthlyRevenue * effectiveVarRatio;
      const storeNet = store.monthlyRevenue - storeCOGS - store.monthlyFixedCost;
      totalChainCompanyProfit += storeNet;
    } else if (store.type === 'franchise' && store.franchiseContract) {
      // Quán nhượng quyền: Công ty mẹ thu Phí Bản Quyền + Biên Lãi Cung Ứng
      const royaltyIncome = store.monthlyRevenue * store.franchiseContract.royaltyPercent;
      const supplyIncome = (store.monthlyRevenue * effectiveVarRatio) * store.franchiseContract.supplyMarkupPercent;
      totalChainCompanyProfit += (royaltyIncome + supplyIncome);
    }
  }
  
  // Chi phí vận hành Trụ sở công ty mẹ (HQ Opex: 25.000.000 VND/tháng)
  const hqMonthlyOpex = 25_000_000;
  const netCompanyProfitMonthly = totalChainCompanyProfit - hqMonthlyOpex;
  
  // Dòng tiền 1 Quý (3 tháng)
  const cashEnding = chain.cash + (netCompanyProfitMonthly * 3);
  
  return {
    ...chain,
    cash: cashEnding,
    monthlyChainRevenue: totalChainRevenue,
    monthlyChainProfit: netCompanyProfitMonthly
  };
}
```

---

## 3. THUẬT TOÁN ĐỊNH GIÁ & PHA LOÃNG CỔ PHẦN (VALUATION & DILUTION REDUCER)

```typescript
export function executeAngelInvestment(
  chain: ChainState, 
  offer: InvestorOffer
): ChainState {
  const postMoney = offer.preMoneyValuation + offer.investmentAmount;
  const investorEquity = offer.investmentAmount / postMoney;
  
  // Tái cấu trúc Bảng Cap Table (Pha loãng cổ phần)
  const updatedCapTable: CapTableEntry[] = chain.capTable.map(entry => {
    if (entry.holder === 'Founder') {
      return {
        ...entry,
        ownershipPercent: entry.ownershipPercent * (1 - investorEquity)
      };
    }
    return entry;
  });
  
  // Thêm Nhà đầu tư mới vào Cap Table
  updatedCapTable.push({
    holder: 'Angel_Investor',
    sharesCount: Math.round(1_000_000 * investorEquity),
    ownershipPercent: investorEquity
  });
  
  return {
    ...chain,
    cash: chain.cash + offer.investmentAmount,
    capTable: updatedCapTable
  };
}
```

---

## 4. CHIẾN LƯỢC KIỂM THỬ (UNIT TEST CONTRACTS)
1. **Kiểm tra tính tổng đa chi nhánh:** Doanh thu toàn chuỗi phải bằng đúng tổng doanh thu của từng chi nhánh con cộng lại.
2. **Kiểm tra tỷ lệ Cap Table:** Tổng phần trăm cổ phần của tất cả các bên trong Cap Table luôn luôn bằng đúng `1.0` (100%), không có sai lệch làm tròn.
3. **Bảo toàn quyền kiểm soát của Người sáng lập:** Test case cảnh báo nếu tỷ lệ của Founder rơi xuống $< 50\%$ hoặc $< 65\%$.
