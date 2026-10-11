import type { CustomerPreferenceId } from '../game/types.ts'

export const CUSTOMER_PREFERENCES: readonly { id: CustomerPreferenceId; label: string; example: string }[] = [
  { id: 'checkin', label: 'Không gian check-in', example: 'Trang trí quán, tạo góc chụp ảnh và không gian dễ chịu.' },
  { id: 'budget', label: 'Giá cả hợp lý', example: 'Combo tiết kiệm, giá dễ tiếp cận và vận hành hiệu quả.' },
  { id: 'taste', label: 'Chất lượng đồ uống', example: 'Nâng công thức, nguyên liệu và chất lượng từng ly.' },
]
