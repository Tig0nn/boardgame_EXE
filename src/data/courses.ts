// Approved I2-choice curriculum. Independent purchases; immutable versioned data.
export const MULTI_COURSES = Object.freeze([
  Object.freeze({ id: 'basic' as const, name: 'Khóa cơ bản', cost: 6_000_000, boost: 2_000_000 }),
  Object.freeze({ id: 'advanced' as const, name: 'Khóa nâng cao', cost: 10_000_000, boost: 4_000_000 }),
])
