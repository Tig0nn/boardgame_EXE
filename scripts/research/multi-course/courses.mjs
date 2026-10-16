import {copyState,record,snapshot} from '../../../src/game/state.ts'
import {decide} from '../../../src/game/engine.ts'
import {boardFor} from '../../../src/data/board.ts'
export function purchases(s,c){
  return s.log.filter(e=>e.researchCourse||(c.course.id==='A-baseline'&&e.kind==='decision'&&e.eventId==='course'&&e.decisionId==='upgrade'))
    .map(e=>({...e.researchCourse??c.course.courses[0],lap:e.before.lap,turn:e.before.turn,sequence:e.sequence,cashAfter:e.after.portfolio.cash}))
}
export function availableCourses(s,c){
  const bought=new Set(purchases(s,c).map(p=>p.id))
  return c.course.courses.filter((course,i)=>!bought.has(course.id)&&(c.course.unlock==='independent'||i===0||bought.has(c.course.courses[i-1].id)))
}
export function buyCourse(state,c,id){
  if(state.phase!=='event'||state.eventId!=='course'||boardFor(state)[state.position].type!=='course')throw Error('Course is encounter-only')
  if(purchases(state,c).some(p=>p.turn===state.turn))throw Error('One successful course per encounter')
  const course=availableCourses(state,c).find(x=>x.id===id)
  if(!course||state.portfolio.cash<course.cost)throw Error('Unavailable course or insufficient voluntary cash')
  if(c.course.id==='A-baseline')return decide(state,'upgrade')
  const s=copyState(state)
  s.portfolio.cash-=course.cost;s.recurringIncome+=course.boost;s.coursePurchased=true
  s.phase='rolling';s.eventId=null
  return record(s,snapshot(state),{kind:'decision',eventId:'course',decisionId:`research-course-${id}`,researchCourse:{...course},
    title:'Research-only course',decision:`${id}: cost${course.cost}, boost${course.boost}/START`,expensePaid:course.cost,
    consequence:'Cash-only; cumulative salary from next completed START; no refund.'})
}
export function courseMetrics(s,c){
  const salary=s.log.filter(e=>e.kind==='schedule'&&e.title==='Nhận lương')
  const coursePurchases=purchases(s,c).map(p=>{
    const startsReceived=salary.filter(e=>e.sequence>p.sequence).length,revenue=startsReceived*p.boost
    return {...p,startsReceived,revenue,net:revenue-p.cost,recovered:revenue>=p.cost,breakEvenStarts:Math.ceil(p.cost/p.boost)}
  })
  const courseSpend=coursePurchases.reduce((n,p)=>n+p.cost,0),courseSalaryReceived=coursePurchases.reduce((n,p)=>n+p.revenue,0)
  return {coursesBought:coursePurchases.length,courseSpend,courseSalaryReceived,courseNet:courseSalaryReceived-courseSpend,
    cashAfterCourseMin:coursePurchases.length?Math.min(...coursePurchases.map(p=>p.cashAfter)):null,coursePurchases}
}
