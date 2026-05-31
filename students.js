/**
 * Student credentials — SERVER-SIDE ONLY
 * These IDs are passwords and must never be sent to the browser
 */

const STUDENTS = [
  {no:1,  id:'56006', first:'ณัฐธีร์',     last:'ชาติชีวินทร์'},
  {no:2,  id:'56044', first:'ภูวิชญ์',     last:'บุญมี'},
  {no:3,  id:'56269', first:'ธนเดช',       last:'วงษ์ชูแก้ว'},
  {no:4,  id:'56315', first:'พิจักษณ์',    last:'ทองสมัครพันธ์'},
  {no:5,  id:'56363', first:'นัธทวัฒน์',   last:'เพ็ชรพันธ์'},
  {no:6,  id:'56369', first:'ณัฐภูมินทร์', last:'ไตรทิพย์วิทยา'},
  {no:7,  id:'56392', first:'กรวิชญ์',     last:'อำพันสุข'},
  {no:8,  id:'56398', first:'ชนาธิป',      last:'สนุกล้ำ'},
  {no:9,  id:'56406', first:'พงศ์ชัย',     last:'จาง'},
  {no:10, id:'56431', first:'กันตพัฒน์',   last:'เลิศไพศาลกรกุล'},
  {no:11, id:'56462', first:'ธนกฤต',       last:'ทิตยาคุณาธร'},
  {no:12, id:'56506', first:'รัชพล',       last:'จรัสพัฒน์'},
  {no:13, id:'56516', first:'ศักดิ์ธวัช',  last:'ฐานานุศักดิ์'},
  {no:14, id:'56523', first:'บุญญปัญญ์',   last:'เสริมสุข'},
  {no:15, id:'56527', first:'ธนกฤต',       last:'ศุภรังค์'},
  {no:16, id:'56538', first:'ณฐพงศ์',      last:'คุณจักร'},
  {no:17, id:'56548', first:'ธีภพ',        last:'ทองคุ้ม'},
  {no:18, id:'56552', first:'กฤติธี',      last:'ชาญนคร'},
  {no:19, id:'56563', first:'สรวิชญ์',     last:'สมจิตร'},
  {no:20, id:'56566', first:'อริย์ธัช',    last:'นภัสกรสิริโชติ'},
  {no:21, id:'56602', first:'สุจิรภาคย์',  last:'บำเพ็ญรัตน์'},
  {no:22, id:'56629', first:'กรณ์ฐู',      last:'ปลอดภัย'},
  {no:23, id:'56639', first:'ปรานต์',      last:'เบญจพลาพร'},
  {no:24, id:'56648', first:'สุกฤษฎิ์',    last:'เอี่ยมศักดิ์อุฬาร'},
  {no:25, id:'57509', first:'คุณภชา',      last:'อภิรักษ์ภูบาล'},
  {no:26, id:'59891', first:'กฤษฎิ์',      last:'กันชะศิวัฒน์'},
  {no:27, id:'59892', first:'อนพัทย์',     last:'มะลิวงศ์'},
  {no:28, id:'59898', first:'ปภังกร',      last:'อิ้งพานิช'},
  {no:29, id:'59899', first:'ภูวิน',       last:'ชัยอดิศักดิ์โสภา'},
  {no:30, id:'59904', first:'ศิวะนนท์',    last:'เอกศิรินวนันท์'},
  {no:31, id:'59927', first:'ฉันทกร',      last:'ฉันทโชติ'},
  {no:32, id:'59947', first:'พัชรธร',      last:'ศรีประมงค์'},
  {no:33, id:'59953', first:'พิชญ์ตม์',    last:'จันทร์วัง'},
  {no:34, id:'60041', first:'ชนะชัย',      last:'วราวรรณ ณ อยุธยา'},
  {no:35, id:'60455', first:'ฐาปกรณ์',     last:'เจริญกิจรักษา'},
];

/** Returns student safe info (no ID/password) for sending to browser */
function toPublic(s) {
  return { no: s.no, first: s.first, last: s.last };
}

/** Verify credentials, returns student or null */
function authenticate(no, password) {
  const adminNo   = parseInt(process.env.ADMIN_STUDENT_NO) || 27;
  const adminPass = process.env.ADMIN_PASSWORD || '';

  // Check admin first
  if (parseInt(no) === adminNo && password === adminPass) {
    const s = STUDENTS.find(x => x.no === adminNo);
    return s ? { ...toPublic(s), role: 'admin' } : null;
  }

  // Regular student: no + student ID as password
  const s = STUDENTS.find(x => x.no === parseInt(no) && x.id === password);
  if (!s) return null;
  return { ...toPublic(s), role: 'user' };
}

/** All students without passwords (safe to include in JWT or API) */
function allPublic() {
  return STUDENTS.map(toPublic);
}

module.exports = { authenticate, allPublic, toPublic, STUDENTS };
